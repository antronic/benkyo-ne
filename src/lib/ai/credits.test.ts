import { describe, expect, it } from 'vitest';
import { creditsForTokens, creditsForUsage, creditsForUsd, formatCredits, rateLabel, usdPerCredit } from './credits.ts';

describe('AI credits', () => {
	it('prices tokens per 1, 1K or 1M', () => {
		expect(creditsForTokens(2000, 500, { unit: 1000, inputCredits: 1, outputCredits: 4 })).toBe(4);
		expect(creditsForTokens(10, 2, { unit: 1, inputCredits: 0.5, outputCredits: 1 })).toBe(7);
		expect(creditsForTokens(1_000_000, 1_000_000, { unit: 1_000_000, inputCredits: 300, outputCredits: 1500 })).toBe(1800);
	});

	it('counts cached input as input', () => {
		expect(creditsForUsage({ input: 100, cacheRead: 400, cacheWrite: 500, output: 1000 }, { unit: 1000, inputCredits: 1, outputCredits: 2 })).toBe(3);
	});

	it('falls back to 1000 credits per dollar', () => {
		expect(creditsForUsd(1.5)).toBe(1500);
	});

	it('reads well in the console', () => {
		expect(formatCredits(1500)).toBe('1,500');
		expect(formatCredits(2.5)).toBe('2.5');
		expect(formatCredits(0.00412)).toBe('0.00412');
		expect(rateLabel({ unit: 1000, inputCredits: 2, outputCredits: 8 })).toBe('2 in / 8 out credits per 1K tokens');
		expect(rateLabel({ unit: 1, inputCredits: 0.01, outputCredits: 0.05 })).toBe('0.01 in / 0.05 out credits per 1 token');
		// $3 + $15 per M against 3000 + 15000 credits per M: $0.001 a credit
		expect(usdPerCredit({ inputPerM: 3, outputPerM: 15 }, { unit: 1_000_000, inputCredits: 3000, outputCredits: 15000 })).toBeCloseTo(0.001);
		expect(usdPerCredit({ inputPerM: null, outputPerM: null }, { unit: 1, inputCredits: 1, outputCredits: 1 })).toBeNull();
	});
});
