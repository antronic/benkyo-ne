import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleAdmin } = await import('./routes.ts');
const { handleApi, requestIdOf } = await import('../index.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const ADMIN: Session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
const now = Date.now();

async function admin(path: string, as: Session | null = ADMIN) {
	session = as;
	const url = new URL(`http://localhost:8787${path}`);
	try {
		const res = await handleAdmin(new Request(url), env as never, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (!h.status) throw e;
		return { status: h.status, body: h.body as any };
	}
}

let nextId = 1;
function event(user: number, kind: string, name: string, data: Record<string, unknown> | null, over: { at?: number; route?: string; build?: string; sid?: string } = {}) {
	const at = over.at ?? now - 60_000;
	db.prepare(
		`INSERT INTO beta_events (id, user_id, received_at, at, app_session, kind, name, route, app_version, country, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TH', ?)`
	).run(nextId, user, at, at, over.sid ?? 's1', kind, name, over.route ?? '/admin/packages', over.build ?? '1795157326824', data ? JSON.stringify(data) : null);
	return nextId++;
}

beforeEach(() => {
	nextId = 1;
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0)`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1' };
});

describe('Fleet → Errors', () => {
	it('is for admins only', async () => {
		expect((await admin('/api/admin/errors', { ...ADMIN, isAdmin: false })).status).toBe(403);
	});

	it('groups errors by message and lists each one newest first, without notes or other events', async () => {
		event(2, 'event', 'screen', { path: '/' });
		event(2, 'error', 'kit', { errorId: 'E-AAAAAA', message: 'x is undefined', status: 500 }, { at: now - 3000 });
		event(1, 'error', 'kit', { errorId: 'E-BBBBBB', message: 'x is undefined', status: 500 }, { at: now - 2000 });
		event(2, 'error', 'api_error', { errorId: 'E-CCCCCC', message: 'PUT /api/admin/credit-rates answered 500', requestId: 'ray42' }, { at: now - 1000 });
		event(2, 'error', 'error_note', { errorId: 'E-AAAAAA', note: 'I typed a rate' });
		event(2, 'error', 'kit', { errorId: 'E-OLDOLD', message: 'too old' }, { at: now - 40 * 86_400_000 });
		const r = await admin('/api/admin/errors?days=7');
		expect(r.status).toBe(200);
		expect(r.body.total).toBe(3);
		expect(r.body.groups[0]).toMatchObject({ name: 'kit', message: 'x is undefined', count: 2, accounts: 2 });
		expect(r.body.events.map((e: { errorId: string }) => e.errorId)).toEqual(['E-CCCCCC', 'E-BBBBBB', 'E-AAAAAA']);
		expect(r.body.events[0]).toMatchObject({ name: 'api_error', requestId: 'ray42', accountName: 'Mika', build: '1795157326824', hasNote: false });
		expect(r.body.events[2].hasNote).toBe(true);
		expect(r.body.builds).toEqual(['1795157326824']);
	});

	it('finds an error by the id a learner sends, or by request id, screen or build', async () => {
		event(2, 'error', 'kit', { errorId: 'E-7F3K2Q', message: 'one' }, { route: '/learn', build: '100' });
		event(2, 'error', 'api_error', { errorId: 'E-ZZZZZZ', message: 'two', requestId: 'ray42' }, { build: '200' });
		const ids = async (q: string) => (await admin(`/api/admin/errors?days=7&${q}`)).body.events.map((e: { errorId: string }) => e.errorId);
		expect(await ids('q=e-7f3k2q')).toEqual(['E-7F3K2Q']);
		expect(await ids('q=ray42')).toEqual(['E-ZZZZZZ']);
		expect(await ids('q=%2Flearn')).toEqual(['E-7F3K2Q']);
		expect(await ids('build=200')).toEqual(['E-ZZZZZZ']);
		expect(await ids('q=nothing-like-this')).toEqual([]);
	});

	it('refuses a window it does not offer', async () => {
		expect((await admin('/api/admin/errors?days=365')).status).toBe(400);
	});

	it('shows one error with its stack, breadcrumbs, the launch’s device and the learner’s note', async () => {
		event(2, 'device', 'device', { userAgent: 'Safari', viewport: { width: 390, height: 844 } }, { sid: 'launch-1', at: now - 9000 });
		event(2, 'device', 'device', { userAgent: 'Chrome' }, { sid: 'launch-2', at: now - 8000 });
		const id = event(
			2,
			'error',
			'kit',
			{ errorId: 'E-AAAAAA', message: 'x is undefined', type: 'TypeError', stack: 'at save (packages.svelte:10)', online: true, breadcrumbs: [{ at: now - 5000, kind: 'api', text: 'PUT /api/admin/credit-rates → 500' }] },
			{ sid: 'launch-1' }
		);
		event(2, 'error', 'error_note', { errorId: 'E-AAAAAA', note: 'I typed 0.5' });
		const r = await admin(`/api/admin/errors/${id}`);
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({
			event: { errorId: 'E-AAAAAA', accountName: 'Mika' },
			type: 'TypeError',
			stack: 'at save (packages.svelte:10)',
			breadcrumbs: [{ kind: 'api', text: 'PUT /api/admin/credit-rates → 500' }],
			extra: { online: true },
			device: { userAgent: 'Safari' },
			notes: [{ note: 'I typed 0.5' }]
		});
		expect((await admin('/api/admin/errors/99999')).status).toBe(404);
	});
});

describe('API request ids', () => {
	const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

	it('uses the Cloudflare ray id when there is one', () => {
		expect(requestIdOf(new Request('http://x/api/health', { headers: { 'cf-ray': '8F1A2B3C4D5E6F70-SIN' } }))).toBe('8f1a2b3c4d5e6f70');
		expect(requestIdOf(new Request('http://x/api/health'))).toMatch(/^[0-9a-f]{16}$/);
	});

	it('puts x-request-id on every API answer, and the id in a 500 body', async () => {
		const ok = await handleApi(new Request('http://localhost/api/health', { headers: { 'cf-ray': 'abcdef0123456789-SIN' } }), env as never, ctx);
		expect(ok.headers.get('x-request-id')).toBe('abcdef0123456789');
		const broken = { ...env, DB: { prepare: () => { throw new Error('D1 is down'); }, batch: () => { throw new Error('D1 is down'); } } };
		session = { ...ADMIN, userId: 2, isAdmin: false };
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const res = await handleApi(new Request('http://localhost/api/feedback/mine', { headers: { 'cf-ray': '0123456789abcdef-SIN' } }), broken as never, ctx);
		expect(res.status).toBe(500);
		expect(res.headers.get('x-request-id')).toBe('0123456789abcdef');
		expect(await res.json()).toMatchObject({ error: 'server', requestId: '0123456789abcdef' });
		expect(spy.mock.calls[0][0]).toMatchObject({ event: 'api_exception', requestId: '0123456789abcdef', path: '/api/feedback/mine', error: 'D1 is down' });
		expect(warn.mock.calls[0][0]).toMatchObject({ event: 'api_5xx', status: 500 });
		spy.mockRestore();
		warn.mockRestore();
	});
});
