/**
 * Fleet console: usage, system and the audit log (PR 4 of the fleet console plan).
 * All read-only.
 *
 *   GET /api/admin/usage?days=7|30|90     AI spend by day, feature, model and account; failed calls
 *   GET /api/admin/system                 Worker version, migrations, health checks, table sizes
 *   GET /api/admin/audit?offset=&action=  admin_audit, newest first, 50 a page
 */
import type { AdminAuditEntry, AdminAuditList, AdminSystem, AdminUsage } from '../../src/lib/admin/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json } from '../http.ts';
import type { AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
export const USAGE_WINDOWS = [7, 30, 90] as const;
export const AUDIT_PAGE = 50;

/**
 * The newest file in worker/migrations when this Worker was built. The
 * system screen compares it with d1_migrations to spot a deploy whose
 * migrations didn't run. insights.test.ts fails if this falls behind.
 */
export const LATEST_MIGRATION = '0018_soft_delete_codes.sql';

/** Tables whose sizes the system screen shows. */
const TABLES = [
	'accounts',
	'passkeys',
	'sessions',
	'users',
	'user_cards',
	'user_notes',
	'community_profiles',
	'community_posts',
	'community_replies',
	'community_reports',
	'ai_ledger',
	'beta_events',
	'beta_ai_calls',
	'invite_codes',
	'plan_grants',
	'admin_audit'
] as const;

const startOfUtcDay = (t: number) => {
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Zero-filled per-day rows for the last `n` UTC days, oldest first. */
export function fillUsageDays(rows: { day: string; usd: number; calls: number; failed: number }[], now: number, n: number) {
	const byDay = new Map(rows.map((r) => [r.day, r]));
	const out: AdminUsage['byDay'] = [];
	for (let i = n - 1; i >= 0; i--) {
		const day = new Date(now - i * DAY).toISOString().slice(0, 10);
		const r = byDay.get(day);
		out.push({ day, usd: r?.usd ?? 0, calls: r?.calls ?? 0, failed: r?.failed ?? 0 });
	}
	return out;
}

async function usage(env: Env, days: number): Promise<AdminUsage> {
	const now = Date.now();
	const since = startOfUtcDay(now) - (days - 1) * DAY;
	const q = (sql: string) => env.DB.prepare(sql).bind(since);
	const [byDay, byFeature, byModel, top, failures, bySource, byPackage] = await env.DB.batch<Record<string, never>>([
		q(
			`SELECT strftime('%Y-%m-%d', at / 1000, 'unixepoch') AS day,
			        COALESCE(SUM(CASE WHEN status = 'done' THEN cost_usd END), 0) AS usd,
			        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS calls,
			        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
			   FROM ai_ledger WHERE at >= ?1 GROUP BY day`
		),
		q(
			`SELECT feature, COUNT(*) AS calls, SUM(cost_usd) AS usd
			   FROM ai_ledger WHERE at >= ?1 AND status = 'done' GROUP BY feature ORDER BY usd DESC`
		),
		q(
			`SELECT provider, model, COUNT(*) AS calls, SUM(cost_usd) AS usd,
			        COALESCE(SUM(input_tokens), 0) AS inputTokens, COALESCE(SUM(output_tokens), 0) AS outputTokens
			   FROM ai_ledger WHERE at >= ?1 AND status = 'done' GROUP BY provider, model ORDER BY usd DESC LIMIT 20`
		),
		q(
			`SELECT l.user_id AS id, a.name AS name, COUNT(*) AS calls, SUM(l.cost_usd) AS usd
			   FROM ai_ledger l JOIN accounts a ON a.id = l.user_id
			  WHERE l.at >= ?1 AND l.status = 'done' GROUP BY l.user_id ORDER BY usd DESC LIMIT 10`
		),
		q(
			`SELECT l.at, l.feature, l.model, l.user_id AS accountId, a.name AS name
			   FROM ai_ledger l LEFT JOIN accounts a ON a.id = l.user_id
			  WHERE l.at >= ?1 AND l.status = 'failed' ORDER BY l.at DESC LIMIT 20`
		),
		q(
			`SELECT source, COUNT(*) AS calls, SUM(cost_usd) AS usd
			   FROM ai_ledger WHERE at >= ?1 AND status = 'done' GROUP BY source ORDER BY source`
		),
		q(
			`SELECT l.plan_id AS planId, COALESCE(p.name, l.plan_id) AS name, COUNT(*) AS calls, SUM(l.cost_usd) AS usd,
			        COUNT(DISTINCT l.user_id) AS accounts, COALESCE(p.ai_allowance_usd, 0) AS allowanceUsd
			   FROM ai_ledger l LEFT JOIN plans p ON p.id = l.plan_id
			  WHERE l.at >= ?1 AND l.status = 'done' AND l.source = 'package' GROUP BY l.plan_id ORDER BY usd DESC`
		)
	]);
	const filled = fillUsageDays(byDay.results as never, now, days);
	return {
		days,
		totals: {
			usd: filled.reduce((n, d) => n + d.usd, 0),
			calls: filled.reduce((n, d) => n + d.calls, 0),
			failed: filled.reduce((n, d) => n + d.failed, 0)
		},
		byDay: filled,
		byFeature: byFeature.results as never,
		byModel: byModel.results as never,
		topAccounts: top.results as never,
		failures: failures.results as never,
		bySource: bySource.results as never,
		byPackage: byPackage.results as never
	};
}

async function system(env: Env): Promise<AdminSystem> {
	const now = Date.now();
	const t0 = performance.now();
	await env.DB.prepare('SELECT 1').first();
	const dbMs = Math.round(performance.now() - t0);

	// d1_migrations is created by wrangler; a database migrated another way won't have it
	const applied = await env.DB.prepare(`SELECT name, applied_at AS appliedAt FROM d1_migrations ORDER BY id DESC LIMIT 1`)
		.first<{ name: string; appliedAt: string | null }>()
		.catch(() => null);

	const [keys, models, stuck, providers, ...counts] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM ai_credentials`),
		env.DB.prepare(`SELECT feature, model, COUNT(*) AS accounts FROM ai_feature_models GROUP BY feature, model ORDER BY feature, accounts DESC`),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM ai_ledger WHERE status = 'reserved' AND at < ?1`).bind(now - 10 * 60 * 1000),
		env.DB.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN check_error IS NOT NULL THEN 1 ELSE 0 END) AS failing FROM ai_providers WHERE enabled = 1`),
		...TABLES.map((t) => env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`))
	]);

	let kvOk = false;
	try {
		await env.CONTENT.get('__fleet_health__');
		kvOk = true;
	} catch {
		/* reported below */
	}
	const meta = env.CF_VERSION_METADATA;
	const stuckN = (stuck.results[0] as { n: number } | undefined)?.n ?? 0;
	const prov = (providers.results[0] ?? {}) as { n?: number; failing?: number | null };
	const provN = prov.n ?? 0;
	const provFailing = prov.failing ?? 0;
	const appliedName = applied?.name ?? null;
	const appliedAt = applied?.appliedAt ? Date.parse(applied.appliedAt.replace(' ', 'T') + 'Z') : null;
	return {
		at: now,
		worker: meta?.id ? { id: meta.id, tag: meta.tag || null, deployedAt: meta.timestamp ? Date.parse(meta.timestamp) : null } : null,
		migrations: {
			applied: appliedName,
			appliedAt: appliedAt !== null && Number.isFinite(appliedAt) ? appliedAt : null,
			expected: LATEST_MIGRATION,
			upToDate: appliedName === null ? false : appliedName >= LATEST_MIGRATION
		},
		checks: [
			{ name: 'Database', ok: true, detail: `answered in ${dbMs} ms` },
			{ name: 'Content store (KV)', ok: kvOk, detail: kvOk ? 'reachable' : 'did not answer' },
			{ name: 'Key encryption', ok: !!env.AI_MASTER_KEY, detail: env.AI_MASTER_KEY ? 'AI_MASTER_KEY is set' : 'AI_MASTER_KEY is missing, so nobody can save an AI key' },
			{ name: 'Cloudflare Access', ok: !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD), detail: env.ACCESS_TEAM_DOMAIN ?? 'not configured (local dev)' },
			{
				name: 'AI providers',
				ok: provFailing === 0,
				detail: !provN ? 'none turned on yet' : provFailing ? `${provFailing} of ${provN} failed their last model list` : `${provN} turned on, all answering`
			},
			{ name: 'AI calls', ok: stuckN === 0, detail: stuckN ? `${stuckN} reserved for over 10 minutes` : 'none stuck' }
		],
		ai: {
			accountsWithKey: (keys.results[0] as { n: number } | undefined)?.n ?? 0,
			featureModels: models.results as never,
			stuckReserved: stuckN
		},
		tables: TABLES.map((name, i) => ({ name, rows: (counts[i].results[0] as { n: number } | undefined)?.n ?? 0 }))
	};
}

async function auditLog(env: Env, offset: number, action: string | null): Promise<AdminAuditList> {
	const [rows, actions] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(
			`SELECT l.id, l.at, l.actor_id AS actorId, a.name AS actorName, l.actor_email AS actorEmail, l.action,
			        l.target_id AS targetId, t.name AS targetName, l.detail_json AS detail
			   FROM admin_audit l
			   LEFT JOIN accounts a ON a.id = l.actor_id
			   LEFT JOIN accounts t ON t.id = l.target_id
			  WHERE ?1 IS NULL OR l.action = ?1
			  ORDER BY l.id DESC LIMIT ?2 OFFSET ?3`
		).bind(action, AUDIT_PAGE + 1, offset),
		env.DB.prepare(`SELECT DISTINCT action FROM admin_audit ORDER BY action`)
	]);
	const list = (rows.results as unknown as (Omit<AdminAuditEntry, 'detail'> & { detail: string | null })[]).map((r) => {
		let detail: unknown = null;
		try {
			detail = r.detail ? JSON.parse(r.detail) : null;
		} catch {
			detail = r.detail;
		}
		return { ...r, detail };
	});
	return {
		entries: list.slice(0, AUDIT_PAGE),
		next: list.length > AUDIT_PAGE ? offset + AUDIT_PAGE : null,
		actions: (actions.results as unknown as { action: string }[]).map((a) => a.action)
	};
}

export async function handleInsights(req: Request, env: Env, url: URL, _ctx: AdminContext): Promise<Response | null> {
	if (req.method !== 'GET') return null;
	const p = url.pathname;
	if (p === '/api/admin/usage') {
		const days = Number(url.searchParams.get('days') ?? 30);
		if (!(USAGE_WINDOWS as readonly number[]).includes(days)) throw httpError(400, 'bad_request', 'days must be 7, 30 or 90');
		return json(await usage(env, days));
	}
	if (p === '/api/admin/system') return json(await system(env));
	if (p === '/api/admin/audit') {
		const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') ?? 0)) || 0);
		const action = url.searchParams.get('action')?.slice(0, 64) || null;
		return json(await auditLog(env, offset, action));
	}
	return null;
}
