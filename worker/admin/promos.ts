/**
 * Fleet console: promo codes. Learners redeem them in Settings (worker/promo.ts).
 *
 *   GET   /api/admin/promos                    codes, newest first, and the packages a code can give
 *   POST  /api/admin/promos {AdminPromoInput}  make a code, random or typed in   step-up
 *   GET   /api/admin/promos/:code              one code and who redeemed it
 *   PATCH /api/admin/promos/:code {disabled}   switch it off or on again        step-up
 *
 * Codes aren't deleted: switching one off keeps its redemptions for the
 * record, and grants already made stay until they end (end them on the
 * account's page). Every change is written to admin_audit.
 */
import type { AdminPromo, AdminPromoDetail, AdminPromoInput, AdminPromoList } from '../../src/lib/promo/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { liveGrant } from '../plans.ts';
import { generatePromoCode, normalizePromo } from '../promo.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_PROMO_DAYS = 730;
export const MAX_PROMO_USES = 10_000;
export const MAX_PROMO_EXPIRY_DAYS = 365;

const PROMO_SELECT = `SELECT p.code, p.label, p.plan_id AS plan, p.kind, p.days, p.max_uses AS maxUses, p.uses,
	p.expires_at AS expiresAt, p.disabled_at AS disabledAt, p.created_at AS createdAt,
	CASE WHEN p.disabled_at IS NOT NULL THEN 'disabled'
	     WHEN p.expires_at IS NOT NULL AND p.expires_at <= ?1 THEN 'expired'
	     WHEN p.max_uses IS NOT NULL AND p.uses >= p.max_uses THEN 'used_up'
	     ELSE 'live' END AS state
	FROM promo_codes p`;

async function list(env: Env): Promise<AdminPromoList> {
	const [promos, plans] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`${PROMO_SELECT} ORDER BY p.created_at DESC LIMIT 200`).bind(Date.now()),
		env.DB.prepare(`SELECT id, name FROM plans WHERE id != 'free' ORDER BY rank`)
	]);
	return { promos: promos.results as unknown as AdminPromo[], plans: plans.results as unknown as AdminPromoList['plans'] };
}

async function detail(env: Env, code: string): Promise<AdminPromoDetail> {
	const now = Date.now();
	const p = await env.DB.prepare(`${PROMO_SELECT} WHERE p.code = ?2`).bind(now, code).first<AdminPromo>();
	if (!p) throw httpError(404, 'bad_request', 'No such code');
	const r = await env.DB.prepare(
		`SELECT r.account_id AS accountId, a.name AS accountName, r.redeemed_at AS redeemedAt, r.grant_id AS grantId,
		        EXISTS (SELECT 1 FROM plan_grants g WHERE g.id = r.grant_id AND ${liveGrant('?1')}) AS live
		   FROM promo_redemptions r LEFT JOIN accounts a ON a.id = r.account_id
		  WHERE r.code = ?2 ORDER BY r.redeemed_at DESC LIMIT 500`
	)
		.bind(now, code)
		.all<Omit<AdminPromoDetail['redemptions'][number], 'live'> & { live: number }>();
	return { ...p, redemptions: r.results.map((x) => ({ ...x, live: !!x.live })) };
}

const whole = (v: unknown, min: number, max: number, msg: string): number | null => {
	if (v === null || v === undefined) return null;
	if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw httpError(400, 'bad_request', msg);
	return v;
};

export function parsePromoInput(body: unknown): Required<Omit<AdminPromoInput, 'code' | 'label'>> & { code: string | null; label: string | null } {
	const b = (body ?? {}) as Record<string, unknown>;
	let code: string | null = null;
	if (b.code !== undefined && b.code !== null && b.code !== '') {
		code = normalizePromo(b.code);
		if (!code) throw httpError(400, 'bad_request', 'A code is 4 to 24 letters and digits');
	}
	if (typeof b.plan !== 'string' || !/^[a-z0-9-]{1,30}$/.test(b.plan) || b.plan === 'free') throw httpError(400, 'bad_request', 'Pick a paid package');
	if (b.kind !== 'comp' && b.kind !== 'trial') throw httpError(400, 'bad_request', 'Kind must be comp or trial');
	const days = whole(b.days, 1, MAX_PROMO_DAYS, `A code gives 1 to ${MAX_PROMO_DAYS} days, or until ended`);
	if (b.kind === 'trial' && days === null) throw httpError(400, 'bad_request', 'A trial needs a length');
	const maxUses = whole(b.maxUses, 1, MAX_PROMO_USES, `A code can be used 1 to ${MAX_PROMO_USES} times, or without a limit`);
	const expiresInDays = whole(b.expiresInDays, 1, MAX_PROMO_EXPIRY_DAYS, `A code expires in 1 to ${MAX_PROMO_EXPIRY_DAYS} days, or never`);
	const label = typeof b.label === 'string' ? b.label.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) || null : null;
	return { code, label, plan: b.plan, kind: b.kind, days, maxUses, expiresInDays };
}

async function create(req: Request, env: Env, ctx: AdminContext) {
	const input = parsePromoInput(await readJson(req, 2048));
	await requireFresh(env, ctx);
	const plan = await env.DB.prepare(`SELECT id FROM plans WHERE id = ?1 AND id != 'free'`).bind(input.plan).first();
	if (!plan) throw httpError(400, 'bad_request', 'No such package');
	let code = input.code;
	if (!code) {
		// 31^10 codes: a clash is near impossible, but check anyway
		for (let i = 0; i < 5 && !code; i++) {
			const c = generatePromoCode();
			if (!(await env.DB.prepare(`SELECT 1 AS x FROM promo_codes WHERE code = ?1`).bind(c).first())) code = c;
		}
		if (!code) throw httpError(500, 'provider', 'Couldn’t make a unique code, try again');
	} else if (await env.DB.prepare(`SELECT 1 AS x FROM promo_codes WHERE code = ?1`).bind(code).first()) {
		throw httpError(409, 'bad_request', 'That code already exists');
	}
	const now = Date.now();
	const expiresAt = input.expiresInDays === null ? null : now + input.expiresInDays * DAY;
	await audited(
		env,
		ctx,
		'promo.create',
		null,
		{ code, custom: !!input.code, label: input.label, plan: input.plan, kind: input.kind, days: input.days, maxUses: input.maxUses, expiresAt },
		[
			env.DB.prepare(
				`INSERT INTO promo_codes (code, label, plan_id, kind, days, max_uses, expires_at, created_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
			).bind(code, input.label, input.plan, input.kind, input.days, input.maxUses, expiresAt, now, ctx.session.userId)
		]
	);
	return json(await detail(env, code));
}

async function setDisabled(req: Request, env: Env, ctx: AdminContext, code: string) {
	const { disabled } = ((await readJson(req, 1024)) ?? {}) as { disabled?: unknown };
	if (typeof disabled !== 'boolean') throw httpError(400, 'bad_request', '`disabled` must be true or false');
	await requireFresh(env, ctx);
	const row = await env.DB.prepare(`SELECT disabled_at AS disabledAt FROM promo_codes WHERE code = ?1`).bind(code).first<{ disabledAt: number | null }>();
	if (!row) throw httpError(404, 'bad_request', 'No such code');
	if ((row.disabledAt !== null) !== disabled)
		await audited(env, ctx, disabled ? 'promo.disable' : 'promo.enable', null, { code }, [
			env.DB.prepare(`UPDATE promo_codes SET disabled_at = ?1 WHERE code = ?2`).bind(disabled ? Date.now() : null, code)
		]);
	return json(await detail(env, code));
}

export async function handlePromos(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/promos' && m === 'GET') return json(await list(env));
	if (p === '/api/admin/promos' && m === 'POST') return create(req, env, ctx);
	const one = /^\/api\/admin\/promos\/([A-Za-z0-9]{4,24})$/.exec(p);
	if (!one) return null;
	const code = normalizePromo(one[1])!;
	if (m === 'GET') return json(await detail(env, code));
	if (m === 'PATCH') return setDisabled(req, env, ctx, code);
	return null;
}
