/**
 * Offline strategy (docs/PLAN.md §8.3)
 *   app shell + build output + static files → precached per deploy (cache-first)
 *   navigations                             → network, falling back to cached index.html
 *   /api/*                                  → network only (sync retries from the app)
 *   /audio/*                                → cache-first, kept across deploys
 *   anything else same-origin GET           → stale-while-revalidate
 */
import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const SHELL = `shell-${version}`;
const RUNTIME = 'runtime-v1';
const AUDIO = 'audio-v1';

const PRECACHE = ['/', ...immutable.map((f) => f.path), ...assets.map((f) => f.path)].map((p) =>
	p.startsWith('/') ? p : `/${p}`
);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((c) => c.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return;
	if (url.pathname.startsWith('/api/')) return; // network only

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(async () => (await caches.match('/', { cacheName: SHELL })) ?? Response.error())
		);
		return;
	}

	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(req, { cacheName: SHELL }).then((r) => r ?? fetch(req)));
		return;
	}

	if (url.pathname.startsWith('/audio/')) {
		event.respondWith(cacheFirst(req, AUDIO));
		return;
	}

	event.respondWith(staleWhileRevalidate(req, event));
});

async function cacheFirst(req: Request, name: string) {
	const cache = await caches.open(name);
	const hit = await cache.match(req);
	if (hit) return hit;
	const res = await fetch(req);
	if (res.ok) cache.put(req, res.clone());
	return res;
}

async function staleWhileRevalidate(req: Request, event: FetchEvent) {
	const cache = await caches.open(RUNTIME);
	const hit = await cache.match(req);
	const network = fetch(req)
		.then((res) => {
			if (res.ok) cache.put(req, res.clone());
			return res;
		})
		.catch(() => hit ?? Response.error());
	if (hit) {
		event.waitUntil(network);
		return hit;
	}
	return network;
}
