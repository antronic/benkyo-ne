/**
 * Writing helper (docs/EVERYDAY.md): turns the AI's edits into marked text for
 * `MarkedText`, and names how far the message is from the right politeness.
 * Pure functions only.
 */
import type { MarkedPart } from '#lib/ui/MarkedText.svelte';
import type { WriteChange } from '#lib/ai/contract.ts';

/**
 * The message with each change shown in place: the old text struck out, the
 * new text inserted. Changes are placed in order; one whose `from` is not found
 * after the previous change is left out (the rewrite still shows it).
 */
export function markChanges(text: string, changes: WriteChange[]): MarkedPart[] {
	const parts: MarkedPart[] = [];
	let at = 0;
	for (const c of changes) {
		const i = text.indexOf(c.from, at);
		if (i < 0) continue;
		if (i > at) parts.push({ text: text.slice(at, i) });
		// an addition anchored on the old text keeps that text plain; anything else is replaced whole
		const kept = c.to.indexOf(c.from);
		if (kept >= 0) {
			if (kept > 0) parts.push({ text: c.to.slice(0, kept), kind: 'add' });
			parts.push({ text: c.from });
			if (kept + c.from.length < c.to.length) parts.push({ text: c.to.slice(kept + c.from.length), kind: 'add' });
		} else {
			parts.push({ text: c.from, kind: 'del' }, { text: c.to, kind: 'add' });
		}
		at = i + c.from.length;
	}
	if (at < text.length) parts.push({ text: text.slice(at) });
	return parts;
}

export type PoliteGap = 'fits' | 'tooCasual' | 'tooFormal';

/** How the message's politeness compares with the right one for the person. */
export function politeGap(level: number, target: number, fits: boolean): PoliteGap {
	if (fits || Math.abs(level - target) < 0.15) return 'fits';
	return level < target ? 'tooCasual' : 'tooFormal';
}
