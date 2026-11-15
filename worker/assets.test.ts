import { describe, expect, it } from 'vitest';
import { serveAsset } from './index.ts';
import type { Env } from './env.ts';

/** ASSETS with single-page fallback: unknown paths come back as index.html (200). */
const env = {
	ASSETS: {
		fetch: async (req: Request) => {
			const path = new URL(req.url).pathname;
			if (path === '/_app/immutable/chunks/real.js') return new Response('export {}', { headers: { 'content-type': 'text/javascript' } });
			return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
		}
	}
} as unknown as Env;

const get = (path: string) => {
	const req = new Request(`https://benkyo.test${path}`);
	return serveAsset(req, new URL(req.url), env);
};

describe('serveAsset', () => {
	it('404s an app file that does not exist instead of sending the page', async () => {
		const res = await get('/_app/immutable/chunks/gone.js');
		expect(res.status).toBe(404);
		expect(res.headers.get('content-type')).toBe('text/plain');
	});
	it('serves real app files as long-lived immutable files', async () => {
		const res = await get('/_app/immutable/chunks/real.js');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toContain('immutable');
	});
	it('keeps the page fallback for client routes', async () => {
		const res = await get('/learn/kana');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/html');
	});
});
