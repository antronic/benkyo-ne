import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { b64encode, randomBytes } from '../crypto.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleAdmin } = await import('./routes.ts');
const { listError, parseProviderInput, providerAad } = await import('./providers.ts');
const { newPlanId, parseModelsInput } = await import('./packages.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const KEY = 'sk-or-test-key-1234';

/** A fake OpenAI-compatible server: GET /models lists two models for KEY, 401 otherwise. */
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	const auth = new Headers(init?.headers).get('authorization');
	if (!url.endsWith('/models')) return new Response('nope', { status: 404 });
	if (auth !== `Bearer ${KEY}` && auth !== 'Bearer sk-or-new-key-9999') return new Response('{}', { status: 401 });
	return Response.json({
		data: [
			{ id: 'acme/fast-1', name: 'Fast 1', context_length: 128000, pricing: { prompt: '0.0000001', completion: '0.0000004' }, architecture: { input_modalities: ['text'] } },
			{ id: 'acme/vision-2', name: 'Vision 2', context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { input_modalities: ['text', 'image'] } }
		]
	});
});

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0)`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${Date.now() + 3_600_000})`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1', AI_MASTER_KEY: b64encode(randomBytes(32)) };
	session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
	fetchMock.mockClear();
	vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function call(method: string, path: string, body?: unknown) {
	const url = new URL(`http://localhost:8787${path}`);
	const req = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
	try {
		const res = await handleAdmin(req, env as never, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (h.status === undefined) throw e;
		return { status: h.status, body: h.body as any };
	}
}
const stepUp = () => db.exec(`UPDATE sessions SET stepup_at = ${Date.now()} WHERE token_hash = 't'`);
const audit = () => db.prepare(`SELECT action, detail_json AS d FROM admin_audit ORDER BY id`).all() as { action: string; d: string }[];
const addProvider = async () => {
	stepUp();
	return call('POST', '/api/admin/ai/providers', { preset: 'openrouter', apiKey: KEY });
};

describe('AI providers', () => {
	it('lists the presets and starts empty', async () => {
		const r = await call('GET', '/api/admin/ai/providers');
		expect(r.status).toBe(200);
		expect(r.body.providers).toEqual([]);
		expect(r.body.canSaveKeys).toBe(true);
		expect(r.body.presets.map((p: any) => p.id)).toContain('anthropic');
		expect(r.body.presets.find((p: any) => p.id === 'openrouter').baseUrl).toBe('https://openrouter.ai/api/v1');
	});

	it('needs a passkey tap, and only keeps a key that can list models', async () => {
		expect((await call('POST', '/api/admin/ai/providers', { preset: 'openrouter', apiKey: KEY })).status).toBe(428);
		stepUp();
		const bad = await call('POST', '/api/admin/ai/providers', { preset: 'openrouter', apiKey: 'sk-wrong-key-0000' });
		expect(bad.status).toBe(400);
		expect(bad.body.message).toBe('OpenRouter rejected the API key');
		expect(db.prepare(`SELECT COUNT(*) AS n FROM ai_providers`).get()).toEqual({ n: 0 });

		const r = await call('POST', '/api/admin/ai/providers', { preset: 'openrouter', apiKey: KEY });
		expect(r.status).toBe(201);
		expect(r.body.providers[0]).toMatchObject({ label: 'OpenRouter', kind: 'openai-compatible', last4: '1234', modelCount: 2, enabled: true });
		expect(fetchMock).toHaveBeenLastCalledWith('https://openrouter.ai/api/v1/models', expect.anything());
	});

	it('never stores, returns or logs the key in the clear', async () => {
		const r = await addProvider();
		expect(JSON.stringify(r.body)).not.toContain(KEY);
		const row = db.prepare(`SELECT * FROM ai_providers`).get() as Record<string, unknown>;
		expect(JSON.stringify(row)).not.toContain(KEY);
		expect(JSON.stringify(audit())).not.toContain(KEY);
		expect(audit()[0]).toMatchObject({ action: 'ai.provider.add' });
		expect(JSON.parse(audit()[0].d)).toMatchObject({ label: 'OpenRouter', last4: '1234', models: 2 });
	});

	it('lists every model from the provider’s API with prices', async () => {
		await addProvider();
		const r = await call('GET', '/api/admin/ai/providers/1/models?refresh=1');
		expect(r.status).toBe(200);
		expect(r.body.models).toEqual([
			expect.objectContaining({ providerId: 1, id: 'acme/fast-1', label: 'Fast 1', vision: false, inputPerM: 0.1, outputPerM: 0.4, priceSource: 'provider', inPackages: [] }),
			expect.objectContaining({ id: 'acme/vision-2', vision: true, inputPerM: 3, outputPerM: 15 })
		]);
		const all = await call('GET', '/api/admin/ai/models');
		expect(all.body.models).toHaveLength(2);
		expect(all.body.errors).toEqual([]);
	});

	it('reports a provider that stops answering without failing the others', async () => {
		await addProvider();
		db.exec(`UPDATE ai_providers SET key_cipher = 'AAAA'`); // can't be decrypted any more
		const all = await call('GET', '/api/admin/ai/models?refresh=1');
		expect(all.status).toBe(200);
		expect(all.body.models).toEqual([]);
		expect(all.body.errors[0]).toMatchObject({ providerId: 1, label: 'OpenRouter' });
		const one = await call('GET', '/api/admin/ai/providers/1/models?refresh=1');
		expect(one.status).toBe(502);
		expect((db.prepare(`SELECT check_error AS e FROM ai_providers`).get() as { e: string }).e).toMatch(/decrypted/);
	});

	it('renames, turns off and replaces the key, logging only last-4s', async () => {
		await addProvider();
		expect((await call('PATCH', '/api/admin/ai/providers/1', { apiKey: 'sk-wrong-key-0000' })).status).toBe(400);
		const r = await call('PATCH', '/api/admin/ai/providers/1', { label: 'OR main', enabled: false, apiKey: 'sk-or-new-key-9999' });
		expect(r.status).toBe(200);
		expect(r.body.providers[0]).toMatchObject({ label: 'OR main', enabled: false, last4: '9999' });
		const d = JSON.parse(audit().at(-1)!.d);
		expect(d).toMatchObject({ rename: { from: 'OpenRouter', to: 'OR main' }, enabled: false, key: { from: '1234', to: '9999' } });
		expect(JSON.stringify(audit())).not.toContain('new-key');
		// turned-off providers aren't listed for packages
		expect((await call('GET', '/api/admin/ai/models')).body.models).toEqual([]);
	});

	it('won’t remove a provider a package uses', async () => {
		await addProvider();
		expect((await call('PUT', '/api/admin/packages/plus/models', { models: [{ providerId: 1, model: 'acme/fast-1', features: ['fill'] }] })).status).toBe(200);
		const r = await call('DELETE', '/api/admin/ai/providers/1');
		expect(r.status).toBe(400);
		expect(r.body.message).toMatch(/Plus/);
		expect((await call('GET', '/api/admin/ai/providers')).body.providers[0].usedBy).toEqual(['Plus']);
		await call('PUT', '/api/admin/packages/plus/models', { models: [] });
		expect((await call('DELETE', '/api/admin/ai/providers/1')).body.providers).toEqual([]);
		expect(audit().at(-1)!.action).toBe('ai.provider.remove');
	});

	it('refuses to save keys without AI_MASTER_KEY', async () => {
		delete env.AI_MASTER_KEY;
		stepUp();
		const r = await call('POST', '/api/admin/ai/providers', { preset: 'openrouter', apiKey: KEY });
		expect(r.status).toBe(503);
		expect((await call('GET', '/api/admin/ai/providers')).body.canSaveKeys).toBe(false);
	});
});

describe('packages built from provider models', () => {
	it('includes models checked against the provider’s list, with features and prices', async () => {
		await addProvider();
		const r = await call('PUT', '/api/admin/packages/pro/models', {
			models: [
				{ providerId: 1, model: 'acme/vision-2', features: ['vision', 'propose'] },
				{ providerId: 1, model: 'acme/fast-1', features: ['fill'] }
			]
		});
		expect(r.status).toBe(200);
		const pro = r.body.plans.find((p: any) => p.id === 'pro');
		expect(pro.models).toEqual([
			{ providerId: 1, providerLabel: 'OpenRouter', model: 'acme/vision-2', label: 'Vision 2', features: ['propose', 'vision'], inputPerM: 3, outputPerM: 15 },
			{ providerId: 1, providerLabel: 'OpenRouter', model: 'acme/fast-1', label: 'Fast 1', features: ['fill'], inputPerM: 0.1, outputPerM: 0.4 }
		]);
		expect(JSON.parse(audit().at(-1)!.d)).toMatchObject({ plan: 'pro', added: ['1/acme/vision-2', '1/acme/fast-1'], removed: [] });
		const models = await call('GET', '/api/admin/ai/providers/1/models');
		expect(models.body.models[1].inPackages).toEqual(['Pro']);
	});

	it('rejects unknown models, Free with models and a feature used twice', async () => {
		await addProvider();
		expect((await call('PUT', '/api/admin/packages/plus/models', { models: [{ providerId: 1, model: 'acme/gone' }] })).body.message).toMatch(/doesn’t list/);
		expect((await call('PUT', '/api/admin/packages/plus/models', { models: [{ providerId: 9, model: 'x' }] })).status).toBe(400);
		expect((await call('PUT', '/api/admin/packages/free/models', { models: [{ providerId: 1, model: 'acme/fast-1' }] })).status).toBe(400);
		expect(() => parseModelsInput({ models: [{ providerId: 1, model: 'a', features: ['fill'] }, { providerId: 1, model: 'b', features: ['fill'] }] })).toThrow(/Only one/);
		expect(() => parseModelsInput({ models: [{ providerId: 1, model: 'a' }, { providerId: 1, model: 'a' }] })).toThrow(/twice/);
		expect(() => parseModelsInput({ models: [{ providerId: 1, model: 'a', features: ['chat'] }] })).toThrow();
	});

	it('makes a new package, grants it, and only deletes it while nobody has had it', async () => {
		await addProvider();
		const r = await call('POST', '/api/admin/packages', { name: 'Exam Sprint', priceMonthUsd: 7.5, priceYearUsd: 60, aiCredits: 2500, blurb: 'JLPT drills' });
		expect(r.status).toBe(201);
		const id = r.body.created as string;
		expect(id).toMatch(/^exam-sprint-[a-z0-9]{1,5}$/);
		const made = r.body.plans.at(-1);
		expect(made).toMatchObject({ id, name: 'Exam Sprint', available: false, builtin: false, models: [] });
		expect((await call('PUT', `/api/admin/packages/${id}/models`, { models: [{ providerId: 1, model: 'acme/fast-1', features: ['fill', 'propose'] }] })).status).toBe(200);

		const g = await call('POST', '/api/admin/accounts/2/grants', { plan: id, kind: 'comp', days: 30 });
		expect(g.status).toBe(200);
		expect(g.body.plan).toBe(id);
		expect((await call('DELETE', `/api/admin/packages/${id}`)).body.message).toMatch(/stays for the record/);
		expect((await call('DELETE', '/api/admin/packages/plus')).status).toBe(400);
		expect((await call('POST', '/api/admin/accounts/2/grants', { plan: 'gold', kind: 'comp', days: 3 })).body.message).toBe('No such package');

		const r2 = await call('POST', '/api/admin/packages', { name: 'Trial pack', priceMonthUsd: 1, priceYearUsd: 10, aiCredits: 500 });
		const id2 = r2.body.created;
		const del = await call('DELETE', `/api/admin/packages/${id2}`);
		expect(del.status).toBe(200);
		expect(del.body.plans.map((p: any) => p.id)).not.toContain(id2);
		expect(audit().map((a) => a.action)).toEqual(expect.arrayContaining(['package.create', 'package.models', 'package.grant', 'package.delete']));
	});
});

describe('helpers', () => {
	it('makes readable package ids', () => {
		expect(newPlanId('Exam Sprint!', new Uint8Array([1, 2, 3]))).toBe('exam-sprint-010203'.slice(0, 'exam-sprint-'.length + 5));
		expect(newPlanId('แพ็กเกจ', new Uint8Array([10, 20, 30]))).toMatch(/^pkg-/);
	});

	it('takes the fixed base URL from the preset and checks custom ones', () => {
		const w = new URL('https://benkyo.jirachai.me');
		expect(parseProviderInput({ preset: 'gemini', apiKey: 'AIza-12345678' }, w)).toMatchObject({ label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' });
		expect(parseProviderInput({ preset: 'anthropic', apiKey: 'sk-ant-12345678' }, w).baseUrl).toBeNull();
		expect(() => parseProviderInput({ preset: 'custom', apiKey: 'sk-12345678', baseUrl: 'http://evil.example/v1' }, w)).toThrow(/https/);
		expect(() => parseProviderInput({ preset: 'custom', apiKey: 'sk-12345678', baseUrl: 'https://llm.example/v1' }, w)).toThrow(/name/);
		expect(() => parseProviderInput({ preset: 'nope', apiKey: 'sk-12345678' }, w)).toThrow(/Pick/);
	});

	it('keeps keys out of error messages and binds ciphertexts to the platform table', () => {
		expect(listError(new Error('HTTP 429'), 'Groq')).toBe('Groq answered 429');
		expect(listError(new Error('sk-secret leaked in some message'), 'Groq')).toBe('Couldn’t list models from Groq');
		expect(providerAad('anthropic', null)).not.toMatch(/^ai-cred/);
	});
});
