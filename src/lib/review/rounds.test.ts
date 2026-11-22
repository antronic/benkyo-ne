import { describe, expect, it } from 'vitest';
import { nextRound, ROUND_SIZE, roundsFor } from './rounds.ts';

describe('review rounds', () => {
	it('a round is ten cards', () => expect(ROUND_SIZE).toBe(10));

	it('counts rounds, rounding up', () => {
		expect(roundsFor(0)).toBe(0);
		expect(roundsFor(1)).toBe(1);
		expect(roundsFor(10)).toBe(1);
		expect(roundsFor(25)).toBe(3);
	});

	it('takes the oldest cards first and keeps the order of the rest', () => {
		const ids = Array.from({ length: 25 }, (_, i) => i);
		const [round, rest] = nextRound(ids);
		expect(round).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(rest[0]).toBe(10);
		expect(rest).toHaveLength(15);
		const [last, none] = nextRound(nextRound(rest)[1]);
		expect(last).toEqual([20, 21, 22, 23, 24]);
		expect(none).toEqual([]);
	});
});
