/**
 * Alternative Worker entry that serves the built PWA from files bundled into
 * the script, instead of Workers Static Assets.
 *
 * Why: some CI/sandbox networks rewrite the Authorization header, which breaks
 * Wrangler's asset-upload step (it authenticates with a short-lived upload
 * JWT). A script-only upload works in those networks. The trade-off is that
 * static requests now invoke the Worker and count toward the free plan's
 * 100k requests/day. Prefer the normal `wrangler.jsonc` deploy (Workers
 * Builds) when it's available; both use the same Worker name and domain.
 *
 * Generated input: worker/.embed/assets.js (scripts/embed-assets.mjs).
 */
import { handleApi, type Env } from './index.ts';
// @ts-expect-error generated at build time
import { ASSETS } from './.embed/assets.js';

interface Asset {
	type: string;
	body: string;
	b64: boolean;
	etag: string;
}
const files = ASSETS as Record<string, Asset>;

const decoded = new Map<string, Uint8Array>();
function bytes(path: string, a: Asset): Uint8Array | string {
	if (!a.b64) return a.body;
	let d = decoded.get(path);
	if (!d) {
		d = Uint8Array.from(atob(a.body), (c) => c.charCodeAt(0));
		decoded.set(path, d);
	}
	return d;
}

function cacheControl(path: string) {
	if (path.startsWith('/_app/immutable/')) return 'public, max-age=31536000, immutable';
	if (path === '/service-worker.js' || path.endsWith('.html')) return 'no-cache';
	return 'public, max-age=3600';
}

function serve(req: Request, path: string): Response | null {
	const a = files[path];
	if (!a) return null;
	const headers = new Headers({
		'content-type': a.type,
		'cache-control': cacheControl(path),
		etag: a.etag,
		'x-content-type-options': 'nosniff',
		'referrer-policy': 'strict-origin-when-cross-origin',
		'permissions-policy': 'camera=(), microphone=(), geolocation=()'
	});
	if (req.headers.get('if-none-match') === a.etag) return new Response(null, { status: 304, headers });
	return new Response(req.method === 'HEAD' ? null : bytes(path, a), { headers });
}

export default {
	async fetch(req, env, ctx): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname.startsWith('/api/')) return handleApi(req, env, ctx);
		if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

		const path = decodeURIComponent(url.pathname);
		return (
			serve(req, path) ??
			serve(req, path.endsWith('/') ? `${path}index.html` : `${path}.html`) ??
			// SPA fallback for client-side routes; real missing files 404.
			(/\.[a-z0-9]+$/i.test(path) ? new Response('Not found', { status: 404 }) : serve(req, '/index.html')!)
		);
	}
} satisfies ExportedHandler<Env>;
