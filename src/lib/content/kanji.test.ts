import { describe, expect, it } from 'vitest';
import { KANJI, KANJI_LESSONS, kanjiByChar, meaningChoices, showKun } from './kanji.ts';
import { familyOf, partColors, strokesOf } from './strokes.ts';
import { mnemonicFor } from './mnemonics.ts';
import { verifyItem } from '#lib/dict/dict.ts';

describe('kanji content', () => {
	it('every kanji has strokes, a picture and a story', () => {
		for (const k of KANJI) {
			expect(strokesOf(k.char)?.d.length, k.char).toBeGreaterThan(0);
			expect(k.picture.length, k.char).toBeGreaterThan(40);
			expect(k.story, k.char).not.toBe('');
			expect(mnemonicFor(k.char).scene).toBe(k.picture);
		}
	});
	it('lessons have unique ids and no repeated kanji', () => {
		expect(new Set(KANJI_LESSONS.map((l) => l.id)).size).toBe(KANJI_LESSONS.length);
		expect(new Set(KANJI.map((k) => k.char)).size).toBe(KANJI.length);
		expect(new Set(KANJI.map((k) => k.meaning)).size).toBe(KANJI.length);
	});
	it('combinations are built from kanji taught earlier', () => {
		const seen = new Set<string>();
		for (const l of KANJI_LESSONS)
			for (const k of l.chars) {
				for (const p of k.parts ?? []) expect(seen.has(p), `${k.char} needs ${p}`).toBe(true);
				seen.add(k.char);
			}
	});
	it('colours a compound by its parts', () => {
		const c = partColors('休')!;
		expect(c.length).toBe(6);
		expect(new Set(c.slice(0, 2)).size).toBe(1);
		expect(c[0]).not.toBe(c[2]);
		expect(partColors('山')).toBeUndefined();
	});
	it('matches kana against kana and kanji against kanji', () => {
		expect(familyOf('口')).toContain('日');
		expect(familyOf('口')).not.toContain('ロ');
		expect(familyOf('ロ')).not.toContain('口');
	});
	it('meaning choices are distinct and include the answer', () => {
		const k = kanjiByChar.get('木')!;
		const opts = meaningChoices(k);
		expect(opts).toHaveLength(4);
		expect(opts.map((o) => o.char)).toContain('木');
		expect(new Set(opts.map((o) => o.meaning)).size).toBe(4);
	});
	it('shows okurigana in brackets', () => {
		expect(showKun('あか.るい')).toBe('あか(るい)');
		expect(showKun('やま')).toBe('やま');
	});
	it('every example word exists in the dictionary with that reading', async () => {
		const bad: string[] = [];
		for (const k of KANJI) {
			const v = await verifyItem({ text: k.example.word, reading: k.example.reading });
			if (!v.verified) bad.push(`${k.char}: ${k.example.word} ${k.example.reading}`);
			if (!k.example.word.includes(k.char)) bad.push(`${k.char}: example lacks the kanji`);
		}
		expect(bad).toEqual([]);
	}, 60_000);
});
