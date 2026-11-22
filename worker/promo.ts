/**
 * Promo codes, the learner's side. Codes are made in the fleet console
 * (worker/admin/promos.ts) and redeemed in Settings.
 *
 *   GET  /api/promo                 the package this account is on now          signed in
 *   POST /api/promo/redeem {code}   redeem a code → PromoRedeemed               signed in, 10 tries an hour
 *
 * A redemption is an ordinary plan_grants row, so packages, the console and
 * account deletion treat it like any other grant. It replaces the account's
 * live grant, and is refused when that grant is already on the same package
 * or a higher one (a code never takes something away).
 */
import type { PromoProblem, PromoRedeemed, PromoStatus } from '../src/lib/promo/contract.ts';
import { rateLimit } from './ai/ledger.ts';
import { getSession } from './auth/passkey.ts';
import type { Env } from './env.ts';
import { HttpError, httpError, json, readJson } from './http.ts';
import { liveGrant } from './plans.ts';

const DAY = 24 * 60 * 60 * 1000;
export const REDEEM_TRIES_PER_HOUR = 10;
/** Letters and digits with no 0/O or 1/I/L, for random codes. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const RANDOM_CODE_LENGTH = 10;

/**
 * " songkran-2027 " → "SONGKRAN2027", "songkran_27" → "SONGKRAN_27"; null when
 * it can't be a code. Spaces, dashes and dots are dropped; underscores stay
 * (Job, 2026-11-19), but not at either end.
 */
export function normalizePromo(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > 64) return null;
	const s = raw.toUpperCase().replace(/[\s\-.]/g, '');
	return /^[0-9A-Z](?:[0-9A-Z_]{2,22})[0-9A-Z]$/.test(s) ? s : null;
}

/**
 * A code's key for matching: underscores ignored, so SONGKRAN_27 and
 * SONGKRAN27 are the same code. New codes must be unique by this key
 * (worker/admin/promos.ts), so a match is never ambiguous.
 */
export const promoKey = (code: string) => code.replace(/_/g, '');
/** SQL: the key of column `col`. */
export const promoKeySql = (col: string) => `REPLACE(${col}, '_', '')`;

export function generatePromoCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_CODE_LENGTH));
	return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** SQL condition: promo code `p` can still be redeemed at `now`. */
export const redeemable = (now: string) => `p.deleted_at IS NULL AND p.disabled_at IS NULL AND (p.expires_at IS NULL OR p.expires_at > ${now}) AND (p.max_uses IS NULL OR p.uses < p.max_uses)`;

const PROBLEMS: Record<PromoProblem, [number, string]> = {
	invalid: [404, 'That code isn’t valid'],
	disabled: [410, 'That code has been switched off'],
	expired: [410, 'That code has expired'],
	used_up: [410, 'That code has been used up'],
	already_redeemed: [409, 'You’ve already used this code'],
	already_on_plan: [409, 'You already have this package or a better one'],
	rate_limited: [429, 'Too many tries. Wait an hour and try again']
};
export const promoError = (problem: PromoProblem) =>
	new HttpError(PROBLEMS[problem][0], {
		error: problem === 'rate_limited' ? 'rate_limited' : 'bad_request',
		message: PROBLEMS[problem][1],
		problem
	} as never);

export async function promoStatus(env: Env, accountId: number, now = Date.now()): Promise<PromoStatus> {
	const g = await env.DB.prepare(
		`SELECT g.plan_id AS plan, pl.name AS planName, g.kind AS kind, g.ends_at AS endsAt, r.code AS promoCode
		   FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id
		   LEFT JOIN promo_redemptions r ON r.grant_id = g.id
		  WHERE g.account_id = ?2 AND ${liveGrant('?1')}
		  ORDER BY pl.rank DESC LIMIT 1`
	)
		.bind(now, accountId)
		.first<{ plan: string; planName: string; kind: 'comp' | 'trial'; endsAt: number | null; promoCode: string | null }>();
	if (g) return { plan: g.plan, planName: g.planName, grant: { kind: g.kind, endsAt: g.endsAt, promoCode: g.promoCode } };
	const free = await env.DB.prepare(`SELECT name FROM plans WHERE id = 'free'`).first<{ name: string }>();
	return { plan: 'free', planName: free?.name ?? 'Free', grant: null };
}

interface PromoRow {
	code: string;
	plan: string;
	kind: 'comp' | 'trial';
	days: number | null;
	rank: number;
	disabled: number;
	expired: number;
	usedUp: number;
}

export async function redeem(env: Env, accountId: number, raw: unknown, now = Date.now()): Promise<PromoRedeemed> {
	const typed = normalizePromo(raw);
	if (!typed) throw promoError('invalid');
	const p = await env.DB.prepare(
		`SELECT p.code, p.plan_id AS plan, p.kind, p.days, pl.rank,
		        p.disabled_at IS NOT NULL AS disabled,
		        (p.expires_at IS NOT NULL AND p.expires_at <= ?2) AS expired,
		        (p.max_uses IS NOT NULL AND p.uses >= p.max_uses) AS usedUp
		   FROM promo_codes p JOIN plans pl ON pl.id = p.plan_id WHERE ${promoKeySql('p.code')} = ?1 AND p.deleted_at IS NULL`
	)
		.bind(promoKey(typed), now)
		.first<PromoRow>();
	if (!p) throw promoError('invalid');
	const code = p.code; // as stored, with its underscores
	if (p.disabled) throw promoError('disabled');
	if (p.expired) throw promoError('expired');
	const mine = await env.DB.prepare(`SELECT 1 AS x FROM promo_redemptions WHERE code = ?1 AND account_id = ?2`).bind(code, accountId).first();
	if (mine) throw promoError('already_redeemed');
	if (p.usedUp) throw promoError('used_up');
	const better = await env.DB.prepare(
		`SELECT 1 AS x FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id WHERE g.account_id = ?2 AND ${liveGrant('?1')} AND pl.rank >= ?3`
	)
		.bind(now, accountId, p.rank)
		.first();
	if (better) throw promoError('already_on_plan');

	const endsAt = p.days === null ? null : now + p.days * DAY;
	// One batch (a transaction). The redemption row is only written while the
	// code is still redeemable, and every later statement runs only if it was:
	// two people racing for the last use can't both get it, and a grant made
	// meanwhile at the same or a higher plan isn't replaced by this one.
	const claimed = `EXISTS (SELECT 1 FROM promo_redemptions WHERE code = ?1 AND account_id = ?2 AND redeemed_at = ?3 AND grant_id IS NULL)`;
	await env.DB.batch([
		env.DB.prepare(
			`INSERT OR IGNORE INTO promo_redemptions (code, account_id, redeemed_at) SELECT p.code, ?2, ?3 FROM promo_codes p JOIN plans cp ON cp.id = p.plan_id
			  WHERE p.code = ?1 AND ${redeemable('?3')}
			    AND NOT EXISTS (SELECT 1 FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id WHERE g.account_id = ?2 AND ${liveGrant('?3')} AND pl.rank >= cp.rank)`
		).bind(code, accountId, now),
		env.DB.prepare(`UPDATE promo_codes SET uses = uses + 1 WHERE code = ?1 AND ${claimed}`).bind(code, accountId, now),
		// one live grant per account: the new one replaces any other
		env.DB.prepare(`UPDATE plan_grants AS g SET ended_at = ?3 WHERE g.account_id = ?2 AND ${liveGrant('?3')} AND ${claimed}`).bind(code, accountId, now),
		env.DB.prepare(
			`INSERT INTO plan_grants (account_id, plan_id, kind, note, starts_at, ends_at, created_at, created_by)
			 SELECT ?2, ?4, ?5, 'Promo ' || ?1, ?3, ?6, ?3, NULL WHERE ${claimed}`
		).bind(code, accountId, now, p.plan, p.kind, endsAt),
		env.DB.prepare(
			`UPDATE promo_redemptions SET grant_id = (SELECT MAX(id) FROM plan_grants WHERE account_id = ?2 AND created_at = ?3 AND note = 'Promo ' || ?1)
			  WHERE code = ?1 AND account_id = ?2 AND redeemed_at = ?3 AND grant_id IS NULL`
		).bind(code, accountId, now)
	]);
	const done = await env.DB.prepare(`SELECT grant_id AS grantId FROM promo_redemptions WHERE code = ?1 AND account_id = ?2 AND redeemed_at = ?3`)
		.bind(code, accountId, now)
		.first<{ grantId: number | null }>();
	if (!done?.grantId) {
		// a same-or-better plan arrived in between, or the last use went to someone else
		const nowBetter = await env.DB.prepare(
			`SELECT 1 AS x FROM plan_grants g JOIN plans pl ON pl.id = g.plan_id WHERE g.account_id = ?2 AND ${liveGrant('?1')} AND pl.rank >= ?3`
		)
			.bind(now, accountId, p.rank)
			.first();
		throw promoError(nowBetter ? 'already_on_plan' : 'used_up');
	}
	return { code, ...(await promoStatus(env, accountId, now)) };
}

/**
 * The promo code for a brand-new account, redeemed on the server as the account is made
 * (worker/auth/passkey.ts registerVerify), so it can't be lost while the first lesson and the
 * consent come first. The code from the link (`?coupon=`) wins, else the one bound to the
 * invite it signed up with. Null when there is none or it can't be redeemed: the app keeps
 * its saved code and says why later (src/routes/+layout.svelte usePromoLink).
 */
export async function signupPromo(env: Env, accountId: number, inviteCode: string | null, coupon: unknown, now = Date.now()): Promise<PromoRedeemed | null> {
	let code = normalizePromo(coupon);
	if (!code && inviteCode) {
		const row = await env.DB.prepare(`SELECT coupon FROM invite_codes WHERE code = ?1`).bind(inviteCode).first<{ coupon: string | null }>();
		code = row?.coupon ?? null;
	}
	if (!code) return null;
	try {
		return await redeem(env, accountId, code, now);
	} catch (e) {
		if (e instanceof HttpError) return null;
		throw e;
	}
}

async function signedIn(req: Request, env: Env) {
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	return s;
}

export async function handlePromo(req: Request, env: Env, path: string): Promise<Response | null> {
	if (path === '/api/promo' && req.method === 'GET') {
		const s = await signedIn(req, env);
		return json(await promoStatus(env, s.userId));
	}
	if (path === '/api/promo/redeem' && req.method === 'POST') {
		const s = await signedIn(req, env);
		const body = (await readJson(req, 1024)) as { code?: unknown } | null;
		if (!(await rateLimit(env, `promo:${s.userId}`, REDEEM_TRIES_PER_HOUR, Date.now(), 60))) throw promoError('rate_limited');
		return json(await redeem(env, s.userId, body?.code));
	}
	return null;
}
