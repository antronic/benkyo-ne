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

/** "bk 7kq2 mx9d" → "BK-7KQ2-MX9D"; null when it can't be a code. */
export function normalizeInvite(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
	const body = s.startsWith('BK') ? s.slice(2) : s;
	return /^[0-9A-Z]{8}$/.test(body) ? `BK-${body.slice(0, 4)}-${body.slice(4)}` : null;
}

const VALID = `revoked_at IS NULL AND uses < max_uses AND (expires_at IS NULL OR expires_at > ?2)`;

/** Throws 403 unless the code exists and still has a use left. */
export async function checkInvite(env: Env, code: string | null) {
	const ok = code && (await env.DB.prepare(`SELECT 1 AS ok FROM invite_codes WHERE code = ?1 AND ${VALID}`).bind(code, Date.now()).first());
	if (!ok) throw httpError(403, 'unauthorized', 'That invite code isn’t valid (it may be used up or expired)');
}

/** Use up one use of the code; false when it was used up in the meantime. */
export async function consumeInvite(env: Env, code: string): Promise<boolean> {
	const row = await env.DB.prepare(`UPDATE invite_codes SET uses = uses + 1 WHERE code = ?1 AND ${VALID} RETURNING code`)
		.bind(code, Date.now())
		.first();
	return !!row;
}
