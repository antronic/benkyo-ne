/**
 * Live model lists (D14), price resolution (D15) and per-feature model choice.
 * Each credential's provider list is cached for 1 h with the Cache API; the
 * cache key holds only the credential id and creation time, never the key.
 */
import type { Feature, FeatureModel, ModelInfo, Price, PriceSource, ProviderKind } from '../../src/lib/ai/contract.ts';
import { isValidPrice, resolvePrice } from '../../src/lib/ai/prices.ts';
import type { Env } from '../env.ts';
import { httpError } from '../http.ts';
import { listAnthropicModels } from './anthropic.ts';
import { decryptKey, getCredential, listCredentials, type CredRow } from './credentials.ts';
import { listOpenAiModels } from './openai.ts';
import type { ProviderModel } from './types.ts';

const CACHE_TTL_S = 3600;
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const FEATURES: Feature[] = ['fill', 'propose', 'vision', 'translate'];
/** Translate runs on the smallest model unless the learner picks another. */
export const TRANSLATE_MODEL = 'claude-haiku-5-5';

const cacheKey = (cred: CredRow) => `https://ai-models.benkyo.internal/v1/${cred.id}/${cred.created_at}`;

function edgeCache(): Cache | null {
	try {
		return typeof caches !== 'undefined' ? caches.default : null;
	} catch {
		return null;
	}
}

export async function providerModels(env: Env, ctx: ExecutionContext, cred: CredRow): Promise<ProviderModel[]> {
	const cache = edgeCache();
	const key = cacheKey(cred);
	const hit = await cache?.match(key);
	if (hit) return hit.json();
	const apiKey = await decryptKey(env, cred);
	const list =
		cred.provider === 'anthropic'
			? await listAnthropicModels(apiKey)
			: await listOpenAiModels(cred.base_url!, apiKey);
	if (cache) {
		const res = new Response(JSON.stringify(list), {
			headers: { 'content-type': 'application/json', 'cache-control': `max-age=${CACHE_TTL_S}` }
		});
		ctx.waitUntil(cache.put(key, res));
	}
	return list;
}

export async function dropModelCache(cred: CredRow) {
	await edgeCache()?.delete(cacheKey(cred));
}

type ManualPrices = Map<string, Price>;
const priceKey = (provider: ProviderKind, model: string) => `${provider}\u0000${model}`;

export async function manualPrices(env: Env, userId: number): Promise<ManualPrices> {
	const { results } = await env.DB.prepare(
		`SELECT provider, model, input_per_m AS inputPerM, output_per_m AS outputPerM FROM ai_model_prices WHERE user_id = ?1`
	)
		.bind(userId)
		.all<{ provider: ProviderKind; model: string } & Price>();
	return new Map(results.map((r) => [priceKey(r.provider, r.model), { inputPerM: r.inputPerM, outputPerM: r.outputPerM }]));
}

export function toModelInfo(cred: CredRow, m: ProviderModel, manual: ManualPrices): ModelInfo {
	const resolved = resolvePrice(m.id, m.providerPrice, manual.get(priceKey(cred.provider, m.id)));
	return {
		id: m.id,
		label: m.label,
		provider: cred.provider,
		credentialId: cred.id,
		contextTokens: m.contextTokens,
		maxOutput: m.maxOutput,
		vision: m.vision,
		structured: m.structured,
		price: resolved?.price ?? null,
		priceSource: resolved?.source ?? null
	};
}

/** All models across credentials. Per-credential failures are reported, not fatal. */
export async function listAllModels(env: Env, ctx: ExecutionContext, userId: number, onlyCredential?: number) {
	const creds = (await listCredentials(env, userId)).filter((c) => onlyCredential === undefined || c.id === onlyCredential);
	const manual = await manualPrices(env, userId);
	const errors: { credentialId: number; message: string }[] = [];
	const lists = await Promise.all(
		creds.map(async (c) => {
			try {
				return (await providerModels(env, ctx, c)).map((m) => toModelInfo(c, m, manual));
			} catch (e) {
				errors.push({ credentialId: c.id, message: ((e as Error).message ?? 'failed').slice(0, 200) });
				return [];
			}
		})
	);
	return { models: lists.flat(), errors };
}

/** Price for one model under a credential (D15), or null when unknown. */
export async function priceFor(
	env: Env,
	ctx: ExecutionContext,
	cred: CredRow,
	model: string
): Promise<{ price: Price; source: PriceSource } | null> {
	let providerPrice: Price | null = null;
	if (cred.provider === 'openai-compatible') {
		try {
			providerPrice = (await providerModels(env, ctx, cred)).find((m) => m.id === model)?.providerPrice ?? null;
		} catch {
			/* list unavailable: fall through to built-in / manual */
		}
	}
	const manual = await manualPrices(env, cred.user_id);
	return resolvePrice(model, providerPrice, manual.get(priceKey(cred.provider, model)));
}

export async function setManualPrice(env: Env, userId: number, body: unknown) {
	const b = (body ?? {}) as { provider?: unknown; model?: unknown; inputPerM?: unknown; outputPerM?: unknown };
	if (b.provider !== 'anthropic' && b.provider !== 'openai-compatible') throw httpError(400, 'bad_request', 'bad provider');
	if (typeof b.model !== 'string' || !b.model.trim() || b.model.length > 200) throw httpError(400, 'bad_request', 'bad model');
	const price = { inputPerM: b.inputPerM, outputPerM: b.outputPerM };
	if (!isValidPrice(price)) throw httpError(400, 'bad_request', 'prices must be numbers between 0 and 1000 (USD per million tokens)');
	await env.DB.prepare(
		`INSERT INTO ai_model_prices (user_id, provider, model, input_per_m, output_per_m, updated_at) VALUES (?6, ?1, ?2, ?3, ?4, ?5)
		 ON CONFLICT (user_id, provider, model) DO UPDATE SET input_per_m = ?3, output_per_m = ?4, updated_at = ?5`
	)
		.bind(b.provider, b.model.trim(), price.inputPerM, price.outputPerM, Date.now(), userId)
		.run();
	return { provider: b.provider, model: b.model.trim(), ...price };
}

// -------------------------------------------------------------- features ----

/**
 * Configured model per feature; unset (or pointing at a deleted credential)
 * falls back to the first Anthropic credential + Sonnet 5.5 (which also has
 * vision), or Haiku 5.5 for translate. Features with no usable credential are omitted.
 */
export async function featureModels(env: Env, userId: number): Promise<FeatureModel[]> {
	const [creds, { results }] = await Promise.all([
		listCredentials(env, userId),
		env.DB.prepare(`SELECT feature, credential_id AS credentialId, model FROM ai_feature_models WHERE user_id = ?1`)
			.bind(userId)
			.all<FeatureModel>()
	]);
	const ids = new Set(creds.map((c) => c.id));
	const firstAnthropic = creds.find((c) => c.provider === 'anthropic');
	const out: FeatureModel[] = [];
	for (const feature of FEATURES) {
		const row = results.find((r) => r.feature === feature && ids.has(r.credentialId));
		if (row) out.push({ feature, credentialId: row.credentialId, model: row.model });
		else if (firstAnthropic) out.push({ feature, credentialId: firstAnthropic.id, model: feature === 'translate' ? TRANSLATE_MODEL : DEFAULT_MODEL });
	}
	return out;
}

export async function resolveFeature(env: Env, userId: number, feature: Feature): Promise<{ cred: CredRow; model: string } | null> {
	const fm = (await featureModels(env, userId)).find((f) => f.feature === feature);
	if (!fm) return null;
	const cred = await getCredential(env, userId, fm.credentialId);
	return cred ? { cred, model: fm.model } : null;
}

export async function setFeatureModel(env: Env, userId: number, body: unknown): Promise<FeatureModel> {
	const b = (body ?? {}) as Partial<FeatureModel>;
	if (!FEATURES.includes(b.feature as Feature)) throw httpError(400, 'bad_request', 'feature must be fill, propose, vision or translate');
	if (!Number.isInteger(b.credentialId) || !(await getCredential(env, userId, b.credentialId!)))
		throw httpError(400, 'bad_request', 'unknown credentialId');
	if (typeof b.model !== 'string' || !b.model.trim() || b.model.length > 200) throw httpError(400, 'bad_request', 'bad model');
	const fm: FeatureModel = { feature: b.feature!, credentialId: b.credentialId!, model: b.model.trim() };
	await env.DB.prepare(
		`INSERT INTO ai_feature_models (user_id, feature, credential_id, model) VALUES (?4, ?1, ?2, ?3)
		 ON CONFLICT (user_id, feature) DO UPDATE SET credential_id = ?2, model = ?3`
	)
		.bind(fm.feature, fm.credentialId, fm.model, userId)
		.run();
	return fm;
}
