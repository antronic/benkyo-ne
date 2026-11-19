import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
vi.mock('../beta/routes.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../beta/routes.ts')>()),
	requireConsent: async () => {},
	recordAiCall: async () => {}
}));
const anthropicCalls: { model: string; key: string }[] = [];
vi.mock('./anthropic.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./anthropic.ts')>()),
	callAnthropic: async (_parts: unknown, model: string, key: string) => {
		anthropicCalls.push({ model, key });
		return {
			ok: true,
			text: JSON.stringify({ theme: null, items: [{ key: 'k1', gloss2: null, hook: { en: 'Think of a cat.', second: null }, usage: null, example: null }] }),
			usage: [{ model, input: 1000, output: 200 }]
		};
	}
}));

const { handleAi } = await import('./routes.ts');
const { seal, deriveKey, b64encode } = await import('../crypto.ts');
const { providerAad } = await import('../admin/providers.ts');
const { credentialAad } = await import('./credentials.ts');
const { PACKAGE_PER_DAY } = await import('./managed.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const DAY = 86_400_000;
const PLATFORM_KEY = 'sk-ant-platform-key-0001';
const OWN_KEY = 'sk-ant-learner-own-9999';
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

const fillBody = { items: [{ key: 'k1', text: 'ねこ', reading: 'ねこ', kind: 'word', gloss: 'cat' }], knownKana: [], allowExamples: false, secondLang: null, theme: false };

async function call(method: string, path: string, body?: unknown) {
	const url = new URL(`http://localhost:8787${path}`);
	const req = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
	try {
		const res = await handleAi(req, env as never, ctx, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		return { status: h.status, body: h.body as any };
	}
}

async function addPlatformProvider() {
	const key = await deriveKey(env.AI_MASTER_KEY as string);
	const s = await seal(key, PLATFORM_KEY, providerAad('anthropic', null));
	db.prepare(
		`INSERT INTO ai_providers (id, kind, preset, label, base_url, key_cipher, key_iv, key_last4, enabled, created_at, updated_at)
		 VALUES (1, 'anthropic', 'anthropic', 'Anthropic', NULL, ?, ?, '0001', 1, 0, 0)`
	).run(s.cipher, s.iv);
	// Plus: fill and suggestions on Sonnet; no photo reading
	db.exec(`INSERT INTO plan_models (plan_id, provider_id, model, label, features, input_per_m, output_per_m, position, added_at)
		VALUES ('plus', 1, 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 'fill,propose', 3, 15, 0, 0)`);
}
async function addOwnKey(userId: number) {
	const key = await deriveKey(env.AI_MASTER_KEY as string);
	const s = await seal(key, OWN_KEY, credentialAad('anthropic', null, userId));
	db.prepare(
		`INSERT INTO ai_credentials (provider, base_url, label, key_cipher, key_iv, key_last4, created_at, user_id, aad_version)
		 VALUES ('anthropic', NULL, 'Mine', ?, ?, '9999', 0, ?, 2)`
	).run(s.cipher, s.iv, userId);
}
const grant = (userId: number, plan = 'plus', endsAt: number | null = null, endedAt: number | null = null) =>
	db
		.prepare(`INSERT INTO plan_grants (account_id, plan_id, kind, starts_at, ends_at, created_at, ended_at) VALUES (?, ?, 'comp', 0, ?, 0, ?)`)
		.run(userId, plan, endsAt, endedAt);
const ledger = () => db.prepare(`SELECT source, plan_id AS planId, status, model FROM ai_ledger ORDER BY id`).all() as any[];

beforeEach(async () => {
	anthropicCalls.length = 0;
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (2, 'Mika', 'h2', 0, 0)`);
	env = { DB: d1(db), AI_MASTER_KEY: b64encode(randomBytes(32)) };
	session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 2, name: 'Mika', isAdmin: false, appleLinked: false };
	await addPlatformProvider();
});

describe('managed AI', () => {
	it('runs a package holder with no key of their own on the package’s model and provider key', async () => {
		grant(2);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(200);
		expect(anthropicCalls).toEqual([{ model: 'claude-sonnet-5-5', key: PLATFORM_KEY }]);
		expect(ledger()).toEqual([{ source: 'package', planId: 'plus', status: 'done', model: 'claude-sonnet-5-5' }]);

		const s = await call('GET', '/api/ai/managed');
		expect(s.body).toMatchObject({ plan: { id: 'plus', name: 'Plus', endsAt: null }, allowanceUsd: 1.5, calls: 1, prefer: 'package', active: 'package', blocked: null });
		expect(s.body.spentUsd).toBeCloseTo((1000 * 3 + 200 * 15) / 1e6, 9);
		expect(s.body.models).toEqual([
			{ feature: 'fill', label: 'Claude Sonnet 5.5', model: 'claude-sonnet-5-5' },
			{ feature: 'propose', label: 'Claude Sonnet 5.5', model: 'claude-sonnet-5-5' },
			// no model picked for translate: the package's cheapest one
			{ feature: 'translate', label: 'Claude Sonnet 5.5', model: 'claude-sonnet-5-5' }
		]);
		// managed spend doesn't eat the learner's own cap
		expect((await call('GET', '/api/ai/usage')).body).toMatchObject({ spentUsd: 0, calls: 0 });
		// and no provider key is anywhere in the answer
		expect(JSON.stringify(s.body)).not.toContain(PLATFORM_KEY);
	});

	it('uses a package model with no listed price (self-hosted) instead of the learner’s own key', async () => {
		grant(2);
		await addOwnKey(2);
		db.exec(`UPDATE plan_models SET model = 'my-gpu-model', input_per_m = NULL, output_per_m = NULL`);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(200);
		expect(anthropicCalls).toEqual([{ model: 'my-gpu-model', key: PLATFORM_KEY }]);
		expect(ledger()).toEqual([{ source: 'package', planId: 'plus', status: 'done', model: 'my-gpu-model' }]);
		const s = await call('GET', '/api/ai/managed');
		expect(s.body).toMatchObject({ active: 'package', spentUsd: 0, calls: 1 });
		expect(s.body.byFeature.find((b: any) => b.feature === 'fill')).toEqual({ feature: 'fill', source: 'package' });
	});

	it('keeps learners without a package on their own key', async () => {
		await addOwnKey(2);
		expect((await call('POST', '/api/ai/fill', fillBody)).status).toBe(200);
		expect(anthropicCalls[0].key).toBe(OWN_KEY);
		expect(ledger()[0]).toMatchObject({ source: 'own', planId: null });
		expect((await call('GET', '/api/ai/managed')).body).toMatchObject({ plan: null, active: 'own' });
	});

	it('lets someone with both switch between the package and their own key', async () => {
		grant(2);
		await addOwnKey(2);
		await call('POST', '/api/ai/fill', fillBody);
		expect(anthropicCalls.at(-1)!.key).toBe(PLATFORM_KEY);

		const s = await call('PUT', '/api/ai/managed', { prefer: 'own' });
		expect(s.body).toMatchObject({ prefer: 'own', active: 'own' });
		await call('POST', '/api/ai/fill', fillBody);
		expect(anthropicCalls.at(-1)!.key).toBe(OWN_KEY);

		expect((await call('PUT', '/api/ai/managed', { prefer: 'package' })).body).toMatchObject({ active: 'package' });
		expect((await call('PUT', '/api/ai/managed', { prefer: 'mine' })).status).toBe(400);
		expect(ledger().map((l) => l.source)).toEqual(['package', 'own']);
	});

	it('says clearly when the allowance is used up, and falls back to an own key when there is one', async () => {
		grant(2);
		db.exec(`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd, user_id, source, plan_id)
			VALUES (${Date.now()}, 'fill', 'anthropic', 'claude-sonnet-5-5', 'done', 1.5, 2, 'package', 'plus')`);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(402);
		expect(r.body.error).toBe('allowance_reached');
		expect(r.body.message).toMatch(/Plus package is used up/);
		expect((await call('GET', '/api/ai/managed')).body).toMatchObject({ blocked: 'allowance', active: null });

		await addOwnKey(2);
		expect((await call('POST', '/api/ai/fill', fillBody)).status).toBe(200);
		expect(anthropicCalls.at(-1)!.key).toBe(OWN_KEY);
		expect((await call('GET', '/api/ai/managed')).body).toMatchObject({ blocked: 'allowance', active: 'own' });
	});

	it('shows per feature when "my own key" still uses the package', async () => {
		grant(2);
		// an OpenAI-compatible key set up for filling cards only
		db.exec(`INSERT INTO ai_credentials (id, provider, base_url, label, key_cipher, key_iv, key_last4, created_at, user_id, aad_version)
			VALUES (7, 'openai-compatible', 'https://example.test/v1', 'Mine', 'x', 'y', '9999', 0, 2, 2)`);
		db.exec(`INSERT INTO ai_feature_models (user_id, feature, credential_id, model) VALUES (2, 'fill', 7, 'gpt-x')`);
		const s = await call('PUT', '/api/ai/managed', { prefer: 'own' });
		expect(s.body.byFeature).toEqual([
			{ feature: 'fill', source: 'own' },
			{ feature: 'propose', source: 'package' },
			{ feature: 'vision', source: null },
			{ feature: 'translate', source: 'package' }
		]);
		expect(s.body.active).toBe('own');
	});

	it('reports the own cap when both the allowance and the own cap are used up', async () => {
		grant(2);
		await addOwnKey(2);
		db.exec(`UPDATE accounts SET cap_usd = 0 WHERE id = 2`);
		db.exec(`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd, user_id, source, plan_id)
			VALUES (${Date.now()}, 'fill', 'anthropic', 'claude-sonnet-5-5', 'done', 1.5, 2, 'package', 'plus')`);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(402);
		expect(r.body.error).toBe('cap_reached');
		expect(r.body.message).toMatch(/package’s AI can’t be used right now either/);
	});

	it('says the package has ended once it has', async () => {
		grant(2, 'plus', Date.now() - DAY);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(402);
		expect(r.body.error).toBe('package_ended');
		expect((await call('GET', '/api/ai/managed')).body).toMatchObject({ plan: null, active: null, ended: { name: 'Plus' } });
	});

	it('names a feature the package leaves out', async () => {
		grant(2);
		const r = await call('POST', '/api/ai/propose', { mode: 'screenshot', input: '', image: { mediaType: 'image/png', base64: 'iVBORw0KGgo=' }, secondLang: null });
		expect(r.status).toBe(409);
		expect(r.body.message).toMatch(/doesn’t include AI for reading photos/);
	});

	it('stops managed AI at the daily limit', async () => {
		grant(2);
		const minute = Math.floor(Date.now() / 60000 / 1440) * 1440;
		db.prepare(`INSERT INTO ai_rate (bucket, minute, count) VALUES ('pkg-day:2', ?, ?)`).run(minute, PACKAGE_PER_DAY);
		const r = await call('POST', '/api/ai/fill', fillBody);
		expect(r.status).toBe(429);
		expect(r.body.error).toBe('rate_limited');
		expect(anthropicCalls).toEqual([]);
	});

	it('ignores a turned-off provider', async () => {
		grant(2);
		db.exec(`UPDATE ai_providers SET enabled = 0`);
		expect((await call('GET', '/api/ai/managed')).body).toMatchObject({ plan: null });
		expect((await call('POST', '/api/ai/fill', fillBody)).status).toBe(409);
	});
});
