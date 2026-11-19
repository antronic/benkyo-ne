import { describe, expect, it } from 'vitest';
import { KANJI } from '@johnmorrisdotca/jisho/kanji';
import { readKanji } from '@johnmorrisdotca/jisho';
import { buildKanjiIndex, matchesKanji } from './kanjiIndex.ts';
import { KANJI_LESSONS } from './kanji.ts';
import { LEVELS } from './levels/index.ts';
import { loadLevelStrokes, strokesOf } from './strokes.ts';

const units = (await Promise.all(LEVELS.map((l) => l.load()))).flat();
const index = buildKanjiIndex(readKanji(KANJI), units);

describe('kanji gallery index', () => {
	it('lists every lesson and unit kanji once, lessons first', () => {
		const lessonChars = KANJI_LESSONS.flatMap((l) => l.chars.map((k) => k.char));
		const all = new Set([...lessonChars, ...units.flatMap((u) => u.kanji)]);
		expect(index.map((k) => k.char).sort()).toEqual([...all].sort());
		expect(index.slice(0, lessonChars.length).map((k) => k.char)).toEqual(lessonChars);
	});

	it('every kanji has a meaning, readings and stroke data for tracing', async () => {
		await loadLevelStrokes();
		const bad = index.filter((k) => !k.meaning || k.on.length + k.kun.length === 0 || !strokesOf(k.char)).map((k) => k.char);
		expect(bad).toEqual([]);
	});

	it('a lesson kanji that a unit also teaches links to both', () => {
		const both = index.filter((k) => k.lesson && k.unit);
		expect(both.length).toBeGreaterThan(0);
		for (const k of index) if (k.unit) expect(units.find((u) => u.id === k.unit!.id)?.kanji).toContain(k.char);
	});

	it('search finds a kanji by itself, its meaning, or a reading in either kana', () => {
		const sun = index.find((k) => k.char === '日')!;
		expect(matchesKanji(sun, '日')).toBe(true);
		expect(matchesKanji(sun, 'SUN')).toBe(true);
		expect(matchesKanji(sun, 'にち')).toBe(true);
		expect(matchesKanji(sun, 'ニチ')).toBe(true);
		expect(matchesKanji(sun, 'moon')).toBe(false);
		expect(matchesKanji(sun, '  ')).toBe(true);
	});
});
