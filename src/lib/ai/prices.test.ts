import { describe, expect, it } from 'vitest';
import {
	BUILTIN_PRICES,
	builtinPrice,
	capAllows,
	costUsd,
	estimateInputTokens,
	parsePerTokenPricing,
	resolvePrice,
	worstCaseUsd
} from './prices.ts';

describe('builtin prices', () => {
	it('has the Claude table', () => {
		expect(BUILTIN_PRICES['claude-sonnet-5-5']).toEqual({ inputPerM: 2, outputPerM: 10 });
		expect(BUILTIN_PRICES['claude-opus-5-5']).toEqual({ inputPerM: 4, outputPerM: 20 });
		expect(BUILTIN_PRICES['claude-haiku-5-5']).toEqual({ inputPerM: 0.1, outputPerM: 0.5 });
		expect(BUILTIN_PRICES['claude-fable-5-2']).toEqual({ inputPerM: 8, outputPerM: 40 });
		expect(BUILTIN_PRICES['claude-haiku-4-5']).toEqual({ inputPerM: 1, outputPerM: 5 });
	});
	it('matches dated snapshots and gateway prefixes', () => {
		expect(builtinPrice('claude-haiku-4-5-20251001')).toEqual({ inputPerM: 1, outputPerM: 5 });
		expect(builtinPrice('anthropic/claude-sonnet-5-5')).toEqual({ inputPerM: 2, outputPerM: 10 });
		expect(builtinPrice('gpt-9')).toBeNull();
	});
});

describe('resolvePrice (D15 order)', () => {
	const provider = { inputPerM: 0.5, outputPerM: 1.5 };
	const manual = { inputPerM: 9, outputPerM: 9 };
	it('provider price wins over everything', () => {
		expect(resolvePrice('claude-sonnet-5-5', provider, manual)).toEqual({ price: provider, source: 'provider' });
	});
	it('then the built-in table, even when a manual price exists', () => {
		expect(resolvePrice('claude-sonnet-5-5', null, manual)).toEqual({
			price: { inputPerM: 2, outputPerM: 10 },
			source: 'builtin'
		});
	});
	it('then the manual price', () => {
		expect(resolvePrice('llama-x', null, manual)).toEqual({ price: manual, source: 'manual' });
	});
	it('otherwise null (blocked)', () => {
		expect(resolvePrice('llama-x', null, null)).toBeNull();
	});
	it('ignores invalid provider/manual prices', () => {
		expect(resolvePrice('llama-x', { inputPerM: -1, outputPerM: 2 }, { inputPerM: NaN, outputPerM: 1 })).toBeNull();
	});
});

describe('parsePerTokenPricing (OpenRouter)', () => {
	it('converts USD/token strings to per million', () => {
		expect(parsePerTokenPricing({ prompt: '0.000002', completion: '0.00001' })).toEqual({ inputPerM: 2, outputPerM: 10 });
		expect(parsePerTokenPricing({ prompt: '0', completion: '0' })).toEqual({ inputPerM: 0, outputPerM: 0 });
	});
	it('rejects missing or "varies" (-1) pricing', () => {
		expect(parsePerTokenPricing(undefined)).toBeNull();
		expect(parsePerTokenPricing({ prompt: '-1', completion: '-1' })).toBeNull();
		expect(parsePerTokenPricing({ prompt: 'abc', completion: '1' })).toBeNull();
		expect(parsePerTokenPricing({ prompt: '' })).toBeNull();
	});
});

describe('cost', () => {
	const sonnet = { inputPerM: 2, outputPerM: 10 };
	it('bills input, cache write (1.25x), cache read (0.1x) and output', () => {
		expect(costUsd({ input: 1_000_000, output: 0 }, sonnet)).toBeCloseTo(2);
		expect(costUsd({ input: 0, output: 1_000_000 }, sonnet)).toBeCloseTo(10);
		expect(costUsd({ input: 0, cacheWrite: 1_000_000, output: 0 }, sonnet)).toBeCloseTo(2.5);
		expect(costUsd({ input: 0, cacheRead: 1_000_000, output: 0 }, sonnet)).toBeCloseTo(0.2);
		// plan's pack estimate: ~2k in + ~1.5k out on Sonnet 5.5 ≈ $0.02
		expect(costUsd({ input: 2000, output: 1500 }, sonnet)).toBeCloseTo(0.019);
	});
	it('ignores negative/NaN token counts', () => {
		expect(costUsd({ input: -5, output: NaN }, sonnet)).toBe(0);
	});
});

describe('cap pre-check', () => {
	const sonnet = { inputPerM: 2, outputPerM: 10 };
	it('worst case = input as cache write + max_tokens of output', () => {
		// 1000 input * 2 * 1.25 + 4096 * 10 = 2500 + 40960 = 43460 / 1e6
		expect(worstCaseUsd(1000, 4096, sonnet)).toBeCloseTo(0.04346, 6);
	});
	it('allows a call only if spent + worst <= cap', () => {
		const worst = worstCaseUsd(1000, 4096, sonnet);
		expect(capAllows(0, 5, worst)).toBe(true);
		expect(capAllows(5 - worst, 5, worst)).toBe(true);
		expect(capAllows(5 - worst + 0.0001, 5, worst)).toBe(false);
		expect(capAllows(4.99, 5, worst)).toBe(false);
		expect(capAllows(0, 0, worst)).toBe(false);
	});
	it('estimates input tokens on the high side and counts images', () => {
		expect(estimateInputTokens(['abcd'])).toBe(52);
		expect(estimateInputTokens(['あいう'], 1)).toBe(2 + 50 + 5000);
	});
});
