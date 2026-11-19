/** Display helpers for AI models in the fleet console. */
import type { AdminFeature } from './contract.ts';

export const FEATURE_NAMES: Record<AdminFeature, string> = { fill: 'Fill a card', propose: 'Suggest cards and Ask AI', vision: 'Read a photo', translate: 'Translate community posts' };
export const FEATURE_SHORT: Record<AdminFeature, string> = { fill: 'Fill', propose: 'Suggest', vision: 'Photo', translate: 'Translate' };

export function contextLabel(tokens: number | null): string {
	if (!tokens) return '';
	return tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M context` : `${Math.round(tokens / 1000)}K context`;
}

const perM = (n: number) => (n === 0 ? '$0' : n < 0.1 ? `$${+n.toFixed(3)}` : `$${+n.toFixed(2)}`);

/** "$3 in / $15 out per M tokens", or "No price listed". */
export function priceLabel(m: { inputPerM: number | null; outputPerM: number | null }): string {
	if (m.inputPerM === null || m.outputPerM === null) return 'No price listed';
	if (m.inputPerM === 0 && m.outputPerM === 0) return 'Free';
	return `${perM(m.inputPerM)} in / ${perM(m.outputPerM)} out per M tokens`;
}

export const usd = (n: number) => (n === 0 ? '$0' : `$${n % 1 ? n.toFixed(2) : n}`);
