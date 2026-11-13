import { describe, expect, it } from 'vitest';
import { buildFillPrompt } from '../../src/lib/ai/prompts.ts';
import { callOpenAi, listOpenAiModels, mapOpenAiModel } from './openai.ts';

const parts = buildFillPrompt({
	items: [{ key: 'k', text: '池', reading: 'いけ', kind: 'word', gloss: 'pond' }],
	knownKana: ['い'],
	allowExamples: false,
	secondLang: null,
	theme: false
});

describe('mapOpenAiModel', () => {
	it('parses OpenRouter entries', () => {
		expect(
			mapOpenAiModel({
				id: 'anthropic/claude-sonnet-5-5',
				name: 'Claude Sonnet 5.5',
				context_length: 1000000,
				pricing: { prompt: '0.000002', completion: '0.00001' },
				top_provider: { max_completion_tokens: 128000 },
				architecture: { input_modalities: ['text', 'image'] },
				supported_parameters: ['structured_outputs', 'max_tokens']
			})
		).toEqual({
			id: 'anthropic/claude-sonnet-5-5',
			label: 'Claude Sonnet 5.5',
			contextTokens: 1000000,
			maxOutput: 128000,
			vision: true,
			structured: true,
			providerPrice: { inputPerM: 2, outputPerM: 10 }
		});
	});
	it('id-only entries get nulls', () => {
		expect(mapOpenAiModel({ id: 'llama3' })).toEqual({
			id: 'llama3',
			label: 'llama3',
			contextTokens: null,
			maxOutput: null,
			vision: null,
			structured: null,
			providerPrice: null
		});
		expect(mapOpenAiModel({ name: 'no id' })).toBeNull();
	});
});

describe('callOpenAi', () => {
	it('falls back to json_object when json_schema is rejected', async () => {
		const bodies: any[] = [];
		const f = (async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body));
			bodies.push(body);
			if (body.response_format.type === 'json_schema')
				return new Response('{"error":{"message":"response_format json_schema is not supported"}}', { status: 400 });
			return Response.json({
				choices: [{ finish_reason: 'stop', message: { content: '{"theme":null,"items":[]}' } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 }
			});
		}) as unknown as typeof fetch;
		const r = await callOpenAi(parts, 'm', 'https://x.test/v1', 'sk', { fetch: f });
		expect(r).toEqual({
			ok: true,
			text: '{"theme":null,"items":[]}',
			usage: [{ model: 'm', input: 10, cacheRead: 0, output: 5 }],
			format: 'json_object'
		});
		expect(bodies.map((b) => b.response_format.type)).toEqual(['json_schema', 'json_object']);
	});
	it('reports cut-off replies and auth failures', async () => {
		const cut = (async () =>
			Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"the' } }] })) as unknown as typeof fetch;
		expect(await callOpenAi(parts, 'm', 'https://x.test/v1', 'sk', { fetch: cut })).toMatchObject({
			ok: false,
			error: 'invalid_output'
		});
		const denied = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
		expect(await callOpenAi(parts, 'm', 'https://x.test/v1', 'sk', { fetch: denied })).toMatchObject({
			ok: false,
			error: 'provider',
			message: 'The provider rejected the API key.'
		});
	});
	it('lists models with the Bearer key', async () => {
		let auth = '';
		const f = (async (_u: string, init: RequestInit) => {
			auth = new Headers(init.headers).get('authorization') ?? '';
			return Response.json({ data: [{ id: 'a' }, { id: 'b', context_length: 8192 }, { bogus: 1 }] });
		}) as unknown as typeof fetch;
		const list = await listOpenAiModels('https://x.test/v1', 'sk-1', f);
		expect(auth).toBe('Bearer sk-1');
		expect(list.map((m) => [m.id, m.contextTokens])).toEqual([
			['a', null],
			['b', 8192]
		]);
	});
});
