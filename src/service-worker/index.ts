/**
 * Offline strategy (docs/PLAN.md §8.3)
 *   app shell + build output + static files → precached per deploy (cache-first),
 *                                             except the dictionary's per-piece chunks (below)
 *   navigations                             → network, falling back to cached index.html
 *   /api/*                                  → network only (sync retries from the app)
 *   /storybook/*                            → not handled (the component Storybook, docs/DESIGN-SYSTEM.md)
 *   /audio/*                                → cache-first, kept across deploys
 *   anything else same-origin GET           → stale-while-revalidate
 */
import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const SHELL = `shell-${version}`;
// v2: v1 could hold an HTML page saved under a script's URL (see okFor), so it is dropped
const RUNTIME = 'runtime-v2';
const AUDIO = 'audio-v1';

/**
 * Dictionary data (@johnmorrisdotca/jisho, src/lib/dict): ~1,000 small chunks, ~60 MB in all.
 * SvelteKit names every chunk by hash only, so they are told apart with Vite's client manifest,
 * which the client build writes just before this service worker is built (absent in dev, where
 * `immutable` is empty anyway). The numbered pieces (r012.data.js, e123.data.js…) are NOT
 * precached: the stale-while-revalidate runtime cache keeps each one after its first use. The
 * common-words table, the manifests and the other small tables stay precached, so packs,
 * lookups of common words and example checks work offline right after install.
 */
type ViteManifest = Record<string, { file: string; src?: string }>;
const viteManifest: ViteManifest =
	Object.values(
		import.meta.glob<ViteManifest>('/.svelte-kit/output/client/.vite/manifest.json', { eager: true, import: 'default' })
	)[0] ?? {};
const DICT_PIECE = /@johnmorrisdotca\/jisho\/dist\/data\/.*\/[a-z]+\d+\.data\.js$/;
const DICT_PIECES = new Set(
	Object.entries(viteManifest)
		.filter(([src]) => DICT_PIECE.test(src))
		.map(([, chunk]) => `/${chunk.file}`)
);

/**
 * The avatar's big run-time files are not precached either: static/avatar/ (three.js for the
 * live 3D avatar, the selfie reader's WebAssembly and face models, ~25 MB) and the
 * @mediapipe/tasks-vision chunk. They load only when someone opens the live avatar or the
 * selfie reader, and the runtime cache keeps each one after its first use.
 */
const AVATAR_CHUNKS = new Set(
	Object.entries(viteManifest)
		.filter(([src]) => src.includes('@mediapipe/tasks-vision'))
		.map(([, chunk]) => `/${chunk.file}`)
);

const PRECACHE = ['/', ...immutable.map((f) => f.path), ...assets.map((f) => f.path)]
	.map((p) => (p.startsWith('/') ? p : `/${p}`))
	.filter((p) => !DICT_PIECES.has(p) && !AVATAR_CHUNKS.has(p) && !p.startsWith('/avatar/'));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((c) => c.addAll(PRECACHE))
			// First install activates at once; updates wait until the user taps
			// "Restart" (or every tab is closed), so a page never changes underneath them.
			.then(() => {
				if (!self.registration.active) return self.skipWaiting();
			})
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => (k.startsWith('shell-') && k !== SHELL) || (k.startsWith('runtime-') && k !== RUNTIME))
						.map((k) => caches.delete(k))
				)
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
	if (url.pathname.startsWith('/storybook')) return; // the component Storybook is its own site: never the app shell

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(async () => (await caches.match('/', { cacheName: SHELL })) ?? Response.error())
		);
		return;
	}

	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(fromCache(caches.match(req, { cacheName: SHELL })).then((r) => r ?? fetch(req)));
		return;
	}

	if (url.pathname.startsWith('/audio/')) {
		event.respondWith(cacheFirst(req, AUDIO));
		return;
	}

	event.respondWith(staleWhileRevalidate(req, event));
});

/**
 * Cache Storage can stall in Safari. A cache read that takes too long (or fails) counts as
 * a miss, so the request goes to the network instead of leaving the app waiting.
 */
const CACHE_TIMEOUT_MS = 3000;
function fromCache<T>(p: Promise<T | undefined>): Promise<T | undefined> {
	return Promise.race<T | undefined>([
		p.catch(() => undefined),
		new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), CACHE_TIMEOUT_MS))
	]);
}

/**
 * Only keep real files. A missing file can come back as the app's index.html with status 200
 * (single-page fallback); saved under a script's URL, it would break that script for good.
 */
function okFor(req: Request, res: Response) {
	if (!res.ok) return false;
	const type = res.headers.get('content-type') ?? '';
	return !(type.includes('text/html') && req.destination !== 'document');
}

async function cacheFirst(req: Request, name: string) {
	const cache = await fromCache(caches.open(name));
	const hit = cache && (await fromCache(cache.match(req)));
	if (hit) return hit;
	const res = await fetch(req);
	if (cache && okFor(req, res)) cache.put(req, res.clone()).catch(() => {});
	return res;
}

async function staleWhileRevalidate(req: Request, event: FetchEvent) {
	const cache = await fromCache(caches.open(RUNTIME));
	const hit = cache && (await fromCache(cache.match(req)));
	const network = fetch(req)
		.then((res) => {
			if (cache && okFor(req, res)) cache.put(req, res.clone()).catch(() => {});
			return res;
		})
		.catch(() => hit ?? Response.error());
	if (hit) {
		event.waitUntil(network);
		return hit;
	}
	return network;
}
