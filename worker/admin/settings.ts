/**
 * Fleet console: settings (PR 3 of the fleet console plan).
 *
 *   GET    /api/admin/settings                     sign-up mode, session lifetime, invites, sign-ups per day
 *   PUT    /api/admin/settings/signup {mode}       'open' | 'closed'                      step-up
 *   PUT    /api/admin/settings/session {days}      1–400, or null for the default         step-up
 *   GET    /api/admin/invites                      → {invites}
 *   POST   /api/admin/invites {code?, label?, maxUses?, expiresInDays?, card?, coupon?}  → AdminInvite (a VIP has a name and a card)
 *   PATCH  /api/admin/invites/:code {card?, coupon?}  a VIP's card and promo code (step-up)
 *   POST   /api/admin/invites/:code/delete         hide it for good (step-up; the row stays)
 *   DELETE /api/admin/invites/:code                revoke
 *
 * Every change is written to admin_audit.
 */
import type { AdminInvite, AdminSettings } from '../../src/lib/admin/contract.ts';
import { DEFAULT_SESSION_DAYS, sessionTtlMs } from '../auth/session.ts';
import { parseCard } from '../invite.ts';
import { normalizePromo, promoKey, promoKeySql } from '../promo.ts';
import { generateInviteCode, isRandomShape, normalizeInvite, setSignupMode, signupState } from '../auth/signup.ts';
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
			`SELECT ${INVITE_COLS} FROM invite_codes WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`
		).all<InviteRow>(),
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
		invites: invites.results.map(toAdminInvite),
		signupsByDay: fillDays(days.results, now)
	};
}

const INVITE_COLS = `code, label, max_uses AS maxUses, uses, expires_at AS expiresAt, created_at AS createdAt, revoked_at AS revokedAt,
	card_note AS cardNote, card_from AS cardFrom, card_ink AS cardInk, coupon`;
async function listInvites(env: Env): Promise<AdminInvite[]> {
	const r = await env.DB.prepare(`SELECT ${INVITE_COLS} FROM invite_codes WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`).all<InviteRow>();
	return r.results.map(toAdminInvite);
}
async function oneInvite(env: Env, code: string): Promise<AdminInvite> {
	const row = await env.DB.prepare(`SELECT ${INVITE_COLS} FROM invite_codes WHERE code = ?1`).bind(code).first<InviteRow>();
	return toAdminInvite(row!);
}

/** A promo code for a VIP: as promo_codes stores it, or null to clear. 400 when there is no such code. */
async function resolveCoupon(env: Env, raw: unknown): Promise<string | null> {
	if (raw === null || raw === undefined || raw === '') return null;
	const c = normalizePromo(raw);
	const row = c && (await env.DB.prepare(`SELECT code FROM promo_codes WHERE ${promoKeySql('code')} = ?1 AND deleted_at IS NULL`).bind(promoKey(c)).first<{ code: string }>());
	if (!row) throw httpError(400, 'bad_request', 'No promo code with that name. Make it in Promo codes first');
	return row.code;
}

type InviteRow = Omit<AdminInvite, 'card'> & { cardNote: string | null; cardFrom: string | null; cardInk: string | null };
function toAdminInvite({ cardNote, cardFrom, cardInk, ...r }: InviteRow): AdminInvite {
	if (!cardNote && !cardInk) return { ...r, coupon: r.coupon ?? null, card: null };
	let ink = null;
	try {
		ink = cardInk ? JSON.parse(cardInk) : null;
	} catch {
		ink = null;
	}
	return { ...r, coupon: r.coupon ?? null, card: { note: cardNote ?? '', from: cardFrom ?? '', ink } };
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
	let code: string | null = null;
	if (b.code !== undefined && b.code !== null && b.code !== '') {
		code = normalizeInvite(b.code);
		if (!code) throw httpError(400, 'bad_request', 'A name is 3 to 20 letters, digits and underscores, starting and ending with a letter or digit');
		if (isRandomShape(code)) throw httpError(400, 'bad_request', 'That name looks like a random invite code. Use another length, or add an underscore');
	}
	const card = b.card === undefined || b.card === null ? null : parseCard(b.card);
	if (card && !code) throw httpError(400, 'bad_request', 'A VIP needs a name, such as VIP or NEWYEAR27');
	return { label, maxUses, expiresInDays: exp, code, card };
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

	if (p === '/api/admin/invites' && m === 'GET') return json({ invites: await listInvites(env) });

	if (p === '/api/admin/invites' && m === 'POST') {
		const raw = (await readJson(req, 96 * 1024)) as Record<string, unknown> | null;
		const input = parseInviteInput(raw);
		const coupon = await resolveCoupon(env, raw?.coupon);
		if (coupon && !input.card) throw httpError(400, 'bad_request', 'Only a VIP (with a card) carries a promo code');
		const now = Date.now();
		const code = input.code ?? generateInviteCode();
		if (input.code && (await env.DB.prepare(`SELECT 1 AS x FROM invite_codes WHERE code = ?1`).bind(code).first()))
			throw httpError(409, 'bad_request', 'An invite with that name exists or was deleted. Names can’t be reused');
		const expiresAt = input.expiresInDays ? now + input.expiresInDays * DAY : null;
		const card = input.card;
		await audited(
			env,
			ctx,
			card ? 'invite.vip' : 'invite.create',
			null,
			{ code, named: !!input.code, label: input.label, maxUses: input.maxUses, expiresAt, ...(card ? { note: card.note, from: card.from, ink: card.ink ? `${card.ink.strokes.length} strokes` : null, coupon } : {}) },
			[
				env.DB.prepare(
					`INSERT INTO invite_codes (code, label, max_uses, expires_at, created_at, created_by, card_note, card_from, card_ink, coupon)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
				).bind(code, input.label, input.maxUses, expiresAt, now, ctx.session.userId, card?.note || null, card?.from || null, card?.ink ? JSON.stringify(card.ink) : null, coupon)
			]
		);
		return json(await oneInvite(env, code));
	}

	// Delete hides an invite: it can't be used and isn't listed; its row stays (accounts.invite_code, the audit log)
	const del = /^\/api\/admin\/invites\/([A-Za-z0-9_-]{3,20})\/delete$/.exec(p);
	if (del && m === 'POST') {
		const code = normalizeInvite(decodeURIComponent(del[1]));
		const row =
			code &&
			(await env.DB.prepare(`SELECT code, uses, card_note IS NOT NULL OR card_ink IS NOT NULL AS vip FROM invite_codes WHERE code = ?1 AND deleted_at IS NULL`)
				.bind(code)
				.first<{ code: string; uses: number; vip: number }>());
		if (!row) throw httpError(404, 'bad_request', 'No such invite');
		await requireFresh(env, ctx);
		await audited(env, ctx, 'invite.delete', null, { code: row.code, vip: !!row.vip, uses: row.uses }, [
			env.DB.prepare(`UPDATE invite_codes SET deleted_at = ?1 WHERE code = ?2`).bind(Date.now(), row.code)
		]);
		return json({ ok: true });
	}

	const inv = /^\/api\/admin\/invites\/([A-Za-z0-9_-]{3,20})$/.exec(p);
	if (inv && m === 'PATCH') {
		const code = normalizeInvite(decodeURIComponent(inv[1]));
		const before =
			code &&
			(await env.DB.prepare(`SELECT card_note AS note, card_from AS fromName, card_ink IS NOT NULL AS hasInk, coupon FROM invite_codes WHERE code = ?1 AND deleted_at IS NULL`)
				.bind(code)
				.first<{ note: string | null; fromName: string | null; hasInk: number; coupon: string | null }>());
		if (!code || !before) throw httpError(404, 'bad_request', 'No such invite');
		const body = ((await readJson(req, 96 * 1024)) ?? {}) as { card?: unknown; coupon?: unknown };
		if (!('card' in body) && !('coupon' in body)) throw httpError(400, 'bad_request', 'Nothing to change');
		const sets: string[] = [];
		const args: unknown[] = [];
		const detail: Record<string, unknown> = { code };
		let action = 'invite.coupon';
		if ('card' in body) {
			const card = parseCard(body.card);
			sets.push('card_note = ?', 'card_from = ?', 'card_ink = ?');
			args.push(card?.note || null, card?.from || null, card?.ink ? JSON.stringify(card.ink) : null);
			Object.assign(detail, { note: card?.note ?? null, from: card?.from ?? null, ink: card?.ink ? `${card.ink.strokes.length} strokes` : null });
			action = card ? 'invite.card' : 'invite.card.clear';
		}
		if ('coupon' in body) {
			const coupon = await resolveCoupon(env, body.coupon);
			sets.push('coupon = ?');
			args.push(coupon);
			detail.coupon = coupon;
		}
		detail.before = { note: before.note, from: before.fromName, ink: !!before.hasInk, coupon: before.coupon };
		await requireFresh(env, ctx);
		await audited(env, ctx, action, null, detail, [
			env.DB.prepare(`UPDATE invite_codes SET ${sets.join(', ')} WHERE code = ?`).bind(...args, code)
		]);
		return json(await oneInvite(env, code));
	}
	if (inv && m === 'DELETE') {
		const code = normalizeInvite(decodeURIComponent(inv[1]));
		const row = code && (await env.DB.prepare(`SELECT 1 AS x FROM invite_codes WHERE code = ?1 AND revoked_at IS NULL AND deleted_at IS NULL`).bind(code).first());
		if (!row) throw httpError(404, 'bad_request', 'No such invite, or it is already revoked');
		await audited(env, ctx, 'invite.revoke', null, { code }, [
			env.DB.prepare(`UPDATE invite_codes SET revoked_at = ?1 WHERE code = ?2`).bind(Date.now(), code)
		]);
		return json({ ok: true });
	}
	return null;
}
