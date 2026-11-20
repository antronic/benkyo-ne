/**
 * Selfie measurements → avatar parts (docs/AVATAR.md, "How a selfie becomes an avatar").
 *
 * Every value is one of the style pack's parts. A clear reading picks the part; an unsure one
 * is asked instead (`ask`), with nothing picked for the learner. Head coverings are never
 * picked automatically: covered hair always becomes a question. Clothes, earrings and the
 * hearing aid are not read from the photo.
 */
import type { Measurements } from './measure.ts';
import { deltaE, hexToLab } from './measure.ts';
import { DEFAULTS, HAIRC, SKIN, type Person } from './person.ts';

/** Questions the result screen asks when the photo was unclear. */
export type Ask = 'glasses' | 'beard' | 'head';

function nearest<K extends string>(lab: number[], palette: Record<K, string>): K {
	let best = Object.keys(palette)[0] as K,
		bd = Infinity;
	for (const [k, hex] of Object.entries(palette) as [K, string][]) {
		const d = deltaE(lab, hexToLab(hex));
		if (d < bd) (bd = d), (best = k);
	}
	return best;
}

/**
 * Skin lightness as a phone photo shows it, for each skin tone (s1 lightest … s10 darkest).
 * A photo comes out darker and less even than the drawn palette, so tones are matched by
 * lightness against this scale, not by colour distance to the drawn swatches.
 */
export const SKIN_PHOTO_L: Record<keyof typeof SKIN, number> = { s1: 82, s2: 77, s3: 72, s4: 66, s5: 60, s6: 54, s7: 48, s8: 42, s9: 36, s10: 30 };
/** The skin tone for a photo: the nearest step on the photo lightness scale. Colour is not used: indoor light tints it. */
export function skinTone(m: Pick<Measurements, 'skinLab'>): keyof typeof SKIN {
	let best: keyof typeof SKIN = 's1',
		bd = Infinity;
	for (const [s, v] of Object.entries(SKIN_PHOTO_L) as [keyof typeof SKIN, number][]) {
		if (Math.abs(m.skinLab[0] - v) < bd) (bd = Math.abs(m.skinLab[0] - v)), (best = s);
	}
	return best;
}

export function mapToPerson(m: Measurements): { person: Person; ask: Ask[] } {
	const ask: Ask[] = [];
	const p: Person = { ...DEFAULTS };

	p.headShape = m.jawRatio > 0.9 ? 'square' : m.faceRatio < 0.74 ? 'oval' : 'round';
	p.skin = skinTone(m);

	if (m.hairCovered) {
		// a hijab, turban, scarf or hat: the learner says which, or none
		p.hair = 'short';
		ask.push('head');
	} else if (m.hairArea < 0.03) p.hair = 'sides';
	else if (m.hairArea < 0.08) p.hair = 'buzz';
	else if (m.hairTop) p.hair = 'bun';
	else if (m.hairRough > 0.5 && m.hairArea > 0.9) p.hair = 'afro';
	else if (m.hairRough > 0.5) p.hair = 'curly';
	else if (m.hairRough > 0.3 && m.hairBelowChin > 0.1) p.hair = 'wavy';
	else if (m.hairBelowChin > 0.25) p.hair = 'long';
	else if (m.hairBelowChin > 0) p.hair = 'bob';
	else if (m.hairFringe > 0.4) p.hair = 'short';
	else p.hair = 'swept';
	if (!m.hairCovered && m.hairArea >= 0.03) p.hairColor = nearest(m.hairLab, HAIRC);

	p.eyes = m.smile > 0.75 && m.eyeOpen < 0.18 ? 'happy' : m.eyeOpen < 0.2 ? 'dot' : 'oval';
	p.mouth = m.jawOpen > 0.45 && m.smile < 0.2 ? 'wow' : m.smile > 0.7 || (m.jawOpen > 0.3 && m.smile > 0.4) ? 'grin' : m.smile > 0.35 ? 'smile' : 'calm';
	p.brows = m.browArch > 0.7 ? 'arch' : 'bar';

	if (m.glasses >= 0.7) p.glasses = 'round';
	else if (m.glasses >= 0.4) ask.push('glasses');

	if (m.beardJaw >= 0.5) p.beard = 'full';
	else if (m.beardLip >= 0.45 && m.beardJaw < 0.2) p.beard = 'moustache';
	else if (m.beardChin >= 0.45 && m.beardJaw < 0.3) p.beard = 'goatee';
	else if (m.beardJaw >= 0.3) ask.push('beard');

	return { person: p, ask };
}
