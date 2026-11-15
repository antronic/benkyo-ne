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
const { planOf } = await import('../plans.ts');
const { parseGrantInput, parsePlanPatch } = await import('./packages.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const DAY = 86_400_000;

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0), (3, 'Aoi', 'h3', 0, 0)`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${Date.now() + 3_600_000})`);
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
const audit = () => db.prepare(`SELECT action, target_id AS target, detail_json AS d FROM admin_audit ORDER BY id`).all() as { action: string; target: number; d: string }[];

describe('packages', () => {
	it('starts from the pricing proposal with everyone on Free', async () => {
		const r = await call('GET', '/api/admin/packages');
		expect(r.body.plans.map((p: any) => [p.id, p.priceMonthUsd, p.aiAllowanceUsd, p.accounts])).toEqual([
			['free', 0, 0, 3],
			['plus', 4.99, 1.5, 0],
			['pro', 9.99, 3.5, 0]
		]);
		expect(r.body.grants).toEqual([]);
	});

	it('edits a package with a passkey tap and logs only what changed', async () => {
		expect((await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99 })).status).toBe(428);
		stepUp();
		expect((await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: -1 })).status).toBe(400);
		expect((await call('PUT', '/api/admin/packages/gold', { priceMonthUsd: 1 })).status).toBe(404);
		expect((await call('PUT', '/api/admin/packages/free', { priceMonthUsd: 1 })).status).toBe(400);
		const r = await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99, aiAllowanceUsd: 1.5, available: false });
		expect(r.body.plans[1]).toMatchObject({ priceMonthUsd: 5.99, aiAllowanceUsd: 1.5, available: false });
		expect(audit().map((a) => [a.action, JSON.parse(a.d)])).toEqual([
			['package.update', { plan: 'plus', priceMonthUsd: { from: 4.99, to: 5.99 }, available: { from: true, to: false } }]
		]);
		// nothing changed: no audit row
		await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99 });
		expect(audit()).toHaveLength(1);
	});

	it('grants, replaces and ends a package', async () => {
		expect((await call('POST', '/api/admin/accounts/2/grants', { plan: 'pro', kind: 'comp', days: null })).status).toBe(428);
		stepUp();
		expect((await call('POST', '/api/admin/accounts/99/grants', { plan: 'pro', kind: 'comp', days: null })).status).toBe(404);
		let r = await call('POST', '/api/admin/accounts/2/grants', { plan: 'plus', kind: 'trial', days: 7, note: 'beta tester' });
		expect(r.status).toBe(200);
		expect(r.body.plan).toBe('plus');
		expect(r.body.grants[0]).toMatchObject({ plan: 'plus', kind: 'trial', note: 'beta tester', live: true });
		expect(r.body.grants[0].endsAt - r.body.grants[0].startsAt).toBe(7 * DAY);

		r = await call('POST', '/api/admin/accounts/2/grants', { plan: 'pro', kind: 'comp', days: null });
		expect(r.body.plan).toBe('pro');
		expect(r.body.grants.map((g: any) => [g.plan, g.live])).toEqual([
			['pro', true],
			['plus', false]
		]);
		expect(await planOf(env as never, 2)).toBe('pro');
		const pk = await call('GET', '/api/admin/packages');
		expect(pk.body.plans.map((p: any) => p.accounts)).toEqual([2, 0, 1]);
		expect(pk.body.grants).toHaveLength(1);
		expect((await call('GET', '/api/admin/accounts?q=Mika')).body.accounts[0].plan).toBe('pro');

		const id = r.body.grants[0].id;
		expect((await call('DELETE', `/api/admin/accounts/3/grants/${id}`)).status).toBe(404); // wrong account
		r = await call('DELETE', `/api/admin/accounts/2/grants/${id}`);
		expect(r.body.plan).toBe('free');
		expect((await call('DELETE', `/api/admin/accounts/2/grants/${id}`)).status).toBe(404);
		expect(audit().map((a) => [a.action, a.target])).toEqual([
			['package.grant', 2],
			['package.grant', 2],
			['package.end', 2]
		]);
		expect(JSON.parse(audit()[1].d).replaced).toHaveLength(1);
	});

	it('expired grants fall back to Free', async () => {
		db.exec(`INSERT INTO plan_grants (account_id, plan_id, kind, starts_at, ends_at, created_at) VALUES (3, 'pro', 'trial', 0, ${Date.now() - 1000}, 0)`);
		expect(await planOf(env as never, 3)).toBe('free');
	});

	it('deleting an account removes its grants', async () => {
		stepUp();
		await call('POST', '/api/admin/accounts/2/grants', { plan: 'plus', kind: 'comp', days: 30 });
		expect((await call('DELETE', '/api/admin/accounts/2', { confirm: 'Mika' })).status).toBe(200);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM plan_grants`).get()).toEqual({ n: 0 });
	});
});

describe('input checks', () => {
	it('grants', () => {
		expect(() => parseGrantInput({ plan: 'free', kind: 'comp', days: 1 })).toThrow();
		expect(() => parseGrantInput({ plan: 'plus', kind: 'gift', days: 1 })).toThrow();
		expect(() => parseGrantInput({ plan: 'plus', kind: 'trial', days: null })).toThrow();
		expect(() => parseGrantInput({ plan: 'plus', kind: 'comp', days: 0 })).toThrow();
		expect(() => parseGrantInput({ plan: 'plus', kind: 'comp', days: 731 })).toThrow();
		expect(parseGrantInput({ plan: 'pro', kind: 'comp', days: null, note: '  friend\n' })).toEqual({ plan: 'pro', kind: 'comp', days: null, note: 'friend' });
	});
	it('package edits', () => {
		expect(() => parsePlanPatch('plus', {})).toThrow();
		expect(() => parsePlanPatch('plus', { name: '  ' })).toThrow();
		expect(() => parsePlanPatch('free', { available: false })).toThrow();
		expect(parsePlanPatch('free', { name: 'Starter', priceMonthUsd: 0 })).toEqual({ name: 'Starter', priceMonthUsd: 0 });
		expect(parsePlanPatch('pro', { priceYearUsd: 79.456 })).toEqual({ priceYearUsd: 79.46 });
	});
});
