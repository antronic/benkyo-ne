import { describe, expect, it } from 'vitest';
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { buildFillPrompt, buildProposePrompt, FILL_SCHEMA, FILL_SYSTEM } from '../../src/lib/ai/prompts.ts';
import {
	anthropicUsage,
	buildAnthropicRequest,
	callAnthropic,
	FALLBACK_BETA,
	listAnthropicModels,
	readAnthropicMessage
} from './anthropic.ts';

const fill = buildFillPrompt({
	items: [{ key: 'k', text: '池', reading: 'いけ', kind: 'word', gloss: 'pond' }],
	knownKana: ['い', 'け'],
	allowExamples: true,
	secondLang: null,
	theme: false
});

const message = (over: Partial<BetaMessage> = {}): BetaMessage =>
	({
		id: 'msg_1',
		type: 'message',
		role: 'assistant',
		model: 'claude-sonnet-5-5',
		content: [
			{ type: 'thinking', thinking: '', signature: 'x' },
			{ type: 'text', text: '{"theme":null,"items":[]}', citations: null }
		],
		stop_reason: 'end_turn',
		stop_sequence: null,
		stop_details: null,
		usage: {
			input_tokens: 100,
			output_tokens: 50,
			cache_creation_input_tokens: 900,
			cache_read_input_tokens: 0,
			iterations: null
		},
		...over
	}) as unknown as BetaMessage;

describe('buildAnthropicRequest', () => {
	it('uses structured outputs, low effort, a cached system block and no prefill/thinking', () => {
		const r = buildAnthropicRequest(fill, 'claude-sonnet-5-5');
		expect(r.model).toBe('claude-sonnet-5-5');
		expect(r.max_tokens).toBe(4096);
		expect(r.system).toEqual([{ type: 'text', text: FILL_SYSTEM, cache_control: { type: 'ephemeral' } }]);
		expect(r.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: FILL_SCHEMA } });
		expect(r.messages).toHaveLength(1);
		expect(r.messages[0].role).toBe('user');
		expect('thinking' in r).toBe(false);
		expect('temperature' in r).toBe(false);
	});
	it('adds the refusal fallback for 5.5 / Fable 5.2 only', () => {
		for (const m of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2']) {
			const r = buildAnthropicRequest(fill, m);
			expect(r.betas).toEqual([FALLBACK_BETA]);
			expect(r.fallbacks).toBe('default');
		}
		for (const m of ['claude-haiku-5-5', 'claude-opus-4-8']) {
			const r = buildAnthropicRequest(fill, m);
			expect(r.betas).toBeUndefined();
			expect(r.fallbacks).toBeUndefined();
		}
	});
	it('puts the image block before the text', () => {
		const p = buildProposePrompt({ mode: 'screenshot', input: '', image: { mediaType: 'image/webp', base64: 'QUJD' }, secondLang: null });
		const r = buildAnthropicRequest(p, 'claude-sonnet-5-5');
		const content = r.messages[0].content as { type: string }[];
		expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'QUJD' } });
		expect(content[1].type).toBe('text');
	});
});

describe('readAnthropicMessage', () => {
	it('returns text blocks only', () => {
		const r = readAnthropicMessage(message(), 'claude-sonnet-5-5');
		expect(r).toMatchObject({ ok: true, text: '{"theme":null,"items":[]}' });
		expect(r.usage).toEqual([{ model: 'claude-sonnet-5-5', input: 100, cacheWrite: 900, cacheRead: 0, output: 50 }]);
	});
	it('checks stop_reason before parsing', () => {
		expect(readAnthropicMessage(message({ stop_reason: 'refusal' }), 'm')).toMatchObject({ ok: false, error: 'provider' });
		expect(readAnthropicMessage(message({ stop_reason: 'max_tokens' }), 'm')).toMatchObject({
			ok: false,
			error: 'invalid_output'
		});
	});
	it('attributes usage per model when the fallback ran', () => {
		const msg = message({
			model: 'claude-opus-4-8',
			usage: {
				input_tokens: 0,
				output_tokens: 0,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
				iterations: [
					{ type: 'message', model: 'claude-sonnet-5-5', input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 1, cache_read_input_tokens: 2, cache_creation: null },
					{ type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 20, output_tokens: 7, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: null }
				]
			} as unknown as BetaMessage['usage']
		});
		expect(anthropicUsage(msg, 'claude-sonnet-5-5')).toEqual([
			{ model: 'claude-sonnet-5-5', input: 10, cacheWrite: 1, cacheRead: 2, output: 5 },
			{ model: 'claude-opus-4-8', input: 20, cacheWrite: 0, cacheRead: 0, output: 7 }
		]);
	});
});

/** Fake fetch capturing what the SDK sends (no network). */
function fakeFetch(respond: (url: string, init: RequestInit) => unknown) {
	const calls: { url: string; init: RequestInit; body: any }[] = [];
	const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = String(input instanceof Request ? input.url : input);
		const body = init.body ? JSON.parse(String(init.body)) : undefined;
		calls.push({ url, init, body });
		return new Response(JSON.stringify(respond(url, init)), {
			status: 200,
			headers: { 'content-type': 'application/json', 'request-id': 'req_1' }
		});
	}) as typeof fetch;
	return { f, calls };
}

describe('callAnthropic via the SDK (fake fetch)', () => {
	it('POSTs /v1/messages with the beta header, fallbacks and the api key', async () => {
		const { f, calls } = fakeFetch(() => message());
		const r = await callAnthropic(fill, 'claude-sonnet-5-5', 'sk-ant-test', f);
		expect(r.ok).toBe(true);
		expect(calls).toHaveLength(1);
		const { url, init, body } = calls[0];
		expect(url).toMatch(/\/v1\/messages(\?beta=true)?$/);
		const h = new Headers(init.headers);
		// SDK 1.8 sends the key as a Bearer token (older SDKs used x-api-key)
		expect(h.get('x-api-key') ?? h.get('authorization')).toMatch(/^(Bearer )?sk-ant-test$/);
		expect(h.get('anthropic-beta')).toContain(FALLBACK_BETA);
		expect(body.fallbacks).toBe('default');
		expect(body.betas).toBeUndefined(); // sent as header, not body
		expect(body.output_config.format.type).toBe('json_schema');
		expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
	});
	it('maps API errors to provider errors', async () => {
		const f = (async () =>
			new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			})) as typeof fetch;
		const r = await callAnthropic(fill, 'claude-haiku-5-5', 'sk-bad', f);
		expect(r).toMatchObject({ ok: false, error: 'provider', message: 'Anthropic rejected the API key.' });
	});
});

describe('listAnthropicModels', () => {
	it('follows pagination and maps capabilities', async () => {
		const model = (id: string, vision: boolean, lifecycle = 'active') => ({
			type: 'model',
			id,
			display_name: id.toUpperCase(),
			created_at: '2026-01-01T00:00:00Z',
			deprecated_at: null,
			retires_at: null,
			lifecycle,
			line: null,
			max_input_tokens: 1_000_000,
			max_tokens: 128_000,
			capabilities: { image_input: { supported: vision }, structured_outputs: { supported: true } }
		});
		const { f, calls } = fakeFetch((url) =>
			url.includes('after_id')
				? { data: [model('claude-haiku-5-5', false), model('claude-old', true, 'retired')], has_more: false, first_id: 'x', last_id: 'y' }
				: { data: [model('claude-sonnet-5-5', true)], has_more: true, first_id: 'claude-sonnet-5-5', last_id: 'claude-sonnet-5-5' }
		);
		const list = await listAnthropicModels('sk', f);
		expect(calls.length).toBe(2);
		expect(list.map((m) => m.id)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
		expect(list[0]).toEqual({
			id: 'claude-sonnet-5-5',
			label: 'CLAUDE-SONNET-5-5',
			contextTokens: 1_000_000,
			maxOutput: 128_000,
			vision: true,
			structured: true,
			providerPrice: null
		});
		expect(list[1].vision).toBe(false);
	});
});
