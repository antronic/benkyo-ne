/**
 * Per-account spend cap (D12), usage meter and rate limits.
 *
 * Every AI call first *reserves* its worst-case cost with a single
 * conditional INSERT (atomic in D1: the cap check and the reservation can't
 * interleave with another call), then settles the row to the actual cost.
 * Rows count toward the month whatever their status, so a crash mid-call
 * leaves the conservative worst case on the books.
 *
 * Two budgets share the ledger, told apart by `source`: 'own' rows (the
 * learner's key) count their cost_usd toward accounts.cap_usd, 'package'
 * rows (the operator's keys, managed AI) count their `credits` toward the
 * package's monthly credits (src/lib/ai/credits.ts). Package rows still
 * record cost_usd: what the operator's provider charged.
 */
import type { AiSource, Usage } from '../../src/lib/ai/contract.ts';
import type { TokenUsage } from '../../src/lib/ai/prices.ts';
import type { Env } from '../env.ts';

export const DEFAULT_CAP_USD = 5;
export const RATE_LIMIT_PER_MIN = 30;
/** All accounts together, protecting the Worker and D1 free-tier limits. */
export const GLOBAL_PER_MIN = 300;

export function monthStart(now = Date.now()): number {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
export const monthLabel = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

/** The account's cap; `?U` is the user id parameter. */
const capSql = (u: string) => `COALESCE((SELECT cap_usd FROM accounts WHERE id = ${u}), ${DEFAULT_CAP_USD})`;

export async function getUsage(env: Env, userId: number, now = Date.now()): Promise<Usage> {
	const row = await env.DB.prepare(
		`SELECT COALESCE(SUM(cost_usd), 0) AS spent,
		        COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS calls,
		        ${capSql('?2')} AS cap
		   FROM ai_ledger WHERE at >= ?1 AND user_id = ?2 AND source = 'own'`
	)
		.bind(monthStart(now), userId)
		.first<{ spent: number; calls: number; cap: number }>();
	return {
		month: monthLabel(now),
		spentUsd: Math.round((row?.spent ?? 0) * 1e6) / 1e6,
		capUsd: row?.cap ?? DEFAULT_CAP_USD,
		calls: row?.calls ?? 0
	};
}

export async function setCap(env: Env, userId: number, capUsd: number) {
	await env.DB.prepare(`UPDATE accounts SET cap_usd = ?1 WHERE id = ?2`).bind(capUsd, userId).run();
}

/** This month's managed AI credits and finished calls for an account (all packages together). */
export async function getPackageSpend(env: Env, userId: number, now = Date.now()) {
	const row = await env.DB.prepare(
		`SELECT COALESCE(SUM(credits), 0) AS spent, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS calls
		   FROM ai_ledger WHERE at >= ?1 AND user_id = ?2 AND source = 'package'`
	)
		.bind(monthStart(now), userId)
		.first<{ spent: number; calls: number }>();
	return { spentCredits: Math.round((row?.spent ?? 0) * 1e4) / 1e4, calls: row?.calls ?? 0 };
}

/**
 * Reserve the worst case if it fits under this month's budget: `worstUsd`
 * under the account's own cap for 'own' calls (the default), `worstCredits`
 * under `capCredits` (the package's monthly credits) for 'package' calls.
 * Returns the ledger id, or null when it doesn't fit.
 */
export async function reserve(
	env: Env,
	userId: number,
	r: {
		feature: string;
		provider: string;
		model: string;
		worstUsd: number;
		source?: AiSource;
		planId?: string | null;
		worstCredits?: number;
		capCredits?: number;
	},
	now = Date.now()
): Promise<number | null> {
	const source = r.source ?? 'own';
	const pkg = source === 'package';
	// what the budget counts: USD for the own key, credits for the package
	const spent = pkg ? 'credits' : 'cost_usd';
	const worst = pkg ? '?11' : '?5';
	const cap = pkg ? '?9' : capSql('?7');
	const row = await env.DB.prepare(
		`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd, user_id, source, plan_id, credits)
		 SELECT ?1, ?2, ?3, ?4, 'reserved', ?5, ?7, ?8, ?10, ?11
		  WHERE (SELECT COALESCE(SUM(${spent}), 0) FROM ai_ledger WHERE at >= ?6 AND user_id = ?7 AND source = ?8) + ${worst} <= ${cap} + 1e-9
		 RETURNING id`
	)
		.bind(
			now,
			r.feature,
			r.provider,
			r.model,
			r.worstUsd,
			monthStart(now),
			userId,
			source,
			r.capCredits ?? 0,
			pkg ? (r.planId ?? null) : null,
			pkg ? (r.worstCredits ?? 0) : 0
		)
		.first<{ id: number }>();
	return row?.id ?? null;
}

/**
 * Settle reservations: the first row gets the actual totals, the rest are
 * removed. `cost: null` keeps the reserved worst case (outcome unknown), in
 * USD and in credits. `credits` is a 'package' row's charge; left out
 * with a known cost it's 0 (an 'own' row, or a released reservation).
 */
export async function settle(
	env: Env,
	ids: number[],
	outcome: { status: 'done' | 'failed'; usage: TokenUsage; cost: number | null; credits?: number | null }
) {
	if (!ids.length) return;
	const [first, ...rest] = ids;
	const u = outcome.usage;
	const stmts = [
		env.DB.prepare(
			`UPDATE ai_ledger SET status = ?1, input_tokens = ?2, cached_tokens = ?3, cache_write_tokens = ?4,
			        output_tokens = ?5, cost_usd = COALESCE(?6, cost_usd),
			        credits = CASE WHEN ?6 IS NULL THEN credits ELSE COALESCE(?8, 0) END WHERE id = ?7`
		).bind(outcome.status, u.input, u.cacheRead ?? 0, u.cacheWrite ?? 0, u.output, outcome.cost, first, outcome.credits ?? null)
	];
	if (rest.length && outcome.cost !== null) {
		stmts.push(env.DB.prepare(`DELETE FROM ai_ledger WHERE id IN (${rest.map(() => '?').join(',')})`).bind(...rest));
	}
	await env.DB.batch(stmts);
}

/**
 * Fixed window per bucket (`windowMin` minutes, default 1). Returns false
 * when over the limit. `minute` stores the window's first minute.
 */
export async function rateLimit(env: Env, bucket: string, limit = RATE_LIMIT_PER_MIN, now = Date.now(), windowMin = 1) {
	const minute = Math.floor(now / 60000 / windowMin) * windowMin;
	const [, res] = await env.DB.batch([
		env.DB.prepare(`DELETE FROM ai_rate WHERE minute < ?1`).bind(Math.floor(now / 60000) - 2 * 1440),
		env.DB.prepare(
			`INSERT INTO ai_rate (bucket, minute, count) VALUES (?1, ?2, 1)
			 ON CONFLICT (bucket, minute) DO UPDATE SET count = count + 1 RETURNING count`
		).bind(bucket, minute)
	]);
	const count = (res.results[0] as { count: number } | undefined)?.count ?? 0;
	return count <= limit;
}
