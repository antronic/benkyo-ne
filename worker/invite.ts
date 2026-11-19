/**
 * Invite cards (VIP invites): a named invite can carry a note, who it's from
 * and handwriting; /invite/<name> shows them as a card before sign-up.
 *
 *   GET /api/auth/invite/:code[?coupon=CODE]   the card, and what the coupon gives   signed out, 30 a minute per IP
 *
 * Fleet sets the card with PATCH /api/admin/invites/:code (worker/admin/settings.ts).
 * Only live invites with a card answer, so this reveals no more than the link does.
 */
import type { InviteCardData, InviteCardResponse } from '../src/lib/invite/contract.ts';
import { CARD_FROM_MAX, CARD_NOTE_MAX } from '../src/lib/invite/contract.ts';
import type { Ink, InkPoint } from '../src/lib/ui/ink.ts';
import { rateLimit } from './ai/ledger.ts';
import { clientIp } from './auth/passkey.ts';
import { normalizeInvite } from './auth/signup.ts';
import type { Env } from './env.ts';
import { httpError, json } from './http.ts';
import { normalizePromo, promoKey, promoKeySql, redeemable } from './promo.ts';

export const MAX_STROKES = 80;
export const MAX_POINTS = 4000;
const MAX_MS = 120_000;

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max) : '');

/** Handwriting from Fleet, checked and rounded; null when there is none. Throws 400 on a bad shape. */
export function parseInk(raw: unknown): Ink | null {
	if (raw === null || raw === undefined) return null;
	const bad = () => httpError(400, 'bad_request', 'That handwriting couldn’t be read. Clear it and draw again');
	const r = raw as { aspect?: unknown; strokes?: unknown };
	const aspect = Number(r.aspect);
	if (!Number.isFinite(aspect) || aspect < 0.5 || aspect > 5 || !Array.isArray(r.strokes)) throw bad();
	if (r.strokes.length > MAX_STROKES) throw httpError(400, 'bad_request', `Handwriting can have up to ${MAX_STROKES} strokes`);
	let points = 0;
	const strokes: InkPoint[][] = [];
	for (const s of r.strokes) {
		if (!Array.isArray(s) || !s.length) throw bad();
		points += s.length;
		if (points > MAX_POINTS) throw httpError(400, 'bad_request', 'That drawing is too detailed. Draw it a little simpler');
		strokes.push(
			s.map((p) => {
				if (!Array.isArray(p) || p.length !== 3) throw bad();
				const [x, y, t] = p.map(Number);
				if (![x, y, t].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || t < 0 || t > MAX_MS) throw bad();
				return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(t)] as InkPoint;
			})
		);
	}
	return strokes.length ? { aspect: Math.round(aspect * 1000) / 1000, strokes } : null;
}

/** A card from Fleet; null clears it. Throws 400 when it says nothing. */
export function parseCard(raw: unknown): InviteCardData | null {
	if (raw === null) return null;
	const c = (raw ?? {}) as Record<string, unknown>;
	const note = clean(c.note, CARD_NOTE_MAX);
	const from = clean(c.from, CARD_FROM_MAX);
	const ink = parseInk(c.ink);
	if (!note && !ink) throw httpError(400, 'bad_request', 'Write a note or draw something for the card');
	return { note, from, ink };
}

const VALID = `revoked_at IS NULL AND uses < max_uses AND (expires_at IS NULL OR expires_at > ?2)`;

export async function inviteCard(env: Env, rawCode: string, rawCoupon: string | null, now = Date.now()): Promise<InviteCardResponse | null> {
	const code = normalizeInvite(rawCode);
	if (!code) return null;
	const row = await env.DB.prepare(`SELECT code, card_note AS note, card_from AS fromName, card_ink AS ink FROM invite_codes WHERE code = ?1 AND ${VALID}`)
		.bind(code, now)
		.first<{ code: string; note: string | null; fromName: string | null; ink: string | null }>();
	if (!row || (!row.note && !row.ink)) return null;
	let ink: Ink | null = null;
	try {
		ink = row.ink ? (JSON.parse(row.ink) as Ink) : null;
	} catch {
		ink = null;
	}
	let perk: InviteCardResponse['perk'] = null;
	const coupon = normalizePromo(rawCoupon);
	if (coupon) {
		const p = await env.DB.prepare(
			`SELECT pl.name AS planName, p.kind, p.days FROM promo_codes p JOIN plans pl ON pl.id = p.plan_id WHERE ${promoKeySql('p.code')} = ?1 AND ${redeemable('?2')}`
		)
			.bind(promoKey(coupon), now)
			.first<{ planName: string; kind: 'comp' | 'trial'; days: number | null }>();
		if (p) perk = p;
	}
	return { code: row.code, card: { note: row.note ?? '', from: row.fromName ?? '', ink }, perk };
}

export async function handleInviteCard(req: Request, env: Env, url: URL): Promise<Response | null> {
	const m = /^\/api\/auth\/invite\/([A-Za-z0-9_-]{3,24})$/.exec(url.pathname);
	if (!m || req.method !== 'GET') return null;
	if (!(await rateLimit(env, `invitecard:${clientIp(req)}`, 30))) throw httpError(429, 'rate_limited', 'Too many tries. Wait a minute');
	const r = await inviteCard(env, decodeURIComponent(m[1]), url.searchParams.get('coupon'));
	if (!r) throw httpError(404, 'bad_request', 'No card for that invite');
	return json(r);
}
