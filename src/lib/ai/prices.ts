/**
 * Model prices and cost math for the spend cap (docs/AI-PLAN.md D12, D15).
 * Pure and dependency-free: shared by the Worker and the browser.
 */
import type { Price, PriceSource } from './contract.ts';

/** USD per million tokens. Claude models; update with releases. */
export const BUILTIN_PRICES: Readonly<Record<string, Price>> = {
	'claude-opus-5-5': { inputPerM: 4, outputPerM: 20 },
	'claude-sonnet-5-5': { inputPerM: 2, outputPerM: 10 },
	'claude-haiku-5-5': { inputPerM: 0.1, outputPerM: 0.5 },
	'claude-fable-5-2': { inputPerM: 8, outputPerM: 40 },
	'claude-opus-5': { inputPerM: 5, outputPerM: 25 },
	'claude-sonnet-5': { inputPerM: 2, outputPerM: 10 },
	'claude-opus-4-8': { inputPerM: 5, outputPerM: 25 },
	'claude-haiku-4-5': { inputPerM: 1, outputPerM: 5 }
};

/** Cache writes (5-minute TTL) bill at 1.25x input; reads at ≤0.1x (we use 0.1x, the conservative figure). */
export const CACHE_WRITE_MULT = 1.25;
export const CACHE_READ_MULT = 0.1;

/**
 * Built-in price for a model id. Accepts dated snapshots and provider
 * prefixes that some gateways add ("anthropic/claude-sonnet-5-5",
 * "claude-haiku-4-5-20251001").
 */
export function builtinPrice(model: string): Price | null {
	const id = model.trim().toLowerCase().replace(/^anthropic\//, '');
	if (BUILTIN_PRICES[id]) return BUILTIN_PRICES[id];
	const undated = id.replace(/-\d{8}$/, '');
	return BUILTIN_PRICES[undated] ?? null;
}

export function isValidPrice(p: unknown): p is Price {
	if (!p || typeof p !== 'object') return false;
	const { inputPerM, outputPerM } = p as Price;
	return (
		typeof inputPerM === 'number' &&
		typeof outputPerM === 'number' &&
		Number.isFinite(inputPerM) &&
		Number.isFinite(outputPerM) &&
		inputPerM >= 0 &&
		outputPerM >= 0 &&
		inputPerM <= 1000 &&
		outputPerM <= 1000
	);
}

/**
 * D15 price resolution, first match wins:
 * provider's /models price → built-in table → manual price → null (blocked).
 */
export function resolvePrice(
	model: string,
	providerPrice: Price | null | undefined,
	manualPrice: Price | null | undefined
): { price: Price; source: PriceSource } | null {
	if (isValidPrice(providerPrice)) return { price: providerPrice, source: 'provider' };
	const builtin = builtinPrice(model);
	if (builtin) return { price: builtin, source: 'builtin' };
	if (isValidPrice(manualPrice)) return { price: manualPrice, source: 'manual' };
	return null;
}

/**
 * OpenRouter-style pricing: USD per token as strings ("0.000002").
 * Returns per-million prices, or null when missing/invalid/negative
 * (OpenRouter uses "-1" for "varies").
 */
export function parsePerTokenPricing(pricing: unknown): Price | null {
	if (!pricing || typeof pricing !== 'object') return null;
	const p = pricing as Record<string, unknown>;
	const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN);
	const i = num(p.prompt);
	const o = num(p.completion);
	if (!Number.isFinite(i) || !Number.isFinite(o) || i < 0 || o < 0) return null;
	const price = { inputPerM: round6(i * 1e6), outputPerM: round6(o * 1e6) };
	return isValidPrice(price) ? price : null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export interface TokenUsage {
	/** uncached input tokens */
	input: number;
	cacheWrite?: number;
	cacheRead?: number;
	output: number;
}

/** Actual cost in USD of one call. */
export function costUsd(u: TokenUsage, price: Price): number {
	const n = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);
	const inCost =
		n(u.input) * price.inputPerM +
		n(u.cacheWrite) * price.inputPerM * CACHE_WRITE_MULT +
		n(u.cacheRead) * price.inputPerM * CACHE_READ_MULT;
	return (inCost + n(u.output) * price.outputPerM) / 1e6;
}

/**
 * Worst-case cost for the cap pre-check: the whole input billed as a cache
 * write (the most expensive way input can bill) plus `maxTokens` of output.
 */
export function worstCaseUsd(inputTokensEstimate: number, maxTokens: number, price: Price): number {
	return costUsd({ input: 0, cacheWrite: inputTokensEstimate, output: maxTokens }, price);
}

/**
 * Rough, deliberately high input-token estimate: Japanese runs about one
 * token per character and English about four characters per token, so
 * chars/2 over-counts mixed text. Images add a flat allowance each.
 */
export const IMAGE_TOKEN_ALLOWANCE = 5000;
export function estimateInputTokens(texts: string[], images = 0): number {
	const chars = texts.reduce((s, t) => s + t.length, 0);
	return Math.ceil(chars / 2) + 50 + images * IMAGE_TOKEN_ALLOWANCE;
}

/** True when a call costing up to `worstUsd` still fits under the cap. */
export function capAllows(spentUsd: number, capUsd: number, worstUsd: number): boolean {
	if (!Number.isFinite(capUsd) || capUsd <= 0) return false;
	return spentUsd + worstUsd <= capUsd + 1e-9;
}
