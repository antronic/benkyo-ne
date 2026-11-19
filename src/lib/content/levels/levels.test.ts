/**
 * Quality checks for level units (docs/LEVELS.md, "Checks"). A unit that
 * fails one of these fails the gate, the same way an unknown course word does.
 */
import { describe, expect, it } from 'vitest';
import { JLPT } from '@johnmorrisdotca/jisho/jlpt';
import { KANJI } from '@johnmorrisdotca/jisho/kanji';
import { kanjiIn, levelOf, readKanji, JLPT_LEVELS } from '@johnmorrisdotca/jisho';
import { verifyItem } from '#lib/dict/dict.ts';
import { KANJI_LESSONS } from '#lib/content/kanji.ts';
import { LEVELS, isDraft, visibleUnits } from './index.ts';
import type { EnTh, LevelUnit } from './types.ts';
import { buildTestOut, testOutPassed, TEST_OUT_SIZE } from '#lib/practice/testOut.ts';

const all: LevelUnit[] = (await Promise.all(LEVELS.map((l) => l.load()))).flat();
const taught = new Set(KANJI_LESSONS.flatMap((l) => l.chars.map((k) => k.char)));
const kanjiRows = new Map(readKanji(KANJI).map((r) => [r.kanji, r]));
const THAI = /[฀-๿]/;

/** Kanji a unit of this level may write without furigana: its level and below, plus the kanji lessons. */
function allowed(level: LevelUnit['level']) {
	const upto = JLPT_LEVELS.slice(JLPT_LEVELS.indexOf(level));
	return (k: string) => taught.has(k) || upto.includes(levelOf(JLPT, k) as LevelUnit['level']);
}

function texts(u: LevelUnit) {
	const ja = [...u.grammar.flatMap((g) => g.examples.map((e) => e.ja)), ...u.reading.lines.map((l) => l.ja)];
	const bi: EnTh[] = [
		u.title,
		u.goal,
		...u.words.map((w) => w.gloss),
		...u.grammar.flatMap((g) => [g.meaning, ...(g.note ? [g.note] : []), ...g.examples]),
		u.reading.title,
		...u.reading.lines,
		...u.reading.questions.flatMap((q) => [q.q, ...q.choices])
	];
	return { ja, bi };
}

describe('level units', () => {
	it('loads every level with units', () => {
		for (const l of LEVELS) expect(all.filter((u) => u.level === l.id).length).toBeGreaterThan(0);
	});

	it('ids are unique and say their level', () => {
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);
		const g = all.flatMap((u) => u.grammar.map((p) => p.id));
		expect(new Set(g).size).toBe(g.length);
		for (const u of all) expect(u.id.startsWith(u.level.toLowerCase() + '-')).toBe(true);
	});

	it('each unit has its parts', () => {
		for (const u of all) {
			expect(u.kanji.length, u.id).toBeGreaterThan(0);
			expect(u.words.length, u.id).toBeGreaterThanOrEqual(10);
			expect(u.grammar.length, u.id).toBe(3);
			for (const g of u.grammar) expect(g.examples.length, g.id).toBe(5);
			expect(u.reading.lines.length, u.id).toBeGreaterThanOrEqual(4);
			expect(u.reading.questions.length, u.id).toBeGreaterThanOrEqual(2);
		}
	});

	it('the unit kanji belong to its level and are in KANJIDIC2', () => {
		const bad = all.flatMap((u) => u.kanji.filter((k) => levelOf(JLPT, k) !== u.level || !kanjiRows.has(k)).map((k) => `${u.id}: ${k}`));
		expect(bad).toEqual([]);
	});

	it('no kanji or word is taught twice', () => {
		const k = all.flatMap((u) => u.kanji);
		expect(k.length - new Set(k).size).toBe(0);
		const w = all.flatMap((u) => u.words.map((x) => `${x.kanji ?? ''}|${x.reading}`));
		expect(w.filter((x, i) => w.indexOf(x) !== i)).toEqual([]);
	});

	it('every word exists in the dictionary with that reading', async () => {
		const bad: string[] = [];
		for (const u of all)
			for (const w of u.words) {
				const v = await verifyItem({ text: w.kanji ?? w.reading, reading: w.reading });
				const v2 = v.verified ? v : await verifyItem({ text: w.reading, reading: w.reading });
				if (!v2.verified) bad.push(`${u.id}: ${w.kanji ?? ''} ${w.reading}`);
			}
		expect(bad).toEqual([]);
	}, 120_000);

	it('Japanese lines use only kanji of the level (or ones the kanji lessons teach)', () => {
		const bad: string[] = [];
		for (const u of all) {
			const ok = allowed(u.level);
			for (const line of texts(u).ja) for (const k of kanjiIn(line)) if (!ok(k)) bad.push(`${u.id}: ${k} in ${line}`);
		}
		expect(bad).toEqual([]);
	});

	it('every English text has Thai', () => {
		const bad: string[] = [];
		for (const u of all) for (const x of texts(u).bi) if (!x.en.trim() || !THAI.test(x.th)) bad.push(`${u.id}: ${x.en}`);
		expect(bad).toEqual([]);
	});

	it('every reading question has a valid answer and distinct choices', () => {
		for (const u of all)
			for (const q of u.reading.questions) {
				expect(q.answer, u.id).toBeGreaterThanOrEqual(0);
				expect(q.answer, u.id).toBeLessThan(q.choices.length);
				expect(new Set(q.choices.map((c) => c.en)).size, `${u.id}: ${q.q.en}`).toBe(q.choices.length);
			}
	});

	it('a reviewed unit names its reviewer and date', () => {
		for (const u of all)
			for (const r of [u.review.ja, u.review.th]) {
				if (!r) continue;
				expect(r.by.trim(), u.id).not.toBe('');
				expect(r.on, u.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}
	});

	it('drafts are hidden unless asked for', () => {
		const draft = { ...all[0], review: { ja: null, th: null } };
		const done = { ...all[0], id: 'x', review: { ja: { by: 'R', on: '2026-11-20' }, th: null } };
		expect(isDraft(draft)).toBe(true);
		expect(visibleUnits([draft, done], false)).toEqual([done]);
		expect(visibleUnits([draft, done], true)).toEqual([draft, done]);
	});
});

describe('test out', () => {
	it('asks three answerable questions from every unit', () => {
		for (const l of LEVELS) {
			const units = all.filter((u) => u.level === l.id);
			for (const u of units)
				for (let seed = 0; seed < 20; seed++) {
					let s = seed + 1;
					const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
					const qs = buildTestOut(u, units, rand);
					expect(qs.map((q) => q.kind), u.id).toEqual(['kanji', 'word', 'grammar']);
					expect(qs.length).toBe(TEST_OUT_SIZE);
					for (const q of qs) {
						expect(q.choices.length, `${u.id} ${q.kind}`).toBeGreaterThanOrEqual(3);
						expect(new Set(q.choices.map((c) => c.en)).size).toBe(q.choices.length);
						expect(q.choices[q.answer]).toBeDefined();
					}
					const kanjiQ = qs[0];
					const word = u.words.find((w) => w.kanji === kanjiQ.prompt);
					expect(word && kanjiQ.choices[kanjiQ.answer].en).toBe(word?.reading);
				}
		}
	});

	it('passes only when all three are right', () => {
		const u = all[0];
		const qs = buildTestOut(u, [u]);
		expect(testOutPassed(qs, qs.map((q) => q.answer))).toBe(true);
		expect(testOutPassed(qs, [qs[0].answer, qs[1].answer, (qs[2].answer + 1) % qs[2].choices.length])).toBe(false);
		expect(testOutPassed(qs, [qs[0].answer, null, qs[2].answer])).toBe(false);
	});
});
