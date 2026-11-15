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
		if (p.startsWith('/api/auth/') || p.startsWith('/api/ai/') || p.startsWith('/api/beta/') || p.startsWith('/api/admin/')) {
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
}

export default {
	async fetch(req, env, ctx): Promise<Response> {
		const url = new URL(req.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS!.fetch(req);
		return handleApi(req, env, ctx);
	},
	async scheduled(_event, env, ctx) {
		ctx.waitUntil(handleScheduled(env));
	}
} satisfies ExportedHandler<Env>;
