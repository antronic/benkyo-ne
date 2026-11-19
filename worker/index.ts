/**
 * Benkyo Worker — serves the static PWA (Workers Static Assets, free and
 * unmetered) and a tiny JSON API backed by D1 + KV.
 *
 *   POST /api/sync      push review logs (+ user cards), pull since cursors (D1)
 *   GET  /api/content   content manifest/version                   (KV + Cache API)
 *   GET  /api/health
 *   /api/auth/*         passkey auth (worker/auth/passkey.ts), Sign in with Apple (worker/auth/apple.ts)
 *   /api/ai/*           AI features behind the passkey session (worker/ai/routes.ts)
 *   /api/beta/*         beta consent and usage data (worker/beta/routes.ts)
 *   /api/auth/invite/:c invite card for /invite links, signed out (worker/invite.ts)
 *   /api/promo/*        promo codes: the account's package, redeem a code (worker/promo.ts)
 *   /api/community/*    shared notes, replies, likes, reports, blocks (worker/community.ts)
 *   /api/admin/*        fleet console, admin only, behind Cloudflare Access (worker/admin/routes.ts)
 *
 * Everything else falls through to static assets (SPA fallback configured
 * in wrangler.jsonc).
 */

import { handleAdmin } from './admin/routes.ts';
import { handleAi } from './ai/routes.ts';
import { handleAuth } from './auth/passkey.ts';
import { handleBeta, purgeOld } from './beta/routes.ts';
import type { Env } from './env.ts';
import { HttpError, json } from './http.ts';
import { handleCommunity, purgeCommunity } from './community.ts';
import { handlePromo } from './promo.ts';
import { handleInviteCard } from './invite.ts';
import { handleSync } from './sync.ts';

export type { Env } from './env.ts';

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
		if (p.startsWith('/api/auth/') || p.startsWith('/api/ai/') || p.startsWith('/api/beta/') || p.startsWith('/api/admin/') || p.startsWith('/api/promo') || p.startsWith('/api/community/')) {
			// CSRF: SameSite=Strict cookie, plus same-origin check on writes. The one exception is
			// Apple's form_post back to us, which is cross-site by design and checked instead by
			// its single-use state cookie (worker/auth/apple.ts).
			const origin = req.headers.get('origin');
			const appleCallback = p === '/api/auth/apple/callback' && (origin === 'https://appleid.apple.com' || origin === 'null');
			if (req.method !== 'GET' && req.method !== 'HEAD' && origin && origin !== url.origin && !appleCallback)
				return json({ error: 'unauthorized', message: 'Cross-origin request' }, { status: 403 });
			if (p.startsWith('/api/ai/')) return await handleAi(req, env, ctx, url);
			if (p.startsWith('/api/beta/')) {
				const res = await handleBeta(req, env, p);
				if (res) return res;
				return json({ error: 'not found' }, { status: 404 });
			}
			if (p.startsWith('/api/admin/')) return await handleAdmin(req, env, url);
			if (p.startsWith('/api/promo')) {
				const res = await handlePromo(req, env, p);
				if (res) return res;
				return json({ error: 'not found' }, { status: 404 });
			}
			if (p.startsWith('/api/community/')) {
				const res = await handleCommunity(req, env, url);
				if (res) return res;
				return json({ error: 'not found' }, { status: 404 });
			}
			if (p.startsWith('/api/auth/invite/')) {
				const card = await handleInviteCard(req, env, url);
				if (card) return card;
			}
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

/** Daily cron (wrangler.jsonc "triggers"): retention clean-up. Shared by both deploy modes. */
export async function handleScheduled(env: Env) {
	const n = await purgeOld(env);
	console.log(`beta retention: deleted ${n.events} events, ${n.aiCalls} AI calls`);
	const c = await purgeCommunity(env);
	console.log(`community retention: deleted ${c.posts} posts, ${c.replies} replies, ${c.reports} reports`);
}

/**
 * Static files. Unknown paths fall back to index.html so client routes work, but an app file
 * (/_app/...) that doesn't exist must be a 404: served as HTML it breaks the script that asked
 * for it, and the service worker would keep that page under the script's URL.
 * (wrangler.jsonc sends /_app/* through the worker for this.)
 */
export async function serveAsset(req: Request, url: URL, env: Env): Promise<Response> {
	const res = await env.ASSETS!.fetch(req);
	if (url.pathname.startsWith('/_app/') && (res.headers.get('content-type') ?? '').includes('text/html'))
		return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
	if (url.pathname.startsWith('/_app/immutable/') && res.ok) {
		// static/_headers rules may not reach responses that pass through the worker: restate them
		const out = new Response(res.body, res);
		out.headers.set('cache-control', 'public, max-age=31536000, immutable');
		out.headers.set('x-content-type-options', 'nosniff');
		return out;
	}
	return res;
}

export default {
	async fetch(req, env, ctx): Promise<Response> {
		const url = new URL(req.url);
		if (!url.pathname.startsWith('/api/')) return serveAsset(req, url, env);
		return handleApi(req, env, ctx);
	},
	async scheduled(_event, env, ctx) {
		ctx.waitUntil(handleScheduled(env));
	}
} satisfies ExportedHandler<Env>;
