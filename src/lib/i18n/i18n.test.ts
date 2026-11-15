import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { en, type MessageKey } from './en.ts';
import { th } from './th.ts';
import { CONTENT_TH } from './content.th.ts';
import { matchLocale, translate } from './index.svelte.ts';
import { LESSONS } from '#lib/content/lessons.ts';
import { COURSES } from '#lib/content/courses.ts';
import { KANA } from '#lib/content/kana.ts';
import { baseOf, mnemonicFor } from '#lib/content/mnemonics.ts';
import { RULES } from '#lib/content/japanglish.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('locale matching', () => {
	it('follows the browser language', () => {
		expect(matchLocale(['th-TH', 'en-US'])).toBe('th');
		expect(matchLocale(['th'])).toBe('th');
		expect(matchLocale(['en-GB'])).toBe('en');
		expect(matchLocale(['ja-JP', 'th-TH'])).toBe('th');
		expect(matchLocale(['ja-JP'])).toBe('en');
		expect(matchLocale([])).toBe('en');
		expect(matchLocale(undefined)).toBe('en');
	});
});

describe('translate', () => {
	it('fills placeholders and falls back to English', () => {
		expect(translate('en', 'nav.due', { n: 3 })).toBe('3 due');
		expect(translate('th', 'nav.due', { n: 3 })).toBe('ถึงกำหนด 3 ใบ');
		expect(translate('th', 'nav.today')).toBe('วันนี้');
	});
});

describe('Thai messages', () => {
	it('only uses keys that exist in English', () => {
		for (const k of Object.keys(th)) expect(en, k).toHaveProperty(k);
	});
	it('keeps the same placeholders as English', () => {
		for (const [k, v] of Object.entries(th)) expect(placeholders(v!), k).toEqual(placeholders(en[k as MessageKey]));
	});
	it('translates every non-plural key (plural keys need _other)', () => {
		const missing = (Object.keys(en) as MessageKey[]).filter((k) => !k.endsWith('_one') && !(k in th));
		expect(missing).toEqual([]);
	});
	it('keeps HTML tags balanced where English uses them', () => {
		for (const [k, v] of Object.entries(th)) {
			expect((v!.match(/<b>/g) ?? []).length, k).toBe((en[k as MessageKey].match(/<b>/g) ?? []).length);
		}
	});
});

describe('Thai lesson content', () => {
	const sources = ['lessons.ts', 'courses.ts', 'mnemonics.ts', 'japanglish.ts']
		.map((f) => readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'))
		.join('\n');
	const extra = new Set(['hiragana', 'katakana', 'Hiragana', 'Katakana', 'red', 'mountain', 'to eat', 'cat', 'tomorrow', 'pond', 'face', 'here', 'thank you', 'big']);

	it('every key still matches English source text', () => {
		const stale = Object.keys(CONTENT_TH).filter((k) => !extra.has(k) && !sources.includes(k));
		expect(stale).toEqual([]);
	});
	it('covers every kana lesson', () => {
		for (const l of LESSONS) {
			expect(CONTENT_TH, l.title).toHaveProperty([l.title]);
			if (l.note) expect(CONTENT_TH, l.note).toHaveProperty([l.note]);
		}
	});
	it('covers every built-in course, unit, meaning and note', () => {
		for (const c of COURSES) {
			for (const s of [c.title, c.blurb, ...c.units.map((u) => u.title)]) expect(CONTENT_TH, s).toHaveProperty([s]);
			for (const i of c.units.flatMap((u) => u.items)) {
				expect(CONTENT_TH, i.gloss).toHaveProperty([i.gloss]);
				if (i.note) expect(CONTENT_TH, i.note).toHaveProperty([i.note]);
			}
		}
	});
	it('covers every mnemonic story', () => {
		for (const k of KANA) {
			if (baseOf(k.char)) continue; // built from the base kana
			const s = mnemonicFor(k.char).story;
			if (s) expect(CONTENT_TH, `${k.char}: ${s}`).toHaveProperty([s]);
		}
	});
	it('covers every Japanglish rule', () => {
		for (const r of RULES) {
			expect(CONTENT_TH, r.title).toHaveProperty([r.title]);
			expect(CONTENT_TH, r.explain).toHaveProperty([r.explain]);
		}
	});
});
