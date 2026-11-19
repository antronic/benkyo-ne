/**
 * Fleet console: platform AI providers (the operator's own keys, for the
 * managed AI that paid packages include) and the models each one offers.
 *
 *   GET    /api/admin/ai/providers                    providers, presets, whether keys can be saved
 *   POST   /api/admin/ai/providers {AdminProviderInput}  add one; the key must list models first  step-up
 *   PATCH  /api/admin/ai/providers/:id {AdminProviderPatch}  rename, turn off/on, replace the key  step-up
 *   DELETE /api/admin/ai/providers/:id                 remove (refused while a package uses it)  step-up
 *   GET    /api/admin/ai/providers/:id/models?refresh=1  every model the provider's API lists
 *   GET    /api/admin/ai/models?refresh=1             the same across all turned-on providers
 *
 * Keys are sealed with AI_MASTER_KEY (worker/crypto.ts), bound to this table
 * by their additional data so a learner's key row can't be swapped in, and
 * never returned: only the last four characters. The audit log never sees a key.
 * Model lists are cached for an hour per provider (Cache API); the cache key
 * holds only the provider id and its last change, never the key.
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
	AdminModel,
	AdminModels,
	AdminProvider,
	AdminProviderInput,
	AdminProviderKind,
	AdminProviderPatch,
	AdminProviderPreset,
	AdminProviders
} from '../../src/lib/admin/contract.ts';
import { resolvePrice } from '../../src/lib/ai/prices.ts';
import { listAnthropicModels } from '../ai/anthropic.ts';
import { normalizeBaseUrl } from '../ai/credentials.ts';
import { listOpenAiModels } from '../ai/openai.ts';
import type { ProviderModel } from '../ai/types.ts';
import { deriveKey, open, seal } from '../crypto.ts';
import type { Env } from '../env.ts';
import { HttpError, httpError, json, readJson } from '../http.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

export const PRESETS: AdminProviderPreset[] = [
	{ id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: null, keysUrl: 'https://console.anthropic.com/settings/keys' },
	{ id: 'openai', name: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', keysUrl: 'https://platform.openai.com/api-keys' },
	{ id: 'gemini', name: 'Google Gemini', kind: 'openai-compatible', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keysUrl: 'https://aistudio.google.com/apikey' },
	{ id: 'openrouter', name: 'OpenRouter', kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', keysUrl: 'https://openrouter.ai/settings/keys' },
	{ id: 'groq', name: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', keysUrl: 'https://console.groq.com/keys' },
	{ id: 'mistral', name: 'Mistral', kind: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', keysUrl: 'https://console.mistral.ai/api-keys' },
	{ id: 'deepseek', name: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', keysUrl: 'https://platform.deepseek.com/api_keys' },
	{ id: 'xai', name: 'xAI', kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1', keysUrl: 'https://console.x.ai' },
	{ id: 'together', name: 'Together AI', kind: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', keysUrl: 'https://api.together.ai/settings/api-keys' },
	{ id: 'custom', name: 'Other (OpenAI-compatible)', kind: 'openai-compatible', baseUrl: null, keysUrl: null }
];
const presetOf = (id: unknown) => PRESETS.find((p) => p.id === id);

export const MAX_PROVIDERS = 20;
const CACHE_TTL_S = 3600;

export interface ProviderRow {
	id: number;
	kind: AdminProviderKind;
	preset: string;
	label: string;
	base_url: string | null;
	key_cipher: string;
	key_iv: string;
	key_last4: string;
	enabled: number;
	model_count: number | null;
	checked_at: number | null;
	check_error: string | null;
	created_at: number;
	created_by: number | null;
	updated_at: number;
}

/** Additional data for the AES-GCM seal: a different prefix from learner keys (worker/ai/credentials.ts). */
export const providerAad = (kind: AdminProviderKind, baseUrl: string | null) => `platform-ai|v1|${kind}|${baseUrl ?? ''}`;

async function masterKey(env: Env) {
	try {
		return await deriveKey(env.AI_MASTER_KEY);
	} catch (e) {
		throw httpError(503, 'provider', `Keys can’t be saved: ${(e as Error).message}`);
	}
}

export async function decryptProvider(env: Env, r: ProviderRow) {
	const key = await masterKey(env);
	try {
		return await open(key, { cipher: r.key_cipher, iv: r.key_iv }, providerAad(r.kind, r.base_url));
	} catch {
		throw httpError(503, 'provider', 'The stored key could not be decrypted (was AI_MASTER_KEY changed?)');
	}
}

/** A short, key-free reason a provider's model list failed. */
export function listError(e: unknown, label: string): string {
	if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return `${label} rejected the API key`;
	if (e instanceof Anthropic.APIConnectionError) return `Couldn’t reach ${label}`;
	if (e instanceof Anthropic.APIError) return `${label} answered ${e.status ?? 'with an error'}`;
	const m = (e as Error)?.message ?? 'failed';
	if (m === 'API key rejected') return `${label} rejected the API key`;
	if (/^HTTP \d+$/.test(m)) return `${label} answered ${m.slice(5)}`;
	if ((e as Error)?.name === 'TimeoutError') return `${label} took too long to answer`;
	return `Couldn’t list models from ${label}`;
}

/** Ask the provider's API for its models. Throws on failure. */
async function fetchModels(kind: AdminProviderKind, baseUrl: string | null, apiKey: string): Promise<ProviderModel[]> {
	return kind === 'anthropic' ? listAnthropicModels(apiKey) : listOpenAiModels(baseUrl!, apiKey);
}

function edgeCache(): Cache | null {
	try {
		return typeof caches !== 'undefined' ? caches.default : null;
	} catch {
		return null;
	}
}
const cacheKey = (r: ProviderRow) => `https://ai-models.benkyo.internal/platform/${r.id}/${r.updated_at}`;

/** The provider's models, from the hour-long cache unless `refresh`. Records the check on the row. */
export async function modelsOf(env: Env, r: ProviderRow, refresh = false): Promise<{ list: ProviderModel[]; fetchedAt: number }> {
	const cache = edgeCache();
	const key = cacheKey(r);
	if (!refresh) {
		const hit = await cache?.match(key);
		if (hit) return { list: await hit.json(), fetchedAt: Number(hit.headers.get('x-fetched-at')) || Date.now() };
	}
	const now = Date.now();
	let list: ProviderModel[];
	try {
		list = await fetchModels(r.kind, r.base_url, await decryptProvider(env, r));
	} catch (e) {
		// Only our own errors (undecryptable key, missing master key) pass their text through; a provider's
		// error text is third-party and is replaced by listError's fixed message.
		const message = e instanceof HttpError && e.status === 503 ? e.message : listError(e, r.label);
		try {
			await env.DB.prepare(`UPDATE ai_providers SET checked_at = ?1, check_error = ?2 WHERE id = ?3`).bind(now, message, r.id).run();
		} catch {
			/* recording the failed check is best effort; the readable 502 below matters more */
		}
		throw httpError(502, 'provider', message);
	}
	await env.DB.prepare(`UPDATE ai_providers SET checked_at = ?1, check_error = NULL, model_count = ?2 WHERE id = ?3`)
		.bind(now, list.length, r.id)
		.run();
	await cache?.put(
		key,
		new Response(JSON.stringify(list), {
			headers: { 'content-type': 'application/json', 'cache-control': `max-age=${CACHE_TTL_S}`, 'x-fetched-at': String(now) }
		})
	);
	return { list, fetchedAt: now };
}

export async function providerRow(env: Env, id: number): Promise<ProviderRow | null> {
	return (await env.DB.prepare(`SELECT * FROM ai_providers WHERE id = ?1`).bind(id).first<ProviderRow>()) ?? null;
}

/** provider id → model id → package names */
async function usage(env: Env) {
	const { results } = await env.DB.prepare(
		`SELECT m.provider_id AS providerId, m.model, p.name FROM plan_models m JOIN plans p ON p.id = m.plan_id ORDER BY p.rank`
	).all<{ providerId: number; model: string; name: string }>();
	const out = new Map<number, Map<string, string[]>>();
	for (const r of results) {
		const byModel = out.get(r.providerId) ?? new Map<string, string[]>();
		byModel.set(r.model, [...(byModel.get(r.model) ?? []), r.name]);
		out.set(r.providerId, byModel);
	}
	return out;
}

const toProvider = (r: ProviderRow, used: Map<string, string[]> | undefined): AdminProvider => ({
	id: r.id,
	kind: r.kind,
	preset: r.preset,
	label: r.label,
	baseUrl: r.base_url,
	last4: r.key_last4,
	enabled: !!r.enabled,
	modelCount: r.model_count,
	checkedAt: r.checked_at,
	checkError: r.check_error,
	createdAt: r.created_at,
	updatedAt: r.updated_at,
	usedBy: [...new Set([...(used?.values() ?? [])].flat())]
});

async function providers(env: Env): Promise<AdminProviders> {
	const [{ results }, used] = await Promise.all([
		env.DB.prepare(`SELECT * FROM ai_providers ORDER BY id`).all<ProviderRow>(),
		usage(env)
	]);
	return { providers: results.map((r) => toProvider(r, used.get(r.id))), presets: PRESETS, canSaveKeys: !!env.AI_MASTER_KEY };
}

export function toAdminModel(providerId: number, m: ProviderModel, inPackages: string[] = []): AdminModel {
	const price = resolvePrice(m.id, m.providerPrice, null);
	return {
		providerId,
		id: m.id,
		label: m.label,
		contextTokens: m.contextTokens,
		maxOutput: m.maxOutput,
		vision: m.vision,
		structured: m.structured,
		inputPerM: price?.price.inputPerM ?? null,
		outputPerM: price?.price.outputPerM ?? null,
		priceSource: price ? (price.source === 'provider' ? 'provider' : 'builtin') : null,
		inPackages
	};
}

// ------------------------------------------------------------- validation ----

const clean = (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

function parseLabel(v: unknown, fallback?: string): string {
	if (v === undefined || v === null || v === '') {
		if (fallback) return fallback;
		throw httpError(400, 'bad_request', 'Give the provider a name');
	}
	if (typeof v !== 'string') throw httpError(400, 'bad_request', 'The name must be text');
	const t = clean(v).slice(0, 40);
	if (!t) throw httpError(400, 'bad_request', 'Give the provider a name');
	return t;
}

function parseKey(v: unknown): string {
	const k = typeof v === 'string' ? v.trim() : '';
	if (k.length < 8 || k.length > 500 || /\s/.test(k)) throw httpError(400, 'bad_request', 'That API key looks wrong');
	return k;
}

export function parseProviderInput(body: unknown, workerUrl: URL) {
	const b = (body ?? {}) as Partial<AdminProviderInput>;
	const preset = presetOf(b.preset);
	if (!preset) throw httpError(400, 'bad_request', 'Pick a provider');
	const baseUrl = preset.kind === 'anthropic' ? null : (preset.baseUrl ?? normalizeBaseUrl(b.baseUrl, workerUrl));
	return { preset, label: parseLabel(b.label, preset.id === 'custom' ? undefined : preset.name), baseUrl, apiKey: parseKey(b.apiKey) };
}

export function parseProviderPatch(body: unknown): AdminProviderPatch {
	const b = (body ?? {}) as Record<string, unknown>;
	const out: AdminProviderPatch = {};
	if (b.label !== undefined) out.label = parseLabel(b.label);
	if (b.enabled !== undefined) {
		if (typeof b.enabled !== 'boolean') throw httpError(400, 'bad_request', '`enabled` must be true or false');
		out.enabled = b.enabled;
	}
	if (b.apiKey !== undefined) out.apiKey = parseKey(b.apiKey);
	if (!Object.keys(out).length) throw httpError(400, 'bad_request', 'Nothing to change');
	return out;
}

// ---------------------------------------------------------------- handlers ----

async function create(req: Request, env: Env, url: URL, ctx: AdminContext) {
	const input = parseProviderInput(await readJson(req, 4096), url);
	await requireFresh(env, ctx);
	const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ai_providers`).first<{ n: number }>();
	if ((n?.n ?? 0) >= MAX_PROVIDERS) throw httpError(400, 'bad_request', `Up to ${MAX_PROVIDERS} providers`);
	const key = await masterKey(env);
	// The key has to work before it's kept: list the provider's models with it.
	let count: number;
	try {
		count = (await fetchModels(input.preset.kind, input.baseUrl, input.apiKey)).length;
	} catch (e) {
		throw httpError(400, 'bad_request', listError(e, input.label));
	}
	const sealed = await seal(key, input.apiKey, providerAad(input.preset.kind, input.baseUrl));
	const now = Date.now();
	const last4 = input.apiKey.slice(-4);
	await audited(env, ctx, 'ai.provider.add', null, { label: input.label, preset: input.preset.id, baseUrl: input.baseUrl, last4, models: count }, [
		env.DB.prepare(
			`INSERT INTO ai_providers (kind, preset, label, base_url, key_cipher, key_iv, key_last4, model_count, checked_at, created_at, created_by, updated_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?9)`
		).bind(input.preset.kind, input.preset.id, input.label, input.baseUrl, sealed.cipher, sealed.iv, last4, count, now, ctx.session.userId)
	]);
	return json(await providers(env), { status: 201 });
}

async function update(req: Request, env: Env, ctx: AdminContext, id: number) {
	const patch = parseProviderPatch(await readJson(req, 4096));
	await requireFresh(env, ctx);
	const r = await providerRow(env, id);
	if (!r) throw httpError(404, 'bad_request', 'No such provider');
	const sets: string[] = [];
	const values: unknown[] = [];
	const detail: Record<string, unknown> = { label: r.label };
	const set = (col: string, v: unknown) => {
		values.push(v);
		sets.push(`${col} = ?${values.length}`);
	};
	if (patch.label !== undefined && patch.label !== r.label) {
		set('label', patch.label);
		detail.rename = { from: r.label, to: patch.label };
	}
	if (patch.enabled !== undefined && patch.enabled !== !!r.enabled) {
		set('enabled', patch.enabled ? 1 : 0);
		detail.enabled = patch.enabled;
	}
	if (patch.apiKey !== undefined) {
		const key = await masterKey(env);
		let count: number;
		try {
			count = (await fetchModels(r.kind, r.base_url, patch.apiKey)).length;
		} catch (e) {
			throw httpError(400, 'bad_request', listError(e, patch.label ?? r.label));
		}
		const sealed = await seal(key, patch.apiKey, providerAad(r.kind, r.base_url));
		set('key_cipher', sealed.cipher);
		set('key_iv', sealed.iv);
		set('key_last4', patch.apiKey.slice(-4));
		set('model_count', count);
		set('check_error', null);
		set('checked_at', Date.now());
		detail.key = { from: r.key_last4, to: patch.apiKey.slice(-4) };
	}
	if (sets.length) {
		set('updated_at', Date.now());
		values.push(id);
		await audited(env, ctx, 'ai.provider.update', null, { provider: id, ...detail }, [
			env.DB.prepare(`UPDATE ai_providers SET ${sets.join(', ')} WHERE id = ?${values.length}`).bind(...values)
		]);
		await edgeCache()?.delete(cacheKey(r));
	}
	return json(await providers(env));
}

async function remove(env: Env, ctx: AdminContext, id: number) {
	await requireFresh(env, ctx);
	const r = await providerRow(env, id);
	if (!r) throw httpError(404, 'bad_request', 'No such provider');
	const used = [...new Set([...((await usage(env)).get(id)?.values() ?? [])].flat())];
	if (used.length)
		throw httpError(400, 'bad_request', `Take its models out of ${used.join(', ')} first, or turn the provider off instead`);
	await audited(env, ctx, 'ai.provider.remove', null, { provider: id, label: r.label, preset: r.preset, last4: r.key_last4 }, [
		env.DB.prepare(`DELETE FROM ai_providers WHERE id = ?1`).bind(id)
	]);
	await edgeCache()?.delete(cacheKey(r));
	return json(await providers(env));
}

async function providerModels(env: Env, id: number, refresh: boolean): Promise<AdminModels> {
	const r = await providerRow(env, id);
	if (!r) throw httpError(404, 'bad_request', 'No such provider');
	const [{ list, fetchedAt }, used] = await Promise.all([modelsOf(env, r, refresh), usage(env)]);
	const byModel = used.get(id);
	return { models: list.map((m) => toAdminModel(id, m, byModel?.get(m.id))), fetchedAt, providers: [{ id, label: r.label }], errors: [] };
}

/** Every turned-on provider's models. A provider that fails is reported, not fatal. */
export async function allModels(env: Env, refresh = false): Promise<AdminModels> {
	const [{ results }, used] = await Promise.all([
		env.DB.prepare(`SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY id`).all<ProviderRow>(),
		usage(env)
	]);
	const errors: AdminModels['errors'] = [];
	let fetchedAt = Date.now();
	const lists = await Promise.all(
		results.map(async (r) => {
			try {
				const got = await modelsOf(env, r, refresh);
				fetchedAt = Math.min(fetchedAt, got.fetchedAt);
				return got.list.map((m) => toAdminModel(r.id, m, used.get(r.id)?.get(m.id)));
			} catch (e) {
				errors.push({ providerId: r.id, label: r.label, message: (e as Error).message });
				return [];
			}
		})
	);
	return { models: lists.flat(), fetchedAt, providers: results.map((r) => ({ id: r.id, label: r.label })), errors };
}

export async function handleProviders(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	const refresh = url.searchParams.get('refresh') === '1';
	if (p === '/api/admin/ai/providers') {
		if (m === 'GET') return json(await providers(env));
		if (m === 'POST') return create(req, env, url, ctx);
	}
	if (p === '/api/admin/ai/models' && m === 'GET') return json(await allModels(env, refresh));
	const one = /^\/api\/admin\/ai\/providers\/(\d{1,12})(\/models)?$/.exec(p);
	if (one && one[2] && m === 'GET') return json(await providerModels(env, Number(one[1]), refresh));
	if (one && !one[2] && m === 'PATCH') return update(req, env, ctx, Number(one[1]));
	if (one && !one[2] && m === 'DELETE') return remove(env, ctx, Number(one[1]));
	return null;
}
