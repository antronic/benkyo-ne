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
const { parseGrantInput, parsePlanPatch, parseRateInput } = await import('./packages.ts');

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
		// AI credits start at the old USD allowance x 1000 (migration 0022)
		expect(r.body.plans.map((p: any) => [p.id, p.priceMonthUsd, p.aiCredits, p.accounts])).toEqual([
			['free', 0, 0, 3],
			['plus', 4.99, 1500, 0],
			['pro', 9.99, 3500, 0]
		]);
		expect(r.body.rates).toEqual([]);
		expect(r.body.creditsPerUsd).toBe(1000);
		expect(r.body.grants).toEqual([]);
	});

	it('edits a package with a passkey tap and logs only what changed', async () => {
		expect((await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99 })).status).toBe(428);
		stepUp();
		expect((await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: -1 })).status).toBe(400);
		expect((await call('PUT', '/api/admin/packages/gold', { priceMonthUsd: 1 })).status).toBe(404);
		expect((await call('PUT', '/api/admin/packages/free', { priceMonthUsd: 1 })).status).toBe(400);
		const r = await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99, aiCredits: 1500, available: false });
		expect(r.body.plans[1]).toMatchObject({ priceMonthUsd: 5.99, aiCredits: 1500, available: false });
		expect(audit().map((a) => [a.action, JSON.parse(a.d)])).toEqual([
			['package.update', { plan: 'plus', priceMonthUsd: { from: 4.99, to: 5.99 }, available: { from: true, to: false } }]
		]);
		expect((await call('PUT', '/api/admin/packages/plus', { aiCredits: 2500 })).body.plans[1].aiCredits).toBe(2500);
		expect((await call('PUT', '/api/admin/packages/free', { aiCredits: 10 })).status).toBe(400);
		audit().pop();
		// nothing changed: no audit row
		await call('PUT', '/api/admin/packages/plus', { priceMonthUsd: 5.99 });
		expect(audit()).toHaveLength(2);
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

	it('sets, changes and clears a model’s credit rate with a passkey tap', async () => {
		db.exec(`INSERT INTO ai_providers (id, kind, preset, label, key_cipher, key_iv, key_last4, created_at, updated_at)
			VALUES (1, 'anthropic', 'anthropic', 'Anthropic', 'x', 'y', '0001', 0, 0)`);
		db.exec(`INSERT INTO plan_models (plan_id, provider_id, model, label, features, input_per_m, output_per_m, position, added_at) VALUES
			('plus', 1, 'claude-haiku-5-5', 'Claude Haiku 5.5', 'fill', 0.1, 0.5, 0, 0),
			('pro', 1, 'claude-haiku-5-5', 'Claude Haiku 5.5', '', 0.1, 0.5, 1, 0)`);
		const body = { providerId: 1, model: 'claude-haiku-5-5', rate: { unit: 1000, inputCredits: 0.5, outputCredits: 2 } };
		expect((await call('PUT', '/api/admin/credit-rates', body)).status).toBe(428);
		stepUp();
		// only models in a package, only per 1, 1K or 1M tokens
		expect((await call('PUT', '/api/admin/credit-rates', { ...body, model: 'gpt-x' })).status).toBe(400);
		expect((await call('PUT', '/api/admin/credit-rates', { ...body, rate: { ...body.rate, unit: 100 } })).status).toBe(400);
		let r = await call('PUT', '/api/admin/credit-rates', body);
		expect(r.status).toBe(200);
		// one row per model, listing every package that has it
		expect(r.body.rates).toEqual([
			{
				providerId: 1,
				providerLabel: 'Anthropic',
				model: 'claude-haiku-5-5',
				label: 'Claude Haiku 5.5',
				inputPerM: 0.1,
				outputPerM: 0.5,
				packages: ['Plus', 'Pro'],
				rate: { unit: 1000, inputCredits: 0.5, outputCredits: 2 },
				updatedAt: expect.any(Number)
			}
		]);
		r = await call('PUT', '/api/admin/credit-rates', { ...body, rate: { unit: 1_000_000, inputCredits: 100, outputCredits: 500 } });
		expect(r.body.rates[0].rate).toEqual({ unit: 1_000_000, inputCredits: 100, outputCredits: 500 });
		r = await call('PUT', '/api/admin/credit-rates', { ...body, rate: null });
		expect(r.body.rates[0].rate).toBeNull();
		expect(audit().map((a) => [a.action, JSON.parse(a.d).to])).toEqual([
			['credits.rate', { unit: 1000, inputCredits: 0.5, outputCredits: 2 }],
			['credits.rate', { unit: 1_000_000, inputCredits: 100, outputCredits: 500 }],
			['credits.rate', null]
		]);
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
	it('checks credit rates', () => {
		expect(parseRateInput({ providerId: 1, model: ' m ', rate: { unit: 1, inputCredits: 0, outputCredits: 0.25 } })).toEqual({
			providerId: 1,
			model: 'm',
			rate: { unit: 1, inputCredits: 0, outputCredits: 0.25 }
		});
		expect(parseRateInput({ providerId: 1, model: 'm', rate: null })).toEqual({ providerId: 1, model: 'm', rate: null });
		expect(() => parseRateInput({ providerId: 1, model: 'm', rate: { unit: 1000, inputCredits: -1, outputCredits: 1 } })).toThrow();
		expect(() => parseRateInput({ providerId: 1, model: 'm', rate: { unit: 1000, inputCredits: 1 } })).toThrow();
		expect(() => parseRateInput({ providerId: 0, model: 'm', rate: null })).toThrow();
	});

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
