import { describe, expect, it } from 'vitest';
import { pickNext } from './next.ts';

const base = { due: 0, newWords: 0, budgetLeft: 10, lessonId: 'h1' };

describe("Today's next step", () => {
	it('a new learner starts lesson 1', () => {
		expect(pickNext({ ...base, planStep: { kind: 'lesson', href: '/learn/h1' } })).toEqual({ kind: 'lesson', id: 'h1' });
	});

	it('reviews that are due come first', () => {
		expect(pickNext({ ...base, due: 12 })).toEqual({ kind: 'review', n: 12 });
	});

	it('someone who reads kana starts with the placement check', () => {
		const step = { kind: 'placement', script: 'hiragana', href: '/learn/placement/hiragana' } as const;
		expect(pickNext({ ...base, planStep: step })).toEqual({ kind: 'plan', step });
	});

	it('a topic course never pushes the next kana lesson aside', () => {
		expect(pickNext({ ...base, lessonId: 'h2', planStep: { kind: 'course', course: 'travel', href: '/learn' } })).toEqual({ kind: 'lesson', id: 'h2' });
	});

	it("after today's new kana, new words, then rest", () => {
		expect(pickNext({ ...base, budgetLeft: 0, newWords: 3 })).toEqual({ kind: 'words', n: 3 });
		expect(pickNext({ ...base, budgetLeft: 0 })).toEqual({ kind: 'rest', id: 'h1' });
	});

	it('every kana lesson done and nothing due', () => {
		expect(pickNext({ ...base, lessonId: undefined })).toEqual({ kind: 'allDone' });
	});
});
