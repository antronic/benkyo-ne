/**
 * Fleet console: promo codes. Learners redeem them in Settings (worker/promo.ts).
 *
 *   GET   /api/admin/promos                    codes, newest first, and the packages a code can give
 *   POST  /api/admin/promos {AdminPromoInput}  make a code, random or typed in   step-up
 *   GET   /api/admin/promos/:code              one code and who redeemed it
 *   PATCH /api/admin/promos/:code {AdminPromoPatch}  switch it off or on, or edit it   step-up
 *
 * Codes aren't deleted: switching one off keeps its redemptions for the
 * record, and grants already made stay until they end (end them on the
 * account's page). Every change is written to admin_audit.
 */
import type { AdminPromo, AdminPromoDetail, AdminPromoInput, AdminPromoList, AdminPromoPatch } from '../../src/lib/promo/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { liveGrant } from '../plans.ts';
import { generatePromoCode, normalizePromo, promoKey, promoKeySql } from '../promo.ts';
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

/** A typed code: 6 to 24 letters, digits and underscores (short ones are easy to guess, review of PR #32). */
export function parseCode(raw: unknown): string {
	const code = normalizePromo(raw);
	if (!code || promoKey(code).length < 6) throw httpError(400, 'bad_request', 'A code is 6 to 24 letters, digits and underscores, starting and ending with a letter or digit');
	return code;
}

/** Another code that matches the same way (underscores ignored), other than `except`. */
const clash = (env: Env, code: string, except: string | null = null) =>
	env.DB.prepare(`SELECT code FROM promo_codes WHERE ${promoKeySql('code')} = ?1 AND code IS NOT ?2`).bind(promoKey(code), except).first<{ code: string }>();

export function parsePromoInput(body: unknown): Required<Omit<AdminPromoInput, 'code' | 'label'>> & { code: string | null; label: string | null } {
	const b = (body ?? {}) as Record<string, unknown>;
	let code: string | null = null;
	if (b.code !== undefined && b.code !== null && b.code !== '') {
		code = parseCode(b.code);
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
			if (!(await clash(env, c))) code = c;
		}
		if (!code) throw httpError(500, 'provider', 'Couldn’t make a unique code, try again');
	} else {
		const other = await clash(env, code);
		if (other) throw httpError(409, 'bad_request', other.code === code ? 'That code already exists' : `That code matches ${other.code}, which already exists`);
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

interface PromoRowFull {
	code: string;
	label: string | null;
	plan: string;
	kind: 'comp' | 'trial';
	days: number | null;
	maxUses: number | null;
	uses: number;
	expiresAt: number | null;
	disabledAt: number | null;
	redemptions: number;
}

/**
 * Check a PATCH body against the code as it is now. Returns only what
 * changes, as column → value, plus a from/to record for the audit log.
 * Edits apply to future redemptions; grants already made keep their terms.
 */
export function parsePromoPatch(before: PromoRowFull, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as Record<string, unknown>;
	const cols: Record<string, unknown> = {};
	const diff: Record<string, { from: unknown; to: unknown }> = {};
	const set = (key: keyof PromoRowFull, col: string, to: unknown) => {
		if (before[key] === to) return;
		cols[col] = to;
		diff[key] = { from: before[key], to };
	};
	const known = ['disabled', 'code', 'label', 'plan', 'kind', 'days', 'maxUses', 'expiresInDays'];
	if (!Object.keys(b).some((k) => known.includes(k))) throw httpError(400, 'bad_request', 'Nothing to change');

	if (b.disabled !== undefined) {
		if (typeof b.disabled !== 'boolean') throw httpError(400, 'bad_request', '`disabled` must be true or false');
		if ((before.disabledAt !== null) !== b.disabled) set('disabledAt', 'disabled_at', b.disabled ? now : null);
	}
	if (b.code !== undefined) {
		const code = parseCode(b.code);
		// Redemptions, grant notes ("Promo CODE") and the audit log name the
		// code, and people may already have it: renaming is only safe before
		// anyone has used it.
		if (code !== before.code && (before.uses > 0 || before.redemptions > 0))
			throw httpError(409, 'bad_request', 'The code can’t change after someone has redeemed it. Make a new code instead.');
		set('code', 'code', code);
	}
	if (b.label !== undefined) {
		const label = typeof b.label === 'string' ? b.label.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) || null : null;
		set('label', 'label', label);
	}
	if (b.plan !== undefined) {
		if (typeof b.plan !== 'string' || !/^[a-z0-9-]{1,30}$/.test(b.plan) || b.plan === 'free') throw httpError(400, 'bad_request', 'Pick a paid package');
		set('plan', 'plan_id', b.plan);
	}
	if (b.kind !== undefined) {
		if (b.kind !== 'comp' && b.kind !== 'trial') throw httpError(400, 'bad_request', 'Kind must be comp or trial');
		set('kind', 'kind', b.kind);
	}
	if (b.days !== undefined) set('days', 'days', whole(b.days, 1, MAX_PROMO_DAYS, `A code gives 1 to ${MAX_PROMO_DAYS} days, or until ended`));
	const kind = (cols.kind ?? before.kind) as string;
	const days = 'days' in cols ? cols.days : before.days;
	if (kind === 'trial' && days === null) throw httpError(400, 'bad_request', 'A trial needs a length');
	if (b.maxUses !== undefined) {
		const maxUses = whole(b.maxUses, 1, MAX_PROMO_USES, `A code can be used 1 to ${MAX_PROMO_USES} times, or without a limit`);
		if (maxUses !== null && maxUses < before.uses) throw httpError(400, 'bad_request', `It has already been used ${before.uses} times, so the limit can’t be lower than that`);
		set('maxUses', 'max_uses', maxUses);
	}
	if (b.expiresInDays !== undefined) {
		const inDays = whole(b.expiresInDays, 1, MAX_PROMO_EXPIRY_DAYS, `A code expires in 1 to ${MAX_PROMO_EXPIRY_DAYS} days, or never`);
		set('expiresAt', 'expires_at', inDays === null ? null : now + inDays * DAY);
	}
	return { cols, diff };
}

async function update(req: Request, env: Env, ctx: AdminContext, code: string) {
	const body = await readJson(req, 2048);
	await requireFresh(env, ctx);
	const before = await env.DB.prepare(
		`SELECT p.code, p.label, p.plan_id AS plan, p.kind, p.days, p.max_uses AS maxUses, p.uses, p.expires_at AS expiresAt,
		        p.disabled_at AS disabledAt, (SELECT COUNT(*) FROM promo_redemptions r WHERE r.code = p.code) AS redemptions
		   FROM promo_codes p WHERE p.code = ?1`
	)
		.bind(code)
		.first<PromoRowFull>();
	if (!before) throw httpError(404, 'bad_request', 'No such code');
	const { cols, diff } = parsePromoPatch(before, body);
	if ('plan_id' in cols && !(await env.DB.prepare(`SELECT id FROM plans WHERE id = ?1 AND id != 'free'`).bind(cols.plan_id).first()))
		throw httpError(400, 'bad_request', 'No such package');
	if ('code' in cols) {
		const other = await clash(env, cols.code as string, code);
		if (other) throw httpError(409, 'bad_request', `That code matches ${other.code}, which already exists`);
	}
	const keys = Object.keys(cols);
	if (keys.length) {
		// switching on/off keeps its own audit actions; anything else is promo.update
		const onlySwitch = keys.length === 1 && keys[0] === 'disabled_at';
		const action = onlySwitch ? (cols.disabled_at === null ? 'promo.enable' : 'promo.disable') : 'promo.update';
		const sets = keys.map((k, i) => `${k} = ?${i + 1}`).join(', ');
		await audited(env, ctx, action, null, onlySwitch ? { code } : { code, ...diff }, [
			// the WHERE re-checks "never redeemed" so a rename can't race a redemption
			env.DB.prepare(
				`UPDATE promo_codes SET ${sets} WHERE code = ?${keys.length + 1}${'code' in cols ? ` AND uses = 0 AND NOT EXISTS (SELECT 1 FROM promo_redemptions r WHERE r.code = promo_codes.code)` : ''}`
			).bind(...keys.map((k) => cols[k]), code)
		]);
	}
	return json(await detail(env, (cols.code as string | undefined) ?? code));
}

export async function handlePromos(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/promos' && m === 'GET') return json(await list(env));
	if (p === '/api/admin/promos' && m === 'POST') return create(req, env, ctx);
	const one = /^\/api\/admin\/promos\/([A-Za-z0-9_]{4,24})$/.exec(p);
	if (!one) return null;
	const code = normalizePromo(one[1]);
	if (!code) throw httpError(404, 'bad_request', 'No such code');
	if (m === 'GET') return json(await detail(env, code));
	if (m === 'PATCH') return update(req, env, ctx, code);
	return null;
}
