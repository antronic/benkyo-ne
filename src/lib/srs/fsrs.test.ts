import { describe, expect, it } from 'vitest';
import {
	Again,
	Easy,
	Good,
	Hard,
	defaultParams,
	inferGrade,
	newCard,
	nextInterval,
	replay,
	retrievability,
	review,
	type ReviewLog
} from './fsrs.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);

describe('FSRS maths', () => {
	it('R(S, S) = 0.9 by construction', () => {
		expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
	});

	it('interval equals stability at 90 % retention', () => {
		expect(nextInterval(10)).toBe(10);
	});

	it('higher retention target means shorter intervals', () => {
		const strict = { ...defaultParams, requestRetention: 0.95 };
		expect(nextInterval(30, strict)).toBeLessThan(nextInterval(30));
	});
});

describe('scheduling', () => {
	it('new → learning on Good, then graduates', () => {
		let c = review(newCard('a', t0), Good, t0);
		expect(c.state).toBe('learning');
		expect(c.due - t0).toBe(10 * 60_000);
		c = review(c, Good, c.due);
		expect(c.state).toBe('review');
		expect(c.due - c.lastReview!).toBeGreaterThanOrEqual(DAY);
	});

	it('Easy on a new card graduates immediately', () => {
		const c = review(newCard('a', t0), Easy, t0);
		expect(c.state).toBe('review');
	});

	it('intervals grow with successful reviews (until the cap)', () => {
		let c = review(review(newCard('a', t0), Good, t0), Good, t0 + 10 * 60_000);
		const intervals: number[] = [];
		for (let i = 0; i < 4; i++) {
			const now = c.due;
			c = review(c, Good, now);
			intervals.push(Math.round((c.due - now) / DAY));
		}
		for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
		expect(Math.max(...intervals)).toBeLessThanOrEqual(defaultParams.maximumInterval);
	});

	it('a lapse drops stability and counts', () => {
		let c = review(newCard('a', t0), Easy, t0);
		c = review(c, Good, c.due);
		const before = c.stability;
		c = review(c, Again, c.due);
		expect(c.state).toBe('relearning');
		expect(c.lapses).toBe(1);
		expect(c.stability).toBeLessThan(before);
	});

	it('Hard grows stability less than Good', () => {
		const base = review(review(newCard('a', t0), Easy, t0), Good, t0 + 10 * DAY);
		const hard = review(base, Hard, base.due);
		const good = review(base, Good, base.due);
		expect(hard.stability).toBeLessThan(good.stability);
		expect(hard.difficulty).toBeGreaterThan(good.difficulty);
	});

	it('replaying a log reproduces the same card', () => {
		const logs: ReviewLog[] = [];
		let c = newCard('x', t0);
		let now = t0;
		for (const g of [Good, Good, Again, Good, Easy] as const) {
			c = review(c, g, now);
			logs.push({ id: String(now), cardId: 'x', grade: g, reviewedAt: now, elapsedDays: 0, durationMs: 1 });
			now = c.due;
		}
		const r = replay('x', [...logs].reverse());
		expect(r.stability).toBeCloseTo(c.stability, 9);
		expect(r.due).toBe(c.due);
	});
});

describe('inferGrade', () => {
	it('maps behaviour to grades', () => {
		expect(inferGrade(false, 500)).toBe(Again);
		expect(inferGrade(true, 9000)).toBe(Hard);
		expect(inferGrade(true, 3000, true)).toBe(Hard);
		expect(inferGrade(true, 3000)).toBe(Good);
		expect(inferGrade(true, 1200)).toBe(Easy);
	});
});
