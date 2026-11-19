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
const { _clearSignupCache, signupState } = await import('../auth/signup.ts');
const { fillDays } = await import('./settings.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const NOW = Date.now();

beforeEach(() => {
	_clearSignupCache();
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Owner', 'h1', 1, ${NOW}), (2, 'Mika', 'h2', 0, ${NOW - 86_400_000})`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${NOW + 3_600_000})`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1' };
	session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
});

async function call(method: string, path: string, body?: unknown) {
	const url = new URL(`http://localhost:8787${path}`);
	const req = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
	try {
		const res = await handleAdmin(req, env as never, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		return { status: h.status, body: h.body as any };
	}
}
const stepUp = () => db.exec(`UPDATE sessions SET stepup_at = ${Date.now()} WHERE token_hash = 't'`);
const audit = () => db.prepare(`SELECT action, detail_json FROM admin_audit ORDER BY id`).all() as { action: string; detail_json: string }[];

describe('fleet settings', () => {
	it('reports sign-up mode, session lifetime and 30 days of sign-ups', async () => {
		const r = await call('GET', '/api/admin/settings');
		expect(r.body.signup).toEqual({ mode: 'open', hardClosed: false });
		expect(r.body.session).toEqual({ days: null, effectiveDays: 400, defaultDays: 400 });
		expect(r.body.signupsByDay).toHaveLength(30);
		expect(r.body.signupsByDay.reduce((n: number, d: any) => n + d.count, 0)).toBe(2);
	});

	it('closes and opens sign-ups with a passkey tap, audited', async () => {
		expect((await call('PUT', '/api/admin/settings/signup', { mode: 'closed' })).status).toBe(428);
		stepUp();
		expect((await call('PUT', '/api/admin/settings/signup', { mode: 'shut' })).status).toBe(400);
		const r = await call('PUT', '/api/admin/settings/signup', { mode: 'closed' });
		expect(r.body.signup.mode).toBe('closed');
		expect(await signupState(env as never)).toMatchObject({ open: false, invite: true });
		expect((await call('GET', '/api/admin/overview')).body.signupMode).toBe('invite');
		expect(audit().map((a) => [a.action, JSON.parse(a.detail_json)])).toEqual([['signup.mode', { from: 'open', to: 'closed' }]]);
	});

	it('shows the Worker var as a hard close', async () => {
		env.SIGNUP_MODE = 'closed';
		expect((await call('GET', '/api/admin/settings')).body.signup.hardClosed).toBe(true);
		expect((await call('GET', '/api/admin/overview')).body.signupMode).toBe('closed');
	});

	it('sets and clears the session lifetime', async () => {
		stepUp();
		expect((await call('PUT', '/api/admin/settings/session', { days: 0 })).status).toBe(400);
		expect((await call('PUT', '/api/admin/settings/session', { days: 401 })).status).toBe(400);
		expect((await call('PUT', '/api/admin/settings/session', { days: 1.5 })).status).toBe(400);
		let r = await call('PUT', '/api/admin/settings/session', { days: 30 });
		expect(r.body.session).toEqual({ days: 30, effectiveDays: 30, defaultDays: 400 });
		r = await call('PUT', '/api/admin/settings/session', { days: null });
		expect(r.body.session.days).toBeNull();
		expect(audit().map((a) => JSON.parse(a.detail_json))).toEqual([
			{ from: null, to: 30 },
			{ from: 30, to: null }
		]);
	});

	it('creates and revokes invites', async () => {
		expect((await call('POST', '/api/admin/invites', { maxUses: 0 })).status).toBe(400);
		expect((await call('POST', '/api/admin/invites', { expiresInDays: 999 })).status).toBe(400);
		const c = await call('POST', '/api/admin/invites', { label: 'Aoi', maxUses: 3, expiresInDays: 7 });
		expect(c.body).toMatchObject({ label: 'Aoi', maxUses: 3, uses: 0, revokedAt: null });
		expect(c.body.expiresAt).toBeGreaterThan(NOW + 6 * 86_400_000);
		expect((await call('GET', '/api/admin/settings')).body.invites.map((i: any) => i.code)).toEqual([c.body.code]);
		expect((await call('DELETE', `/api/admin/invites/${c.body.code}`)).body).toEqual({ ok: true });
		expect((await call('DELETE', `/api/admin/invites/${c.body.code}`)).status).toBe(404);
		expect(audit().map((a) => a.action)).toEqual(['invite.create', 'invite.revoke']);
	});

	it('makes named invites for /invite/vip links', async () => {
		const c = await call('POST', '/api/admin/invites', { code: ' vip ', maxUses: 50 });
		expect(c.status).toBe(200);
		expect(c.body).toMatchObject({ code: 'VIP', maxUses: 50, uses: 0 });
		expect((await call('POST', '/api/admin/invites', { code: 'Vip' })).status).toBe(409);
		expect((await call('POST', '/api/admin/invites', { code: 'x' })).status).toBe(400);
		// 8 letters would be read as a random BK- code
		expect((await call('POST', '/api/admin/invites', { code: 'vipguest' })).status).toBe(400);
		expect((await call('POST', '/api/admin/invites', { code: 'vip_guest' })).body.code).toBe('VIP_GUEST');
		expect((await call('DELETE', '/api/admin/invites/vip')).body).toEqual({ ok: true });
	});
});

describe('fillDays', () => {
	it('zero-fills the window, oldest first', () => {
		const now = Date.UTC(2026, 10, 15, 12);
		const d = fillDays([{ day: '2026-11-14', count: 3 }], now, 3);
		expect(d).toEqual([
			{ day: '2026-11-13', count: 0 },
			{ day: '2026-11-14', count: 3 },
			{ day: '2026-11-15', count: 0 }
		]);
	});
});
