/**
 * OpenAI-compatible adapter (OpenRouter, Groq, OpenAI, ...): plain fetch.
 * `response_format: json_schema` first; falls back to `json_object` when the
 * server rejects schemas. Output is validated by the caller (validate.ts),
 * which retries once on invalid JSON.
 */
import { openAiChatBody, type PromptParts } from '../../src/lib/ai/prompts.ts';
import { estimateInputTokens, parsePerTokenPricing } from '../../src/lib/ai/prices.ts';
import type { AdapterResult, ProviderModel, UsageEntry } from './types.ts';

type FetchLike = typeof fetch;
export type OpenAiFormat = 'json_schema' | 'json_object';
const TIMEOUT_MS = 90_000;

const headers = (apiKey: string) => ({
	authorization: `Bearer ${apiKey}`,
	'content-type': 'application/json',
	'x-title': 'Benkyo'
});

interface ChatResponse {
	choices?: {
		finish_reason?: string | null;
		message?: { content?: unknown; refusal?: string | null };
	}[];
	usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
}

function contentText(c: unknown): string {
	if (typeof c === 'string') return c;
	if (Array.isArray(c))
		return c
			.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))
			.join('');
	return '';
}

function usageOf(data: ChatResponse, model: string, parts: PromptParts, text: string): UsageEntry[] {
	const u = data.usage;
	if (u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)) {
		// Cached prompt tokens are billed at full input price here (conservative across providers).
		return [{ model, input: u.prompt_tokens!, cacheRead: 0, output: u.completion_tokens! }];
	}
	// Server didn't report usage: estimate on the high side.
	return [
		{
			model,
			input: estimateInputTokens([parts.system, parts.user], parts.image ? 1 : 0),
			output: Math.ceil(text.length / 2) + 50
		}
	];
}

export async function callOpenAi(
	parts: PromptParts,
	model: string,
	baseUrl: string,
	apiKey: string,
	opts: { retry?: boolean; fetch?: FetchLike; format?: OpenAiFormat } = {}
): Promise<AdapterResult & { format?: OpenAiFormat }> {
	const f = opts.fetch ?? fetch;
	let format: OpenAiFormat = opts.format ?? 'json_schema';
	let maxTokensKey: 'max_tokens' | 'max_completion_tokens' = 'max_tokens';
	for (let attempt = 0; attempt < 3; attempt++) {
		const body = openAiChatBody(parts, model, format, opts.retry);
		if (maxTokensKey === 'max_completion_tokens') {
			body.max_completion_tokens = body.max_tokens;
			delete body.max_tokens;
		}
		let res: Response;
		try {
			res = await f(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: headers(apiKey),
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
		} catch (e) {
			return {
				ok: false,
				status: 502,
				error: 'provider',
				message: `Could not reach the provider: ${(e as Error).message}`,
				usage: [],
				billedUnknown: true
			};
		}
		if (res.status === 400 || res.status === 422) {
			const errText = (await res.text()).slice(0, 2000);
			// Request-shape rejections aren't billed: adjust and resend.
			if (format === 'json_schema' && /response_format|json_schema|structured/i.test(errText)) {
				format = 'json_object';
				continue;
			}
			if (maxTokensKey === 'max_tokens' && /max_tokens/i.test(errText) && /max_completion_tokens/i.test(errText)) {
				maxTokensKey = 'max_completion_tokens';
				continue;
			}
			return { ok: false, status: 502, error: 'provider', message: `Provider rejected the request: ${errText.slice(0, 300)}`, usage: [] };
		}
		if (!res.ok) {
			const why =
				res.status === 401 || res.status === 403
					? 'The provider rejected the API key.'
					: res.status === 429
						? 'Provider rate limit reached; try again shortly.'
						: `Provider error ${res.status}.`;
			return { ok: false, status: 502, error: 'provider', message: why, usage: [] };
		}
		let data: ChatResponse;
		try {
			data = await res.json();
		} catch {
			return { ok: false, status: 502, error: 'provider', message: 'Provider returned non-JSON.', usage: [], billedUnknown: true };
		}
		const choice = data.choices?.[0];
		const text = contentText(choice?.message?.content);
		const usage = usageOf(data, model, parts, text);
		if (choice?.message?.refusal || choice?.finish_reason === 'content_filter')
			return { ok: false, status: 502, error: 'provider', message: 'The model declined this request.', usage };
		if (choice?.finish_reason === 'length')
			return { ok: false, status: 502, error: 'invalid_output', message: 'The reply was cut off (max_tokens).', usage };
		if (!text.trim()) return { ok: false, status: 502, error: 'invalid_output', message: 'Empty reply.', usage };
		return { ok: true, text, usage, format };
	}
	return { ok: false, status: 502, error: 'provider', message: 'Provider rejected the request format.', usage: [] };
}

// ---------------------------------------------------------------- models ----

interface OaiModel {
	id?: unknown;
	name?: unknown;
	context_length?: unknown;
	pricing?: unknown;
	top_provider?: { max_completion_tokens?: unknown; context_length?: unknown };
	architecture?: { input_modalities?: unknown; modality?: unknown };
	supported_parameters?: unknown;
}

const posInt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

export function mapOpenAiModel(m: OaiModel): ProviderModel | null {
	if (typeof m?.id !== 'string' || !m.id || m.id.length > 200) return null;
	const mods = m.architecture?.input_modalities;
	const vision = Array.isArray(mods)
		? mods.includes('image')
		: typeof m.architecture?.modality === 'string'
			? /image/.test(m.architecture.modality.split('->')[0])
			: null;
	const params = m.supported_parameters;
	const structured = Array.isArray(params)
		? params.includes('structured_outputs') || params.includes('response_format')
		: null;
	return {
		id: m.id,
		label: typeof m.name === 'string' && m.name ? m.name.slice(0, 200) : m.id,
		contextTokens: posInt(m.context_length) ?? posInt(m.top_provider?.context_length),
		maxOutput: posInt(m.top_provider?.max_completion_tokens),
		vision,
		structured,
		providerPrice: parsePerTokenPricing(m.pricing)
	};
}

export async function listOpenAiModels(baseUrl: string, apiKey: string, fetchImpl?: FetchLike): Promise<ProviderModel[]> {
	const res = await (fetchImpl ?? fetch)(`${baseUrl}/models`, {
		headers: headers(apiKey),
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'API key rejected' : `HTTP ${res.status}`);
	const data = (await res.json()) as { data?: unknown } | unknown[];
	const list = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown }).data) ? (data as { data: unknown[] }).data : [];
	return list
		.slice(0, 2000)
		.map((m) => mapOpenAiModel(m as OaiModel))
		.filter((m): m is ProviderModel => !!m);
}

// ------------------------------------------------------------- streaming ----

interface ChatChunk {
	choices?: { delta?: { content?: unknown; refusal?: string | null }; finish_reason?: string | null }[];
	usage?: ChatResponse['usage'];
}

/** Server-sent events → the `data:` payloads, one at a time. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += value;
		let i: number;
		while ((i = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, i).replace(/\r$/, '');
			buf = buf.slice(i + 1);
			if (line.startsWith('data:')) yield line.slice(5).trimStart();
		}
	}
	if (buf.startsWith('data:')) yield buf.slice(5).trimStart();
}

/** Streamed plain-text reply (Ask AI) from an OpenAI-compatible server. */
export async function streamOpenAi(
	parts: PromptParts,
	model: string,
	baseUrl: string,
	apiKey: string,
	onText: (t: string) => void,
	opts: { signal?: AbortSignal; fetch?: FetchLike } = {}
): Promise<AdapterResult> {
	const f = opts.fetch ?? fetch;
	let maxTokensKey: 'max_tokens' | 'max_completion_tokens' = 'max_tokens';
	let includeUsage = true;
	for (let attempt = 0; attempt < 3; attempt++) {
		const body = openAiChatBody(parts, model, 'json_schema');
		body.stream = true;
		if (includeUsage) body.stream_options = { include_usage: true };
		if (maxTokensKey === 'max_completion_tokens') {
			body.max_completion_tokens = body.max_tokens;
			delete body.max_tokens;
		}
		let res: Response;
		try {
			const signals = [AbortSignal.timeout(TIMEOUT_MS), ...(opts.signal ? [opts.signal] : [])];
			res = await f(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: { ...headers(apiKey), accept: 'text/event-stream' },
				body: JSON.stringify(body),
				signal: AbortSignal.any(signals)
			});
		} catch (e) {
			return { ok: false, status: 502, error: 'provider', message: `Could not reach the provider: ${(e as Error).message}`, usage: [], billedUnknown: true };
		}
		if (res.status === 400 || res.status === 422) {
			const errText = (await res.text()).slice(0, 2000);
			if (includeUsage && /stream_options|include_usage/i.test(errText)) {
				includeUsage = false;
				continue;
			}
			if (maxTokensKey === 'max_tokens' && /max_tokens/i.test(errText) && /max_completion_tokens/i.test(errText)) {
				maxTokensKey = 'max_completion_tokens';
				continue;
			}
			return { ok: false, status: 502, error: 'provider', message: `Provider rejected the request: ${errText.slice(0, 300)}`, usage: [] };
		}
		if (!res.ok || !res.body) {
			const why =
				res.status === 401 || res.status === 403
					? 'The provider rejected the API key.'
					: res.status === 429
						? 'Provider rate limit reached; try again shortly.'
						: `Provider error ${res.status}.`;
			return { ok: false, status: 502, error: 'provider', message: why, usage: [] };
		}
		let text = '';
		let finish: string | null | undefined;
		let refused = false;
		let reported: ChatResponse['usage'];
		try {
			if (!(res.headers.get('content-type') ?? '').includes('event-stream')) {
				// Server ignored `stream: true`: read the whole reply.
				const data = (await res.json()) as ChatResponse;
				const c = data.choices?.[0];
				text = contentText(c?.message?.content);
				if (text) onText(text);
				finish = c?.finish_reason;
				refused = !!c?.message?.refusal;
				reported = data.usage;
			} else {
				for await (const d of sseData(res.body)) {
					if (d === '[DONE]') break;
					let chunk: ChatChunk;
					try {
						chunk = JSON.parse(d);
					} catch {
						continue;
					}
					if (chunk.usage) reported = chunk.usage;
					const c = chunk.choices?.[0];
					if (!c) continue;
					if (c.delta?.refusal) refused = true;
					const t = contentText(c.delta?.content);
					if (t) {
						text += t;
						onText(t);
					}
					if (c.finish_reason) finish = c.finish_reason;
				}
			}
		} catch (e) {
			return {
				ok: false,
				status: 502,
				error: 'provider',
				message: `The reply stream broke: ${(e as Error).message}`,
				usage: usageOf({ usage: reported }, model, parts, text),
				billedUnknown: true
			};
		}
		const usage = usageOf({ usage: reported }, model, parts, text);
		if (refused || finish === 'content_filter')
			return { ok: false, status: 502, error: 'provider', message: 'The model declined this request.', usage };
		if (!text.trim()) return { ok: false, status: 502, error: 'invalid_output', message: 'Empty reply.', usage };
		// A reply cut off by max_tokens is still shown; the answer is usually complete enough.
		return { ok: true, text, usage };
	}
	return { ok: false, status: 502, error: 'provider', message: 'Provider rejected the request format.', usage: [] };
}
