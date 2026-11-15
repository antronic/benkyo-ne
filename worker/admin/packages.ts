/**
 * Fleet console: packages (PR 5 of the fleet console plan).
 *
 *   GET    /api/admin/packages                         the three packages, how many accounts each, live grants
 *   PUT    /api/admin/packages/:id {AdminPlanPatch}    edit name, prices, AI allowance, blurb, offered   step-up
 *   POST   /api/admin/accounts/:id/grants {AdminGrantInput}  give an account Plus or Pro (replaces its live grant)  step-up
 *   DELETE /api/admin/accounts/:id/grants/:grantId     end a grant now                                   step-up
 *
 * Every change is written to admin_audit. Packages aren't enforced in the app
 * yet (worker/plans.ts); this is where they're defined and handed out.
 */
import type { AdminGrantInput, AdminPackages, AdminPlan, AdminPlanPatch } from '../../src/lib/admin/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { GRANT_KINDS, liveGrant, PLAN_IDS, planOfSql } from '../plans.ts';
import { accountDetail, GRANT_SELECT, toGrant } from './accounts.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_PRICE_USD = 1000;
export const MAX_ALLOWANCE_USD = 100;
export const MAX_GRANT_DAYS = 730;

type PlanRow = Omit<AdminPlan, 'available' | 'accounts'> & { available: number };
const PLAN_COLS = `id, name, price_month_usd AS priceMonthUsd, price_year_usd AS priceYearUsd,
	ai_allowance_usd AS aiAllowanceUsd, blurb, available, updated_at AS updatedAt`;

async function packages(env: Env): Promise<AdminPackages> {
	const now = Date.now();
	const [plans, counts, grants] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`SELECT ${PLAN_COLS} FROM plans ORDER BY rank`),
		env.DB.prepare(`SELECT ${planOfSql('a.id')} AS plan, COUNT(*) AS n FROM accounts a GROUP BY plan`),
		env.DB.prepare(`${GRANT_SELECT} WHERE ${liveGrant('?1')} ORDER BY g.ends_at IS NULL, g.ends_at, g.id DESC LIMIT 200`).bind(now)
	]);
	const byPlan = new Map((counts.results as unknown as { plan: string; n: number }[]).map((c) => [c.plan, c.n]));
	return {
		plans: (plans.results as unknown as PlanRow[]).map((p) => ({ ...p, available: !!p.available, accounts: byPlan.get(p.id) ?? 0 })),
		grants: (grants.results as never as Parameters<typeof toGrant>[0][]).map(toGrant)
	};
}

const money = (v: unknown, max: number, what: string) => {
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw httpError(400, 'bad_request', `${what} must be $0 to $${max}`);
	return Math.round(v * 100) / 100;
};
const text = (v: unknown, max: number, what: string, allowEmpty = false) => {
	if (typeof v !== 'string') throw httpError(400, 'bad_request', `${what} must be text`);
	const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
	if (!t && !allowEmpty) throw httpError(400, 'bad_request', `${what} can’t be empty`);
	return t;
};

export function parsePlanPatch(id: string, body: unknown): AdminPlanPatch {
	const b = (body ?? {}) as Record<string, unknown>;
	const out: AdminPlanPatch = {};
	if (b.name !== undefined) out.name = text(b.name, 30, 'The name');
	if (b.blurb !== undefined) out.blurb = text(b.blurb, 200, 'The description', true);
	if (b.priceMonthUsd !== undefined) out.priceMonthUsd = money(b.priceMonthUsd, MAX_PRICE_USD, 'The monthly price');
	if (b.priceYearUsd !== undefined) out.priceYearUsd = money(b.priceYearUsd, MAX_PRICE_USD, 'The yearly price');
	if (b.aiAllowanceUsd !== undefined) out.aiAllowanceUsd = money(b.aiAllowanceUsd, MAX_ALLOWANCE_USD, 'The AI allowance');
	if (b.available !== undefined) {
		if (typeof b.available !== 'boolean') throw httpError(400, 'bad_request', '`available` must be true or false');
		out.available = b.available;
	}
	if (!Object.keys(out).length) throw httpError(400, 'bad_request', 'Nothing to change');
	if (id === 'free' && (out.priceMonthUsd || out.priceYearUsd || out.aiAllowanceUsd || out.available === false))
		throw httpError(400, 'bad_request', 'Free stays free, with no managed AI, and is always offered');
	return out;
}

export function parseGrantInput(body: unknown): AdminGrantInput {
	const b = (body ?? {}) as Record<string, unknown>;
	if (b.plan !== 'plus' && b.plan !== 'pro') throw httpError(400, 'bad_request', 'Grant Plus or Pro');
	if (!(GRANT_KINDS as readonly unknown[]).includes(b.kind)) throw httpError(400, 'bad_request', 'Kind must be comp or trial');
	const days = b.days === null || b.days === undefined ? null : b.days;
	if (days !== null && (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS))
		throw httpError(400, 'bad_request', `A grant lasts 1 to ${MAX_GRANT_DAYS} days, or until ended`);
	if (b.kind === 'trial' && days === null) throw httpError(400, 'bad_request', 'A trial needs an end date');
	const note = b.note === undefined || b.note === null ? undefined : text(b.note, 120, 'The note', true) || undefined;
	return { plan: b.plan, kind: b.kind as AdminGrantInput['kind'], days, note };
}

async function updatePlan(req: Request, env: Env, ctx: AdminContext, id: string) {
	if (!(PLAN_IDS as readonly string[]).includes(id)) throw httpError(404, 'bad_request', 'No such package');
	const patch = parsePlanPatch(id, await readJson(req, 4096));
	await requireFresh(env, ctx);
	const before = await env.DB.prepare(`SELECT ${PLAN_COLS} FROM plans WHERE id = ?1`).bind(id).first<PlanRow>();
	if (!before) throw httpError(404, 'bad_request', 'No such package');
	const cols: Record<keyof AdminPlanPatch, string> = {
		name: 'name',
		blurb: 'blurb',
		priceMonthUsd: 'price_month_usd',
		priceYearUsd: 'price_year_usd',
		aiAllowanceUsd: 'ai_allowance_usd',
		available: 'available'
	};
	const keys = (Object.keys(patch) as (keyof AdminPlanPatch)[]).filter((k) => {
		const was = k === 'available' ? !!before.available : before[k];
		return was !== patch[k];
	});
	if (keys.length) {
		const sets = keys.map((k, i) => `${cols[k]} = ?${i + 1}`).join(', ');
		const values = keys.map((k) => (k === 'available' ? (patch[k] ? 1 : 0) : patch[k]));
		const diff = Object.fromEntries(keys.map((k) => [k, { from: k === 'available' ? !!before.available : before[k], to: patch[k] }]));
		await audited(env, ctx, 'package.update', null, { plan: id, ...diff }, [
			env.DB.prepare(`UPDATE plans SET ${sets}, updated_at = ?${keys.length + 1}, updated_by = ?${keys.length + 2} WHERE id = ?${keys.length + 3}`).bind(
				...values,
				Date.now(),
				ctx.session.userId,
				id
			)
		]);
	}
	return json(await packages(env));
}

async function grant(req: Request, env: Env, ctx: AdminContext, accountId: number) {
	const input = parseGrantInput(await readJson(req, 4096));
	await requireFresh(env, ctx);
	const acc = await env.DB.prepare(`SELECT id FROM accounts WHERE id = ?1`).bind(accountId).first();
	if (!acc) throw httpError(404, 'bad_request', 'No such account');
	const now = Date.now();
	const endsAt = input.days === null ? null : now + input.days * DAY;
	const replaced = await env.DB.prepare(`SELECT g.id FROM plan_grants g WHERE g.account_id = ?2 AND ${liveGrant('?1')}`)
		.bind(now, accountId)
		.all<{ id: number }>();
	await audited(env, ctx, 'package.grant', accountId, { plan: input.plan, kind: input.kind, endsAt, note: input.note ?? null, replaced: replaced.results.map((r) => r.id) }, [
		// one live grant per account: the new one replaces any other
		env.DB.prepare(`UPDATE plan_grants AS g SET ended_at = ?1 WHERE g.account_id = ?2 AND ${liveGrant('?1')}`).bind(now, accountId),
		env.DB.prepare(
			`INSERT INTO plan_grants (account_id, plan_id, kind, note, starts_at, ends_at, created_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5, ?7)`
		).bind(accountId, input.plan, input.kind, input.note ?? null, now, endsAt, ctx.session.userId)
	]);
	return json(await accountDetail(env, accountId));
}

async function endGrant(env: Env, ctx: AdminContext, accountId: number, grantId: number) {
	await requireFresh(env, ctx);
	const now = Date.now();
	const g = await env.DB.prepare(`SELECT g.plan_id AS plan FROM plan_grants g WHERE g.id = ?2 AND g.account_id = ?3 AND ${liveGrant('?1')}`)
		.bind(now, grantId, accountId)
		.first<{ plan: string }>();
	if (!g) throw httpError(404, 'bad_request', 'No such grant, or it has already ended');
	await audited(env, ctx, 'package.end', accountId, { grant: grantId, plan: g.plan }, [
		env.DB.prepare(`UPDATE plan_grants SET ended_at = ?1 WHERE id = ?2`).bind(now, grantId)
	]);
	return json(await accountDetail(env, accountId));
}

export async function handlePackages(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/packages' && m === 'GET') return json(await packages(env));
	const plan = /^\/api\/admin\/packages\/([a-z]{1,10})$/.exec(p);
	if (plan && m === 'PUT') return updatePlan(req, env, ctx, plan[1]);
	const g = /^\/api\/admin\/accounts\/(\d{1,12})\/grants(?:\/(\d{1,12}))?$/.exec(p);
	if (g && !g[2] && m === 'POST') return grant(req, env, ctx, Number(g[1]));
	if (g && g[2] && m === 'DELETE') return endGrant(env, ctx, Number(g[1]), Number(g[2]));
	return null;
}
