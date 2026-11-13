/**
 * Anthropic adapter: official SDK, structured outputs, prompt caching and the
 * server-side refusal fallback (docs/AI-PLAN.md §4 "API details").
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
	BetaContentBlockParam,
	BetaMessage,
	MessageCreateParamsNonStreaming
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ModelInfo as AnthropicModelInfo } from '@anthropic-ai/sdk/resources/models';
import type { PromptParts } from '../../src/lib/ai/prompts.ts';
import type { AdapterResult, ProviderModel, UsageEntry } from './types.ts';

/** Models that get `fallbacks: "default"` (beta server-side-fallback-2026-07-01). */
export const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2']);
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const usesFallback = (model: string) => FALLBACK_MODELS.has(model.replace(/-\d{8}$/, ''));

type FetchLike = typeof fetch;

function client(apiKey: string, fetchImpl?: FetchLike) {
	return new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

/**
 * The Messages request for a prompt. The large, constant system prompt is a
 * cacheable block; the volatile parts (known kana, items) are the user turn.
 * No assistant prefill; thinking left at the model default (adaptive).
 */
export function buildAnthropicRequest(parts: PromptParts, model: string): MessageCreateParamsNonStreaming {
	const content: BetaContentBlockParam[] = [];
	if (parts.image) {
		content.push({
			type: 'image',
			source: { type: 'base64', media_type: parts.image.mediaType, data: parts.image.base64 }
		});
	}
	content.push({ type: 'text', text: parts.user });
	const req: MessageCreateParamsNonStreaming = {
		model,
		max_tokens: parts.maxTokens,
		system: [{ type: 'text', text: parts.system, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
		output_config: { effort: 'low', format: { type: 'json_schema', schema: parts.schema } }
	};
	if (usesFallback(model)) {
		req.betas = [FALLBACK_BETA];
		req.fallbacks = 'default';
	}
	return req;
}

/** Token usage per model that ran (the fallback may bill a second model). */
export function anthropicUsage(msg: Pick<BetaMessage, 'usage' | 'model'>, requested: string): UsageEntry[] {
	const u = msg.usage;
	const iters = (u.iterations ?? []).filter(
		(i): i is Extract<typeof i, { type: 'message' | 'fallback_message' }> =>
			i.type === 'message' || i.type === 'fallback_message'
	);
	if (iters.length > 1 || iters.some((i) => i.type === 'fallback_message')) {
		return iters.map((i) => ({
			model: i.model ?? requested,
			input: i.input_tokens,
			cacheWrite: i.cache_creation_input_tokens ?? 0,
			cacheRead: i.cache_read_input_tokens ?? 0,
			output: i.output_tokens
		}));
	}
	return [
		{
			model: msg.model || requested,
			input: u.input_tokens,
			cacheWrite: u.cache_creation_input_tokens ?? 0,
			cacheRead: u.cache_read_input_tokens ?? 0,
			output: u.output_tokens
		}
	];
}

/** Turn a Message into adapter output, checking stop_reason before parsing. */
export function readAnthropicMessage(msg: BetaMessage, requested: string): AdapterResult {
	const usage = anthropicUsage(msg, requested);
	if (msg.stop_reason === 'refusal') {
		return { ok: false, status: 502, error: 'provider', message: 'The model declined this request.', usage };
	}
	if (msg.stop_reason === 'max_tokens') {
		return { ok: false, status: 502, error: 'invalid_output', message: 'The reply was cut off (max_tokens).', usage };
	}
	const text = msg.content
		.filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
		.map((b) => b.text)
		.join('');
	if (!text.trim()) return { ok: false, status: 502, error: 'invalid_output', message: 'Empty reply.', usage };
	return { ok: true, text, usage };
}

export async function callAnthropic(
	parts: PromptParts,
	model: string,
	apiKey: string,
	fetchImpl?: FetchLike
): Promise<AdapterResult> {
	try {
		const msg = await client(apiKey, fetchImpl).beta.messages.create(buildAnthropicRequest(parts, model));
		return readAnthropicMessage(msg, model);
	} catch (e) {
		return anthropicError(e);
	}
}

function anthropicError(e: unknown): AdapterResult {
	if (e instanceof Anthropic.APIConnectionError) {
		// Outcome unknown (timeout / dropped connection): keep the reserved worst case.
		return { ok: false, status: 502, error: 'provider', message: 'Could not reach Anthropic.', usage: [], billedUnknown: true };
	}
	if (e instanceof Anthropic.APIError) {
		const why =
			e.status === 401 || e.status === 403
				? 'Anthropic rejected the API key.'
				: e.status === 429
					? 'Anthropic rate limit reached; try again shortly.'
					: e.status === 404
						? 'Model not found for this key.'
						: `Anthropic error ${e.status ?? ''}: ${e.message}`.trim();
		return { ok: false, status: 502, error: 'provider', message: why, usage: [] };
	}
	return { ok: false, status: 502, error: 'provider', message: (e as Error)?.message ?? 'Anthropic call failed', usage: [] };
}

// ---------------------------------------------------------------- models ----

export function mapAnthropicModel(m: AnthropicModelInfo): ProviderModel {
	const c = m.capabilities;
	return {
		id: m.id,
		label: m.display_name || m.id,
		contextTokens: m.max_input_tokens ?? null,
		maxOutput: m.max_tokens ?? null,
		vision: c ? !!c.image_input?.supported : null,
		structured: c ? !!c.structured_outputs?.supported : null,
		providerPrice: null
	};
}

/** All non-retired models, following pagination. */
export async function listAnthropicModels(apiKey: string, fetchImpl?: FetchLike): Promise<ProviderModel[]> {
	const out: ProviderModel[] = [];
	for await (const m of client(apiKey, fetchImpl).models.list({ limit: 100 })) {
		if (m.lifecycle === 'retired') continue;
		out.push(mapAnthropicModel(m));
		if (out.length >= 500) break;
	}
	return out;
}
