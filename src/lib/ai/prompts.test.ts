import { describe, expect, it } from 'vitest';
import type { FillRequest, ProposeRequest } from './contract.ts';
import {
	buildFillPrompt,
	buildProposePrompt,
	FILL_SCHEMA,
	FILL_SYSTEM,
	knownKanaChars,
	openAiChatBody,
	PROPOSE_SCHEMA,
	PROPOSE_SYSTEM,
	type JsonSchema, LESSON_SCHEMA, ASK_SCHEMA } from './prompts.ts';

/** Minimal validator for the schema subset we use (type, properties, required, additionalProperties, items, anyOf, enum). */
function validate(schema: JsonSchema, v: unknown, path = '$'): string[] {
	if (Array.isArray(schema.anyOf)) {
		const ok = (schema.anyOf as JsonSchema[]).some((s) => validate(s, v, path).length === 0);
		return ok ? [] : [`${path}: no anyOf branch matched`];
	}
	const errs: string[] = [];
	switch (schema.type) {
		case 'null':
			if (v !== null) errs.push(`${path}: expected null`);
			break;
		case 'string':
			if (typeof v !== 'string') errs.push(`${path}: expected string`);
			else if (Array.isArray(schema.enum) && !schema.enum.includes(v)) errs.push(`${path}: not in enum`);
			break;
		case 'array':
			if (!Array.isArray(v)) errs.push(`${path}: expected array`);
			else v.forEach((x, i) => errs.push(...validate(schema.items as JsonSchema, x, `${path}[${i}]`)));
			break;
		case 'object': {
			if (!v || typeof v !== 'object' || Array.isArray(v)) {
				errs.push(`${path}: expected object`);
				break;
			}
			const props = schema.properties as Record<string, JsonSchema>;
			for (const r of schema.required as string[]) if (!(r in v)) errs.push(`${path}.${r}: missing`);
			for (const k of Object.keys(v)) {
				if (!(k in props)) errs.push(`${path}.${k}: not allowed`);
				else errs.push(...validate(props[k], (v as Record<string, unknown>)[k], `${path}.${k}`));
			}
			break;
		}
		default:
			errs.push(`${path}: unsupported schema type ${String(schema.type)}`);
	}
	return errs;
}

/** Structured-output compatibility: closed objects, all props required, no unsupported keywords. */
function checkStrict(schema: JsonSchema, path = '$'): string[] {
	const bad = ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'minItems', 'maxItems', 'pattern', 'format'];
	const errs = bad.filter((k) => k in schema).map((k) => `${path}: unsupported ${k}`);
	if (Array.isArray(schema.anyOf)) (schema.anyOf as JsonSchema[]).forEach((s, i) => errs.push(...checkStrict(s, `${path}|${i}`)));
	if (schema.type === 'object') {
		if (schema.additionalProperties !== false) errs.push(`${path}: additionalProperties must be false`);
		const props = Object.keys(schema.properties as object);
		const req = schema.required as string[];
		if (props.length !== req.length || !props.every((p) => req.includes(p))) errs.push(`${path}: all properties must be required`);
		for (const [k, s] of Object.entries(schema.properties as Record<string, JsonSchema>)) errs.push(...checkStrict(s, `${path}.${k}`));
	}
	if (schema.type === 'array') errs.push(...checkStrict(schema.items as JsonSchema, `${path}[]`));
	return errs;
}

const fillReq: FillRequest = {
	items: [{ key: 'k1', text: '池', reading: 'いけ', kind: 'word', gloss: 'pond' }],
	knownKana: ['い', 'け', 'きゃ'],
	allowExamples: true,
	secondLang: 'de',
	theme: true
};

describe('schemas', () => {
	it('are valid for Anthropic structured outputs and OpenAI strict mode', () => {
		expect(checkStrict(FILL_SCHEMA)).toEqual([]);
		expect(checkStrict(PROPOSE_SCHEMA)).toEqual([]);
	});
	it('accept a well-formed fill reply and reject a malformed one', () => {
		const good = {
			theme: { en: 'Water', second: 'Wasser' },
			items: [
				{
					key: 'k1',
					gloss2: 'Teich',
					hook: { en: 'eek, a pond', second: null },
					usage: null,
					example: { jp: 'いけ', reading: 'いけ', en: 'a pond', second: 'ein Teich' }
				}
			]
		};
		expect(validate(FILL_SCHEMA, good)).toEqual([]);
		expect(validate(FILL_SCHEMA, { ...good, extra: 1 })).not.toEqual([]);
		expect(validate(FILL_SCHEMA, { items: good.items })).not.toEqual([]);
	});
	it('accept a well-formed propose reply and reject a bad kind', () => {
		const good = { packName: null, items: [{ text: '池', reading: 'いけ', kind: 'word', gloss: 'pond', note: null }] };
		expect(validate(PROPOSE_SCHEMA, good)).toEqual([]);
		expect(validate(PROPOSE_SCHEMA, { items: [{ ...good.items[0], kind: 'noun' }] })).not.toEqual([]);
	});
});

describe('lesson & ask schemas', () => {
	it('accept well-formed replies', () => {
		const item = { text: '駅', reading: 'えき', kind: 'word', gloss: 'station', note: null };
		const bi = { en: 'At the station', second: null };
		expect(validate(LESSON_SCHEMA, { title: bi, blurb: bi, items: [item] })).toEqual([]);
		expect(validate(ASK_SCHEMA, { answer: 'は marks the topic.', answer2: null, examples: [{ jp: 'わたしは', reading: 'わたしは', en: 'as for me' }] })).toEqual([]);
		expect(validate(ASK_SCHEMA, { answer: 'x', answer2: null })).not.toEqual([]);
	});
});

describe('buildFillPrompt', () => {
	it('keeps the system prompt constant and puts volatile data in the user turn', () => {
		const p = buildFillPrompt(fillReq);
		const q = buildFillPrompt({ ...fillReq, knownKana: ['あ'], secondLang: null });
		expect(p.system).toBe(FILL_SYSTEM);
		expect(q.system).toBe(p.system);
		expect(p.user).toContain('"key":"k1"');
		expect(p.user).toContain('い け き ゃ');
		expect(p.user).toContain('Second language: de');
		expect(p.system).not.toContain('k1');
		expect(p.maxTokens).toBe(4096);
		expect(p.schema).toBe(FILL_SCHEMA);
	});
	it('says when examples/theme/second language are off', () => {
		const p = buildFillPrompt({ ...fillReq, allowExamples: false, theme: false, secondLang: null });
		expect(p.user).toContain('Examples: not allowed');
		expect(p.user).toContain('Theme: not requested');
		expect(p.user).toContain('Second language: none');
	});
	it('knownKanaChars splits digraphs and dedupes', () => {
		expect(knownKanaChars(['きゃ', 'き', ' '])).toEqual(['き', 'ゃ']);
	});
});

describe('buildProposePrompt', () => {
	it('english mode carries candidates', () => {
		const req: ProposeRequest = {
			mode: 'english',
			input: 'pond',
			secondLang: null,
			candidates: [{ text: '池', reading: 'いけ', gloss: 'pond' }]
		};
		const p = buildProposePrompt(req);
		expect(p.system).toBe(PROPOSE_SYSTEM);
		expect(p.user).toContain('Mode: english');
		expect(p.user).toContain('"text":"池"');
		expect(p.image).toBeUndefined();
	});
	it('screenshot mode attaches the image', () => {
		const image = { mediaType: 'image/png' as const, base64: 'AAAA' };
		const p = buildProposePrompt({ mode: 'screenshot', input: '', image, secondLang: 'es' });
		expect(p.image).toEqual(image);
		expect(p.schemaName).toBe('propose_response');
	});
});

describe('openAiChatBody', () => {
	it('json_schema mode uses strict response_format', () => {
		const b = openAiChatBody(buildFillPrompt(fillReq), 'gpt-x', 'json_schema') as Record<string, any>;
		expect(b.model).toBe('gpt-x');
		expect(b.max_tokens).toBe(4096);
		expect(b.response_format).toEqual({
			type: 'json_schema',
			json_schema: { name: 'fill_response', strict: true, schema: FILL_SCHEMA }
		});
		expect(b.messages[0]).toEqual({ role: 'system', content: FILL_SYSTEM });
	});
	it('json_object mode embeds the schema in the system prompt; retry adds a note', () => {
		const b = openAiChatBody(buildFillPrompt(fillReq), 'm', 'json_object', true) as Record<string, any>;
		expect(b.response_format).toEqual({ type: 'json_object' });
		expect(b.messages[0].content).toContain('"additionalProperties":false');
		expect(b.messages[1].content).toContain('not valid JSON');
	});
	it('images become data URLs', () => {
		const p = buildProposePrompt({ mode: 'screenshot', input: '', image: { mediaType: 'image/jpeg', base64: 'QUJD' }, secondLang: null });
		const b = openAiChatBody(p, 'm', 'json_schema') as Record<string, any>;
		expect(b.messages[1].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
	});
});
