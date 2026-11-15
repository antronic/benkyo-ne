/**
 * Session lifetime, renewed while the app is used.
 *
 * Sign-ins aren't meant to expire for now: the default lifetime is 400 days
 * (the longest a browser keeps a cookie), and every sync pushes it forward
 * again once half of it has passed. The lifetime is a setting, so an admin
 * console can change it without a deploy:
 *
 *   1. `ai_settings` row `session_ttl_days` (D1, read on each renewal), else
 *   2. Worker var `SESSION_TTL_DAYS`, else
 *   3. 400 days.
 *
 * Lowering it takes effect at each device's next sync: sessions that would
 * outlive the new lifetime are cut down to it. Recovery-code sessions stay
 * short (they exist to add a passkey) and are never renewed.
 */
import type { Env } from '../env.ts';
import { getCookie } from '../http.ts';
import { SESSION_COOKIE, sessionCookie, type Session } from './passkey.ts';

export const DEFAULT_SESSION_DAYS = 400;
const MAX_SESSION_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseSessionDays(raw: unknown): number {
	const days = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
	return Number.isFinite(days) && days > 0 ? Math.min(days, MAX_SESSION_DAYS) : DEFAULT_SESSION_DAYS;
}

export async function sessionTtlMs(env: Env): Promise<number> {
	let setting: string | undefined;
	try {
		setting = (
			await env.DB.prepare(`SELECT value FROM ai_settings WHERE key = 'session_ttl_days'`).first<{ value: string }>()
		)?.value;
	} catch {
		/* fall back to the Worker var */
	}
	return parseSessionDays(setting ?? env.SESSION_TTL_DAYS) * DAY_MS;
}

/**
 * Push the session's expiry forward (or cut it down to a newly lowered lifetime).
 * Returns a Set-Cookie value when the cookie needs re-sending, else null.
 */
export async function renewSession(req: Request, env: Env, session: Session): Promise<string | null> {
	if (session.kind === 'recovery' || session.kind === 'dev') return null;
	const token = getCookie(req, SESSION_COOKIE);
	if (!token) return null;
	const ttl = await sessionTtlMs(env);
	const now = Date.now();
	const row = await env.DB.prepare(
		`UPDATE sessions SET expires_at = ?1
		  WHERE token_hash = ?2 AND (expires_at < ?3 OR expires_at > ?1)
		  RETURNING 1 AS ok`
	)
		.bind(now + ttl, session.tokenHash, now + ttl / 2)
		.first<{ ok: number }>();
	return row ? sessionCookie(new URL(req.url), token, Math.floor(ttl / 1000)) : null;
}
