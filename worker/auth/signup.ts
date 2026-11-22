/**
 * Who may create an account (fleet console PR 3).
 *
 *   1. Worker var SIGNUP_MODE=closed: nobody, not even with an invite.
 *      An emergency stop that works without the console or D1.
 *   2. Else app_settings `signup_mode` (set in the fleet console):
 *      'open' (default) lets anyone sign up; 'closed' needs an invite code.
 *
 * The setting is cached per isolate for 30 s, so a change in the console
 * reaches every isolate within half a minute.
 */
import type { Env } from '../env.ts';
import { httpError } from '../http.ts';

export type SignupMode = 'open' | 'closed';
export interface SignupState {
	/** anyone can sign up */
	open: boolean;
	/** sign-up needs an invite code (closed in the console, not by the Worker var) */
	invite: boolean;
	/** what the console set */
	mode: SignupMode;
	/** SIGNUP_MODE=closed on the Worker overrides the console */
	hardClosed: boolean;
}

const CACHE_MS = 30_000;
let cache: { at: number; mode: SignupMode } | null = null;
export const _clearSignupCache = () => (cache = null);

export async function consoleSignupMode(env: Env): Promise<SignupMode> {
	if (cache && Date.now() - cache.at < CACHE_MS) return cache.mode;
	let mode: SignupMode = 'open';
	try {
		const row = await env.DB.prepare(`SELECT value FROM app_settings WHERE key = 'signup_mode'`).first<{ value: string }>();
		if (row?.value === 'closed') mode = 'closed';
	} catch {
		/* table missing before the migration: open, as before */
	}
	cache = { at: Date.now(), mode };
	return mode;
}

export async function signupState(env: Env): Promise<SignupState> {
	const hardClosed = (env.SIGNUP_MODE ?? 'open') === 'closed';
	const mode = await consoleSignupMode(env);
	return { open: !hardClosed && mode === 'open', invite: !hardClosed && mode === 'closed', mode, hardClosed };
}

export async function setSignupMode(env: Env, mode: SignupMode, by: number) {
	cache = null;
	return env.DB.prepare(
		`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('signup_mode', ?1, ?2, ?3)
		 ON CONFLICT (key) DO UPDATE SET value = ?1, updated_at = ?2, updated_by = ?3`
	).bind(mode, Date.now(), by);
}

// ---------------------------------------------------------------- invites ----

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O, 1/I

export function generateInviteCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const s = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
	return `BK-${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * A random code: "bk 7kq2 mx9d" → "BK-7KQ2-MX9D". A named one, made in Fleet
 * (Job, 2026-11-19, for links like /invite/vip): " vip " → "VIP", 3 to 20
 * letters, digits and underscores, starting and ending with a letter or digit.
 * Anything with 8 letters and digits after an optional BK is read as random,
 * so Fleet refuses a name of that shape (`isRandomShape`). null when it can't be a code.
 */
export function normalizeInvite(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > 64) return null;
	const s = raw.toUpperCase();
	if (!s.includes('_')) {
		const alnum = s.replace(/[^0-9A-Z]/g, '');
		const body = alnum.startsWith('BK') && alnum.length === 10 ? alnum.slice(2) : alnum;
		if (/^[0-9A-Z]{8}$/.test(body)) return `BK-${body.slice(0, 4)}-${body.slice(4)}`;
	}
	const named = s.replace(/[\s\-.]/g, '');
	return /^[0-9A-Z][0-9A-Z_]{1,18}[0-9A-Z]$/.test(named) ? named : null;
}

/** A name that would be read as a random code (8 letters and digits, or BK + 8). */
export const isRandomShape = (code: string) => /^BK-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code);

/**
 * SQL on invite_codes: every use is taken, the invite's own or, for a VIP with a
 * promo code, the code's last redemption (Job, 2026-11-19: a VIP turns off once
 * its quota is used). Raising either limit turns it back on.
 */
export const INVITE_USED_UP = `(invite_codes.uses >= invite_codes.max_uses OR EXISTS (SELECT 1 FROM promo_codes pc WHERE pc.code = invite_codes.coupon AND pc.max_uses IS NOT NULL AND pc.uses >= pc.max_uses))`;
/** SQL on invite_codes: the invite can still be used at ?2. */
export const INVITE_VALID = `invite_codes.deleted_at IS NULL AND invite_codes.revoked_at IS NULL AND NOT ${INVITE_USED_UP} AND (invite_codes.expires_at IS NULL OR invite_codes.expires_at > ?2)`;
const VALID = INVITE_VALID;

/** The code exists and still has a use left. */
export const inviteUsable = async (env: Env, code: string | null) =>
	!!code && !!(await env.DB.prepare(`SELECT 1 AS ok FROM invite_codes WHERE code = ?1 AND ${VALID}`).bind(code, Date.now()).first());

/** Throws 403 unless the code exists and still has a use left. */
export async function checkInvite(env: Env, code: string | null) {
	if (!(await inviteUsable(env, code))) throw httpError(403, 'unauthorized', 'That invite code isn’t valid (it may be used up or expired)');
}

/** Use up one use of the code; false when it was used up in the meantime. */
export async function consumeInvite(env: Env, code: string): Promise<boolean> {
	const row = await env.DB.prepare(`UPDATE invite_codes SET uses = uses + 1 WHERE code = ?1 AND ${VALID} RETURNING code`)
		.bind(code, Date.now())
		.first();
	return !!row;
}
