/** Cost helpers for the Worker AI flow (pure; unit-tested). */
import type { Price, ProviderKind } from '../../src/lib/ai/contract.ts';
import type { PromptParts } from '../../src/lib/ai/prompts.ts';
import { creditsForTokens, creditsForUsage, creditsForUsd, type CreditRate } from '../../src/lib/ai/credits.ts';
import { builtinPrice, costUsd, estimateInputTokens, worstCaseUsd, type TokenUsage } from '../../src/lib/ai/prices.ts';
import { usesFallback } from './anthropic.ts';
import type { UsageEntry } from './types.ts';

/** Assumed price of the server-side refusal fallback model (Opus 4.8 is the documented target). */
export const FALLBACK_PRICE: Price = { inputPerM: 5, outputPerM: 25 };

const maxPrice = (a: Price, b: Price): Price => ({
	inputPerM: Math.max(a.inputPerM, b.inputPerM),
	outputPerM: Math.max(a.outputPerM, b.outputPerM)
});

export function inputEstimate(parts: PromptParts): number {
	return estimateInputTokens([parts.system, parts.user, JSON.stringify(parts.schema)], parts.image ? 1 : 0);
}

/**
 * Worst case for the cap pre-check. With the Anthropic refusal fallback a
 * declined request can bill a second, possibly pricier, model on top.
 */
export function worstCaseForCall(parts: PromptParts, provider: ProviderKind, model: string, price: Price): number {
	const inTok = inputEstimate(parts);
	let worst = worstCaseUsd(inTok, parts.maxTokens, price);
	if (provider === 'anthropic' && usesFallback(model)) {
		worst += worstCaseUsd(inTok, parts.maxTokens, maxPrice(price, FALLBACK_PRICE));
	}
	return worst;
}

const sameModel = (a: string, b: string) => a === b || a.replace(/-\d{8}$/, '') === b.replace(/-\d{8}$/, '');

/** Actual cost: each usage entry at its own model's price (fallback models use the built-in table). */
export function usageCost(entries: UsageEntry[], requested: string, price: Price): number {
	let total = 0;
	for (const e of entries) {
		const p = sameModel(e.model, requested) ? price : (builtinPrice(e.model) ?? maxPrice(price, FALLBACK_PRICE));
		total += costUsd(e, p);
	}
	return total;
}

export function sumUsage(entries: UsageEntry[]): TokenUsage {
	return entries.reduce<TokenUsage>(
		(s, e) => ({
			input: s.input + (e.input || 0),
			cacheWrite: (s.cacheWrite ?? 0) + (e.cacheWrite ?? 0),
			cacheRead: (s.cacheRead ?? 0) + (e.cacheRead ?? 0),
			output: s.output + (e.output || 0)
		}),
		{ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }
	);
}

/** What a call costs: USD (what the provider charges) and package credits (0 for the learner's own key). */
export interface Charge {
	usd: number;
	credits: number;
}

/** The parts of an AI target the charge depends on (worker/ai/managed.ts AiTarget). */
export interface ChargeTarget {
	provider: ProviderKind;
	model: string;
	price: Price;
	source: 'own' | 'package';
	/** the model's credit rate; null: its USD price at the default exchange */
	rate: CreditRate | null;
}

/**
 * Worst case of a call, in USD and in credits. With the Anthropic refusal
 * fallback a declined request can bill a second model on top: in credits
 * that's the same rate twice.
 */
export function worstForCall(parts: PromptParts, t: ChargeTarget): Charge {
	const usd = worstCaseForCall(parts, t.provider, t.model, t.price);
	if (t.source !== 'package') return { usd, credits: 0 };
	if (!t.rate) return { usd, credits: creditsForUsd(usd) };
	const calls = t.provider === 'anthropic' && usesFallback(t.model) ? 2 : 1;
	return { usd, credits: calls * creditsForTokens(inputEstimate(parts), parts.maxTokens, t.rate) };
}

/** Actual charge of a call's usage entries. */
export function usageCharge(entries: UsageEntry[], t: ChargeTarget): Charge {
	const usd = usageCost(entries, t.model, t.price);
	if (t.source !== 'package') return { usd, credits: 0 };
	return { usd, credits: t.rate ? creditsForUsage(sumUsage(entries), t.rate) : creditsForUsd(usd) };
}
