/**
 * Keep secrets out of beta usage data. Used on the device before events are
 * queued and again on the Worker before anything is stored, including AI
 * prompts (someone could paste an API key into Ask AI).
 *
 * - fields whose name looks secret (apiKey, token, password, cookie, …) are dropped
 * - text that looks like a provider API key or bearer token is replaced by [redacted]
 */

const SECRET_FIELD = /api[-_]?key|secret|password|passwd|authorization|cookie|recovery[-_]?code|private[-_]?key|key[-_]?cipher|token$|^key$/i;

const SECRET_TEXT: RegExp[] = [
	/\bsk-(?:ant-|or-|proj-|live-)?[A-Za-z0-9_-]{16,}/g, // Anthropic, OpenAI, OpenRouter style keys
	/\b(?:AIza)[0-9A-Za-z_-]{30,}/g, // Google API keys
	/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/g, // GitHub tokens
	/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
	/\b[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/g // Benkyo recovery codes
];

export const REDACTED = '[redacted]';

export function scrubText(s: string): string {
	let out = s;
	for (const re of SECRET_TEXT) out = out.replace(re, REDACTED);
	return out;
}

export function scrub(value: unknown, depth = 0): unknown {
	if (typeof value === 'string') return scrubText(value);
	if (value === null || typeof value !== 'object') return typeof value === 'function' ? undefined : value;
	if (depth > 6) return '[deep]';
	if (Array.isArray(value)) return value.slice(0, 200).map((v) => scrub(v, depth + 1));
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (SECRET_FIELD.test(k)) continue;
		const s = scrub(v, depth + 1);
		if (s !== undefined) out[k] = s;
	}
	return out;
}
