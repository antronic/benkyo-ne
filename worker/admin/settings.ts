/**
 * Fleet console: settings (PR 3 of the fleet console plan).
 *
 *   GET    /api/admin/settings                     sign-up mode, session lifetime, invites, sign-ups per day
 *   PUT    /api/admin/settings/signup {mode}       'open' | 'closed'                      step-up
 *   PUT    /api/admin/settings/session {days}      1–400, or null for the default         step-up
 *   POST   /api/admin/invites {label?, maxUses?, expiresInDays?}  → AdminInvite
 *   DELETE /api/admin/invites/:code                revoke
 *
 * Every change is written to admin_audit.
 */
import type { AdminInvite, AdminSettings } from '../../src/lib/admin/contract.ts';
import { DEFAULT_SESSION_DAYS, sessionTtlMs } from '../auth/session.ts';
import { generateInviteCode, normalizeInvite, setSignupMode, signupState } from '../auth/signup.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_INVITE_USES = 100;
export const MAX_SESSION_DAYS = 400;

/** The last `n` UTC days (oldest first) with zero-filled counts. */
export function fillDays(rows: { day: string; count: number }[], now: number, n = 30) {
	const byDay = new Map(rows.map((r) => [r.day, r.count]));
	const out: { day: string; count: number }[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const day = new Date(now - i * DAY).toISOString().slice(0, 10);
		out.push({ day, count: byDay.get(day) ?? 0 });
	}
	return out;
}

async function settings(env: Env): Promise<AdminSettings> {
	const now = Date.now();
	const since = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - 29 * DAY;
	const [signup, effective, session, invites, days] = await Promise.all([
		signupState(env),
		sessionTtlMs(env),
		env.DB.prepare(`SELECT value FROM ai_settings WHERE key = 'session_ttl_days'`).first<{ value: string }>(),
		env.DB.prepare(
			`SELECT code, label, max_uses AS maxUses, uses, expires_at AS expiresAt, created_at AS createdAt, revoked_at AS revokedAt
			   FROM invite_codes ORDER BY created_at DESC LIMIT 200`
		).all<AdminInvite>(),
		env.DB.prepare(
			`SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
			   FROM accounts WHERE created_at >= ?1 GROUP BY day`
		)
			.bind(since)
			.all<{ day: string; count: number }>()
	]);
	const days_ = session?.value ? Number(session.value) : null;
	return {
		signup: { mode: signup.mode, hardClosed: signup.hardClosed },
		session: {
			days: days_ !== null && Number.isFinite(days_) ? days_ : null,
			effectiveDays: Math.round(effective / DAY),
			defaultDays: DEFAULT_SESSION_DAYS
		},
		invites: invites.results,
		signupsByDay: fillDays(days.results, now)
	};
}

export function parseInviteInput(body: unknown) {
	const b = (body ?? {}) as Record<string, unknown>;
	const label = typeof b.label === 'string' ? b.label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) || null : null;
	const maxUses = b.maxUses === undefined ? 1 : Number(b.maxUses);
	if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_INVITE_USES)
		throw httpError(400, 'bad_request', `An invite can be used 1 to ${MAX_INVITE_USES} times`);
	const exp = b.expiresInDays === undefined || b.expiresInDays === null ? null : Number(b.expiresInDays);
	if (exp !== null && (!Number.isFinite(exp) || exp <= 0 || exp > 365))
		throw httpError(400, 'bad_request', 'Expiry must be 1 to 365 days, or none');
	return { label, maxUses, expiresInDays: exp };
}

export async function handleSettings(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	if (p === '/api/admin/settings' && m === 'GET') return json(await settings(env));

	if (p === '/api/admin/settings/signup' && m === 'PUT') {
		const { mode } = ((await readJson(req, 1024)) ?? {}) as { mode?: unknown };
		if (mode !== 'open' && mode !== 'closed') throw httpError(400, 'bad_request', 'Mode must be open or closed');
		await requireFresh(env, ctx);
		const before = (await signupState(env)).mode;
		await audited(env, ctx, 'signup.mode', null, { from: before, to: mode }, [await setSignupMode(env, mode, ctx.session.userId)]);
		return json(await settings(env));
	}

	if (p === '/api/admin/settings/session' && m === 'PUT') {
		const { days } = ((await readJson(req, 1024)) ?? {}) as { days?: unknown };
		if (days !== null && (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_SESSION_DAYS))
			throw httpError(400, 'bad_request', `Session lifetime must be 1 to ${MAX_SESSION_DAYS} days, or the default`);
		await requireFresh(env, ctx);
		const before = await env.DB.prepare(`SELECT value FROM ai_settings WHERE key = 'session_ttl_days'`).first<{ value: string }>();
		await audited(env, ctx, 'session.lifetime', null, { from: before ? Number(before.value) : null, to: days }, [
			days === null
				? env.DB.prepare(`DELETE FROM ai_settings WHERE key = 'session_ttl_days'`)
				: env.DB.prepare(
						`INSERT INTO ai_settings (key, value) VALUES ('session_ttl_days', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1`
					).bind(String(days))
		]);
		return json(await settings(env));
	}

	if (p === '/api/admin/invites' && m === 'POST') {
		const input = parseInviteInput(await readJson(req, 2048));
		const now = Date.now();
		const code = generateInviteCode();
		const expiresAt = input.expiresInDays ? now + input.expiresInDays * DAY : null;
		await audited(env, ctx, 'invite.create', null, { code, label: input.label, maxUses: input.maxUses, expiresAt }, [
			env.DB.prepare(
				`INSERT INTO invite_codes (code, label, max_uses, expires_at, created_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
			).bind(code, input.label, input.maxUses, expiresAt, now, ctx.session.userId)
		]);
		return json({ code, label: input.label, maxUses: input.maxUses, uses: 0, expiresAt, createdAt: now, revokedAt: null } satisfies AdminInvite);
	}

	const inv = /^\/api\/admin\/invites\/([A-Za-z0-9-]{8,20})$/.exec(p);
	if (inv && m === 'DELETE') {
		const code = normalizeInvite(decodeURIComponent(inv[1]));
		const row = code && (await env.DB.prepare(`SELECT 1 AS x FROM invite_codes WHERE code = ?1 AND revoked_at IS NULL`).bind(code).first());
		if (!row) throw httpError(404, 'bad_request', 'No such invite, or it is already revoked');
		await audited(env, ctx, 'invite.revoke', null, { code }, [
			env.DB.prepare(`UPDATE invite_codes SET revoked_at = ?1 WHERE code = ?2`).bind(Date.now(), code)
		]);
		return json({ ok: true });
	}
	return null;
}
