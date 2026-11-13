import { describe, expect, it } from 'vitest';
import { buildFillPrompt } from '../../src/lib/ai/prompts.ts';
import { worstCaseUsd } from '../../src/lib/ai/prices.ts';
import { FALLBACK_PRICE, inputEstimate, sumUsage, usageCost, worstCaseForCall } from './cost.ts';

const parts = buildFillPrompt({
	items: [{ key: 'k', text: '池', reading: 'いけ', kind: 'word', gloss: 'pond' }],
	knownKana: ['い'],
	allowExamples: false,
	secondLang: null,
	theme: false
});
const sonnet = { inputPerM: 2, outputPerM: 10 };

describe('worstCaseForCall', () => {
	it('is the plain worst case for providers without a fallback', () => {
		expect(worstCaseForCall(parts, 'openai-compatible', 'x', sonnet)).toBeCloseTo(
			worstCaseUsd(inputEstimate(parts), 4096, sonnet),
			9
		);
		expect(worstCaseForCall(parts, 'anthropic', 'claude-haiku-5-5', sonnet)).toBeCloseTo(
			worstCaseUsd(inputEstimate(parts), 4096, sonnet),
			9
		);
	});
	it('adds the fallback model worst case for 5.5 models', () => {
		const inTok = inputEstimate(parts);
		expect(worstCaseForCall(parts, 'anthropic', 'claude-sonnet-5-5', sonnet)).toBeCloseTo(
			worstCaseUsd(inTok, 4096, sonnet) + worstCaseUsd(inTok, 4096, FALLBACK_PRICE),
			9
		);
		// a fill call stays far below the $5 cap
		expect(worstCaseForCall(parts, 'anthropic', 'claude-sonnet-5-5', sonnet)).toBeLessThan(0.2);
	});
});

describe('usageCost', () => {
	it('prices each entry by its own model', () => {
		const cost = usageCost(
			[
				{ model: 'claude-sonnet-5-5', input: 1_000_000, output: 0 },
				{ model: 'claude-opus-4-8', input: 0, output: 1_000_000 }
			],
			'claude-sonnet-5-5',
			sonnet
		);
		expect(cost).toBeCloseTo(2 + 25);
	});
	it('unknown fallback models bill at the higher of requested/fallback price', () => {
		expect(usageCost([{ model: 'mystery', input: 0, output: 1_000_000 }], 'claude-sonnet-5-5', sonnet)).toBeCloseTo(25);
	});
	it('sums usage', () => {
		expect(sumUsage([{ model: 'a', input: 1, output: 2, cacheRead: 3 }, { model: 'b', input: 4, output: 5, cacheWrite: 6 }])).toEqual({
			input: 5,
			output: 7,
			cacheRead: 3,
			cacheWrite: 6
		});
	});
});
