/**
 * Kanji you keep forgetting (docs/EVERYDAY.md): this week's slips, from the
 * review log (a kanji card or a word with kanji graded Again: a misread) and
 * from handwriting (a kanji drawn wrong from memory: couldn't write).
 *
 * Pure functions only; `src/lib/state/forgetting.svelte.ts` loads the data.
 */
import { Again, type Grade } from '#lib/srs/fsrs.ts';

export const WEEK_MS = 7 * 86_400_000;
/** Most kanji in one week's set (about 5 minutes). */
export const SET_SIZE = 12;
/** A write slip is also an Again in the log a moment later: count it once, as a write slip. */
const SAME_SLIP_MS = 5_000;

const KANJI_RE = /[㐀-䶿一-鿿豈-﫿々]/g;
export const kanjiIn = (text: string | null | undefined) => [...new Set((text ?? '').match(KANJI_RE) ?? [])].filter((c) => c !== '々');

export interface WriteSlip {
	char: string;
	at: number;
}

export interface Slipped {
	char: string;
	misread: number;
	unwritten: number;
	lastAt: number;
}

/**
 * This week's set, most slips first (then the most recent).
 * `textOf(cardId)` gives the written form of a word card (null for other cards).
 */
export function forgottenKanji(
	logs: readonly { cardId: string; grade: Grade; reviewedAt: number }[],
	writeSlips: readonly WriteSlip[],
	textOf: (cardId: string) => string | null,
	now = Date.now(),
	n = SET_SIZE
): Slipped[] {
	const since = now - WEEK_MS;
	const by = new Map<string, Slipped>();
	const get = (char: string) => by.get(char) ?? (by.set(char, { char, misread: 0, unwritten: 0, lastAt: 0 }), by.get(char)!);
	const slips = writeSlips.filter((s) => s.at >= since && s.at <= now);
	for (const s of slips) {
		const k = get(s.char);
		k.unwritten++;
		k.lastAt = Math.max(k.lastAt, s.at);
	}
	for (const l of logs) {
		if (l.grade !== Again || l.reviewedAt < since || l.reviewedAt > now) continue;
		const chars = l.cardId.startsWith('kanji:') ? [l.cardId.slice(6)] : kanjiIn(textOf(l.cardId));
		for (const char of chars) {
			if (slips.some((s) => s.char === char && Math.abs(s.at - l.reviewedAt) < SAME_SLIP_MS)) continue;
			const k = get(char);
			k.misread++;
			k.lastAt = Math.max(k.lastAt, l.reviewedAt);
		}
	}
	return [...by.values()].sort((a, b) => b.misread + b.unwritten - (a.misread + a.unwritten) || b.lastAt - a.lastAt).slice(0, n);
}

/** Keep only slips from the last `days` days (the stored list never grows past that). */
export const keepRecent = (slips: readonly WriteSlip[], now = Date.now(), days = 60) => slips.filter((s) => now - s.at <= days * 86_400_000);
