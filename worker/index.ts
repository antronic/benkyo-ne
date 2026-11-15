/**
 * Benkyo Worker — serves the static PWA (Workers Static Assets, free and
 * unmetered) and a tiny JSON API backed by D1 + KV.
 *
 *   POST /api/sync      push review logs (+ user cards), pull since cursors (D1)
 *   GET  /api/content   content manifest/version                   (KV + Cache API)
 *   GET  /api/health
 *   /api/auth/*         passkey auth (worker/auth/passkey.ts), Sign in with Apple (worker/auth/apple.ts)
 *   /api/ai/*           AI features behind the passkey session (worker/ai/routes.ts)
 *
 * Everything else falls through to static assets (SPA fallback configured
 * in wrangler.jsonc).
 */

import { handleAi } from './ai/routes.ts';
import { handleAuth } from './auth/passkey.ts';
import { MAX_CARDS_PUSH, pullCards, upsertCardStatements, validCard } from './cards.ts';
import type { Env } from './env.ts';
import { HttpError, json } from './http.ts';
import type { UserCard } from '../src/lib/ai/contract.ts';

export type { Env } from './env.ts';

interface LogIn {
	id: string;
	cardId: string;
	grade: number;
	reviewedAt: number;
	elapsedDays: number;
	durationMs: number;
}

const MAX_PUSH = 500;
const MAX_PULL = 1000;

async function sha256(text: string) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const validLog = (l: LogIn) =>
	typeof l?.id === 'string' &&
	l.id.length <= 64 &&
	typeof l.cardId === 'string' &&
	l.cardId.length <= 64 &&
	Number.isInteger(l.grade) &&
	l.grade >= 1 &&
	l.grade <= 4 &&
	Number.isFinite(l.reviewedAt) &&
	Number.isFinite(l.elapsedDays) &&
	Number.isFinite(l.durationMs);

async function handleSync(req: Request, env: Env): Promise<Response> {
	const auth = req.headers.get('authorization') ?? '';
	const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (key.length < 24 || key.length > 128) return json({ error: 'bad key' }, { status: 401 });

	let body: { cursor?: number; logs?: LogIn[]; cards?: UserCard[]; cardsCursor?: number };
	try {
		body = await req.json();
	} catch {
		return json({ error: 'bad json' }, { status: 400 });
	}
	const logs = Array.isArray(body.logs) ? body.logs.slice(0, MAX_PUSH) : [];
	if (!logs.every(validLog)) return json({ error: 'bad log entry' }, { status: 400 });
	const cursor = Number.isInteger(body.cursor) ? Number(body.cursor) : 0;
	// User cards are optional; clients that don't send them get the old response shape.
	const withCards = body.cards !== undefined || body.cardsCursor !== undefined;
	const cards = Array.isArray(body.cards) ? body.cards.slice(0, MAX_CARDS_PUSH) : [];
	if (!cards.every(validCard)) return json({ error: 'bad card' }, { status: 400 });
	const cardsCursor = Number.isInteger(body.cardsCursor) ? Number(body.cardsCursor) : 0;

	const now = Date.now();
	const hash = await sha256(key);
	// Upsert the user; first sync with a new key creates the account.
	const user = await env.DB.prepare(
		`INSERT INTO users (sync_key_hash, created_at, last_seen_at) VALUES (?1, ?2, ?2)
		 ON CONFLICT (sync_key_hash) DO UPDATE SET last_seen_at = ?2
		 RETURNING id`
	)
		.bind(hash, now)
		.first<{ id: number }>();
	if (!user) return json({ error: 'user' }, { status: 500 });

	if (logs.length) {
		const stmt = env.DB.prepare(
			`INSERT OR IGNORE INTO review_log (user_id, id, card_id, grade, reviewed_at, elapsed_days, duration_ms)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
		);
		await env.DB.batch(
			logs.map((l) =>
				stmt.bind(user.id, l.id, l.cardId, l.grade, l.reviewedAt, l.elapsedDays, Math.round(l.durationMs))
			)
		);
	}

	const { results } = await env.DB.prepare(
		`SELECT seq, id, card_id AS cardId, grade, reviewed_at AS reviewedAt,
		        elapsed_days AS elapsedDays, duration_ms AS durationMs
		   FROM review_log WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`
	)
		.bind(user.id, cursor, MAX_PULL)
		.all<LogIn & { seq: number }>();

	if (cards.length) await env.DB.batch(upsertCardStatements(env.DB, user.id, cards));

	const next = results.length ? results[results.length - 1].seq : cursor;
	const out: Record<string, unknown> = { cursor: next, logs: results.map(({ seq: _s, ...l }) => l) };
	if (withCards) Object.assign(out, await pullCards(env.DB, user.id, cardsCursor));
	return json(out);
}

async function handleContent(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	// Edge cache first (free), then KV (100k reads/day free), then a default.
	const cache = caches.default;
	const hit = await cache.match(req);
	if (hit) return hit;
	const manifest = (await env.CONTENT.get('manifest', 'json')) ?? { version: 1, packs: ['kana'] };
	const res = json(manifest, { headers: { 'cache-control': 'public, max-age=300' } });
	ctx.waitUntil(cache.put(req, res.clone()));
	return res;
}

/** Handle /api/* requests. Shared by both deploy modes. */
export async function handleApi(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const url = new URL(req.url);
	try {
		const p = url.pathname;
		if (p.startsWith('/api/auth/') || p.startsWith('/api/ai/')) {
			// CSRF: SameSite=Strict cookie, plus same-origin check on writes. The one exception is
			// Apple's form_post back to us, which is cross-site by design and checked instead by
			// its single-use state cookie (worker/auth/apple.ts).
			const origin = req.headers.get('origin');
			const appleCallback = p === '/api/auth/apple/callback' && (origin === 'https://appleid.apple.com' || origin === 'null');
			if (req.method !== 'GET' && req.method !== 'HEAD' && origin && origin !== url.origin && !appleCallback)
				return json({ error: 'unauthorized', message: 'Cross-origin request' }, { status: 403 });
			if (p.startsWith('/api/ai/')) return await handleAi(req, env, ctx, url);
			const res = await handleAuth(req, env, p);
			if (res) return res;
		}
		if (url.pathname === '/api/sync' && req.method === 'POST') return await handleSync(req, env);
		if (url.pathname === '/api/content' && req.method === 'GET') return await handleContent(req, env, ctx);
		if (url.pathname === '/api/health') return json({ ok: true });
		return json({ error: 'not found' }, { status: 404 });
	} catch (e) {
		if (e instanceof HttpError) return json(e.body, { status: e.status });
		console.error(e);
		return json({ error: 'server' }, { status: 500 });
	}
}

export default {
	async fetch(req, env, ctx): Promise<Response> {
		const url = new URL(req.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS!.fetch(req);
		return handleApi(req, env, ctx);
	}
} satisfies ExportedHandler<Env>;
