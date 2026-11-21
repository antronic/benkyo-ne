/**
 * Word politeness (draft, docs/EVERYDAY.md "Word politeness"): where a word sits
 * on the casual → formal scale, and who you can say it to. Pure functions only.
 *
 * The level comes from the JMdict usage marks of the word's first sense
 * (`hon`, `hum`, `pol`, `form`, `col`, `fam`, `sl`…), which ship with the
 * on-device dictionary. A word with none of them is neutral: it fits any level
 * and the sentence ending (食べる / 食べます) sets the politeness.
 */
import type { WriteTo } from '#lib/ai/contract.ts';

/** Where a word sits. `any` = neutral: the ending decides. */
export type Politeness = 'slang' | 'casual' | 'any' | 'polite' | 'respectful' | 'humble' | 'formal';
export const POLITENESS: Politeness[] = ['slang', 'casual', 'any', 'polite', 'respectful', 'humble', 'formal'];

/** The steps of the bar, left to right. */
export type PoliteStep = 'casual' | 'polite' | 'keigo' | 'formal';
export const POLITE_STEPS: PoliteStep[] = ['casual', 'polite', 'keigo', 'formal'];

/** How well a word fits talking to someone: fine, works but feels off (too stiff or too close), or don't. */
export type Fit = 'yes' | 'careful' | 'no';

/** JMdict marks, strongest first: a word marked both `hum` and `pol` is humble. */
const MARKS: [string, Politeness][] = [
	['form', 'formal'],
	['hon', 'respectful'],
	['hum', 'humble'],
	['pol', 'polite'],
	['vulg', 'slang'],
	['derog', 'slang'],
	['sl', 'slang'],
	['net-sl', 'slang'],
	['col', 'casual'],
	['fam', 'casual'],
	['chn', 'casual'],
	['male', 'casual']
];

/**
 * The politeness of a word from the marks of its first sense. JMdict marks
 * everyday お/ご nouns (お茶, お金) `pol`, but friends say them too, so a `pol`
 * word written with that prefix counts as neutral.
 */
export function politenessFromMarks(marks: readonly string[] | undefined, written = ''): Politeness {
	for (const [m, p] of MARKS) {
		if (!marks?.includes(m)) continue;
		return p === 'polite' && /^[おご御]./.test(written) ? 'any' : p;
	}
	return 'any';
}

/** The step the word reaches on the bar; null for a neutral word (every step fits). */
export function politeStep(p: Politeness): number | null {
	switch (p) {
		case 'slang':
		case 'casual':
			return 0;
		case 'polite':
			return 1;
		case 'respectful':
		case 'humble':
			return 2;
		case 'formal':
			return 3;
		case 'any':
			return null;
	}
}

const FITS: Record<Politeness, Record<WriteTo, Fit>> = {
	slang: { friend: 'careful', colleague: 'no', boss: 'no', customer: 'no' },
	casual: { friend: 'yes', colleague: 'careful', boss: 'no', customer: 'no' },
	any: { friend: 'yes', colleague: 'yes', boss: 'yes', customer: 'yes' },
	polite: { friend: 'careful', colleague: 'yes', boss: 'yes', customer: 'yes' },
	respectful: { friend: 'no', colleague: 'careful', boss: 'yes', customer: 'yes' },
	humble: { friend: 'no', colleague: 'careful', boss: 'yes', customer: 'yes' },
	formal: { friend: 'no', colleague: 'careful', boss: 'yes', customer: 'yes' }
};

/** Who you can say a word like this to (the same people as the Writing helper). */
export function politeFits(p: Politeness): Record<WriteTo, Fit> {
	return FITS[p];
}
