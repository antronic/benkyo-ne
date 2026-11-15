import { describe, expect, it } from 'vitest';
import { buildPlacement, blockResult, PER_LESSON, scorePlacement, shouldStop, type Answer } from './placement.ts';
import { DRILLS, isDrillId, pickDrill } from './drills.ts';
import { LESSONS } from '#lib/content/lessons.ts';
import { Easy, Good, newCard, review, type Card } from '#lib/srs/fsrs.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const right = (ms = 1000): Answer => ({ correct: true, ms });
const wrong: Answer = { correct: false, ms: 1500 };

describe('placement check', () => {
	it('samples each unfinished lesson of the script, in order', () => {
		const blocks = buildPlacement('hiragana', ['h1'], seeded());
		expect(blocks.map((b) => b.lesson.id)).toEqual(LESSONS.filter((l) => l.script === 'hiragana' && l.id !== 'h1').map((l) => l.id));
		for (const b of blocks) {
			expect(b.questions).toHaveLength(Math.min(PER_LESSON, b.lesson.chars.length));
			for (const q of b.questions) expect(b.lesson.chars).toContain(q);
			expect(new Set(b.questions).size).toBe(b.questions.length);
		}
	});

	it('a lesson passes only when every sampled question is right', () => {
		const [b] = buildPlacement('katakana', [], seeded(3));
		const [q1, q2, q3] = b.questions;
		expect(blockResult(b, { [q1.char]: right() })).toBeNull();
		expect(blockResult(b, { [q1.char]: right(), [q2.char]: wrong })).toBe(false);
		expect(blockResult(b, { [q1.char]: right(), [q2.char]: right(), [q3.char]: right() })).toBe(true);
	});

	it('stops after two failed lessons in a row', () => {
		const blocks = buildPlacement('hiragana', [], seeded(5));
		const ans: Record<string, Answer> = {};
		const fail = (i: number) => (ans[blocks[i].questions[0].char] = wrong);
		const pass = (i: number) => blocks[i].questions.forEach((q) => (ans[q.char] = right()));
		pass(0);
		fail(1);
		expect(shouldStop(blocks, ans)).toBe(false);
		pass(2);
		fail(3);
		expect(shouldStop(blocks, ans)).toBe(false);
		fail(4);
		expect(shouldStop(blocks, ans)).toBe(true);
	});

	it('passed lessons seed every kana; fast answers can be Easy; failed ones record nothing', () => {
		const blocks = buildPlacement('hiragana', [], seeded(7)).slice(0, 2);
		const ans: Record<string, Answer> = {};
		blocks[0].questions.forEach((q) => (ans[q.char] = right(900)));
		ans[blocks[1].questions[0].char] = wrong;
		const seenId = `kana:${blocks[0].lesson.chars.find((k) => !blocks[0].questions.includes(k))!.char}`;
		const out = scorePlacement(blocks, ans, new Set([seenId]));
		expect(out.passed).toEqual([blocks[0].lesson.id]);
		expect(out.failed).toEqual([blocks[1].lesson.id]);
		const ids = out.grades.map((g) => g[0]);
		expect(ids).toHaveLength(blocks[0].lesson.chars.length - 1);
		expect(ids).not.toContain(seenId);
		for (const [id, grade] of out.grades) {
			const tested = blocks[0].questions.some((q) => `kana:${q.char}` === id);
			expect(grade).toBe(tested ? Easy : Good);
		}
	});
});

describe('practice drills', () => {
	const met = (id: string, daysAgo: number, g: 3 | 4 = Good): Card => review(newCard(id, t0), g, t0 - daysAgo * DAY);
	const cards: Record<string, Card> = Object.fromEntries(
		[
			met('kana:シ', 1),
			met('kana:ツ', 1),
			met('kana:あ', 30, Easy),
			met('kana:か', 2),
			met('word:123', 40),
			met('word:gone', 1),
			newCard('kana:ぬ', t0)
		].map((c) => [c.id, c])
	);
	const isWord = (id: string) => id === 'word:123';

	it('every drill id is recognised', () => {
		for (const d of DRILLS) expect(isDrillId(d.id)).toBe(true);
		expect(isDrillId('nope')).toBe(false);
	});

	it('mixed uses only kana you have met', () => {
		expect(pickDrill('mixed', cards, isWord, t0, 20, seeded()).sort()).toEqual(['kana:あ', 'kana:か', 'kana:シ', 'kana:ツ']);
	});

	it('look-alikes need a known partner', () => {
		expect(pickDrill('lookalikes', cards, isWord, t0, 20, seeded()).sort()).toEqual(['kana:シ', 'kana:ツ']);
	});

	it('words skips kana and deleted cards', () => {
		expect(pickDrill('words', cards, isWord, t0)).toEqual(['word:123']);
	});

	it('weakest takes the lowest predicted recall', () => {
		const ids = pickDrill('weakest', cards, isWord, t0, 2, seeded());
		expect(ids.sort()).toEqual(['kana:あ', 'word:123']);
	});

	it('caps the drill size', () => {
		expect(pickDrill('mixed', cards, isWord, t0, 2)).toHaveLength(2);
	});
});
