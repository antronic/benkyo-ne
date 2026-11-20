/**
 * AI credits: what a package's managed AI is counted in.
 *
 * Each package gives a number of credits a month (plans.ai_credits). Each
 * model has a credit rate set in the fleet console (model_credit_rates): so
 * many credits for input and for output tokens, per 1, per 1K or per 1M
 * tokens. A model without a rate costs its USD price at CREDITS_PER_USD, so a
 * package keeps working the way it did before rates existed.
 *
 * Pure and dependency-free: shared by the Worker and the browser.
 */
import type { TokenUsage } from './prices.ts';

/** Default exchange for a model without a credit rate: 1 credit = $0.001 of model cost. */
export const CREDITS_PER_USD = 1000;
/** The token units a rate can be priced per. */
export const CREDIT_UNITS = [1, 1000, 1_000_000] as const;
export type CreditUnit = (typeof CREDIT_UNITS)[number];
/** Highest credits for one unit of tokens. */
export const MAX_RATE_CREDITS = 1_000_000;
/** Highest monthly credits in one package. */
export const MAX_PACKAGE_CREDITS = 10_000_000;

export interface CreditRate {
	/** tokens the credits below are for: 1, 1000 or 1000000 */
	unit: CreditUnit;
	/** credits per `unit` input tokens (cache reads and writes count as input) */
	inputCredits: number;
	/** credits per `unit` output tokens */
	outputCredits: number;
}

export const isCreditUnit = (u: unknown): u is CreditUnit => (CREDIT_UNITS as readonly unknown[]).includes(u);

/** Credits for the tokens a call used, at a model's rate. */
export function creditsForTokens(inputTokens: number, outputTokens: number, rate: CreditRate): number {
	return (inputTokens * rate.inputCredits + outputTokens * rate.outputCredits) / rate.unit;
}

/** Credits for a call's usage: every kind of input token counts as input. */
export function creditsForUsage(u: TokenUsage, rate: CreditRate): number {
	return creditsForTokens((u.input || 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0), u.output || 0, rate);
}

/** Credits for a USD cost, for a model without a rate. */
export const creditsForUsd = (usd: number) => usd * CREDITS_PER_USD;

/** "1", "1K" or "1M". */
export const unitLabel = (u: CreditUnit) => (u === 1 ? '1' : u === 1000 ? '1K' : '1M');

/** "1,500" (whole credits), or "2.5" / "0.004" for small fractions. */
export function formatCredits(n: number): string {
	if (!Number.isFinite(n)) return '0';
	if (n === 0) return '0';
	if (Math.abs(n) >= 100) return Math.round(n).toLocaleString('en-US');
	return String(+n.toPrecision(3));
}

/** "2 in / 8 out credits per 1K tokens". */
export function rateLabel(r: CreditRate): string {
	return `${formatCredits(r.inputCredits)} in / ${formatCredits(r.outputCredits)} out credits per ${unitLabel(r.unit)} token${r.unit === 1 ? '' : 's'}`;
}

/** The USD a model's price would cost per credit at this rate, for the console's margin hint; null when unknown. */
export function usdPerCredit(price: { inputPerM: number | null; outputPerM: number | null }, rate: CreditRate): number | null {
	if (price.inputPerM === null || price.outputPerM === null) return null;
	// per million tokens of each kind, what the provider charges and what the learner spends
	const credits = ((rate.inputCredits + rate.outputCredits) * 1_000_000) / rate.unit;
	if (credits <= 0) return null;
	return (price.inputPerM + price.outputPerM) / credits;
}
