import { describe, expect, it } from 'vitest';
import { mapToPerson } from './mapping.ts';
import { measure, rgbToLab, type Measurements } from './measure.ts';
import { cleanPerson, compactPerson, DEFAULTS } from './person.ts';

// synthetic measurements, not real people
const base: Measurements = {
	faceRatio: 0.8, jawRatio: 0.8, skinLab: [74, 16, 22], hairArea: 0.25, hairBelowChin: 0, hairFringe: 0.1, hairTop: false, hairRough: 0.05,
	hairLab: [15, 1, 0], hairCovered: false, eyeOpen: 0.26, smile: 0.2, jawOpen: 0.05, browArch: 0.4, glasses: 0, beardJaw: 0.05, beardLip: 0.03, beardChin: 0.04
};
const map = (m: Partial<Measurements>) => mapToPerson({ ...base, ...m });

describe('selfie → avatar parts', () => {
	it('reads hair styles from the mask', () => {
		expect(map({}).person.hair).toBe('swept');
		expect(map({ hairFringe: 0.6 }).person.hair).toBe('short');
		expect(map({ hairBelowChin: 0.1 }).person.hair).toBe('bob');
		expect(map({ hairBelowChin: 0.4 }).person.hair).toBe('long');
		expect(map({ hairArea: 0.02 }).person.hair).toBe('sides');
		expect(map({ hairArea: 0.05 }).person.hair).toBe('buzz');
		expect(map({ hairTop: true }).person.hair).toBe('bun');
		expect(map({ hairRough: 0.8 }).person.hair).toBe('curly');
		expect(map({ hairRough: 0.8, hairArea: 1.2 }).person.hair).toBe('afro');
	});

	it('picks the nearest skin tone and hair colour', () => {
		expect(map({ skinLab: rgbToLab(0xfb, 0xe7, 0xd6) }).person.skin).toBe('s1');
		expect(map({ skinLab: rgbToLab(0x5a, 0x36, 0x22) }).person.skin).toBe('s10');
		expect(map({ hairLab: rgbToLab(0xd8, 0xb2, 0x6a) }).person.hairColor).toBe('blonde');
		expect(map({ hairLab: rgbToLab(0x1d, 0x1a, 0x19) }).person.hairColor).toBe('black');
	});

	it('reads the face', () => {
		expect(map({ jawRatio: 0.95 }).person.headShape).toBe('square');
		expect(map({ faceRatio: 0.7 }).person.headShape).toBe('oval');
		expect(map({ smile: 0.9 }).person.mouth).toBe('grin');
		expect(map({ smile: 0.5 }).person.mouth).toBe('smile');
		expect(map({ jawOpen: 0.6, smile: 0.1 }).person.mouth).toBe('wow');
		expect(map({ smile: 0.9, eyeOpen: 0.12 }).person.eyes).toBe('happy');
	});

	it('asks instead of guessing when unsure, and never picks a head covering', () => {
		expect(map({ glasses: 0.5 })).toMatchObject({ person: { glasses: 'none' }, ask: ['glasses'] });
		expect(map({ glasses: 0.9 }).person.glasses).toBe('round');
		expect(map({ beardJaw: 0.35 })).toMatchObject({ person: { beard: 'none' }, ask: ['beard'] });
		expect(map({ beardJaw: 0.7 }).person.beard).toBe('full');
		const covered = map({ hairCovered: true, hairArea: 0.01 });
		expect(covered.person.head).toBe('none');
		expect(covered.ask).toContain('head');
	});

	it('gives only parts, never measurements', () => {
		const { person } = map({ hairBelowChin: 0.4, smile: 0.9 });
		expect(cleanPerson(person)).toEqual(person);
		expect(Object.keys(compactPerson(person)).every((k) => k in DEFAULTS)).toBe(true);
	});
});

describe('measure()', () => {
	it('reads a drawn face: skin, hair and the hair colour', () => {
		// a 200 × 200 picture: tan face disc, black hair cap above it, white background
		const W = 200, H = 200, rgba = new Uint8ClampedArray(W * H * 4).fill(255), hair = new Uint8Array(W * H);
		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++) {
				const i = y * W + x, face = (x - 100) ** 2 / 50 ** 2 + (y - 110) ** 2 / 65 ** 2 <= 1, cap = y < 70 && y > 30 && Math.abs(x - 100) < 55;
				const c = cap ? [29, 26, 25] : face ? [227, 174, 133] : [255, 255, 255];
				rgba.set([...c, 255], i * 4);
				if (cap) hair[i] = 1;
			}
		const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.55 }));
		const set = (i: number, x: number, y: number) => (lm[i] = { x: x / W, y: y / H });
		set(10, 100, 50); set(152, 100, 175); set(234, 50, 110); set(454, 150, 110); set(172, 60, 150); set(397, 140, 150);
		set(50, 75, 120); set(280, 125, 120); set(151, 100, 75); set(105, 82, 88); set(334, 118, 88); set(70, 72, 90); set(107, 92, 90); set(300, 128, 90); set(336, 108, 90);
		set(159, 80, 98); set(145, 80, 104); set(33, 72, 101); set(133, 88, 101); set(386, 120, 98); set(374, 120, 104); set(362, 112, 101); set(263, 128, 101);
		set(2, 100, 128); set(0, 100, 138); set(17, 100, 150); set(168, 100, 100);
		const m = measure({ landmarks: lm, blend: { mouthSmileLeft: 0.8, mouthSmileRight: 0.6 }, rgba, width: W, height: H, hair });
		expect(m.faceRatio).toBeCloseTo(0.8, 1);
		expect(mapToPerson(m).person.skin).toBe('s4');
		expect(mapToPerson(m).person.hairColor).toBe('black');
		expect(m.hairBelowChin).toBe(0);
		expect(m.smile).toBeCloseTo(0.7, 5);
		expect(m.beardJaw).toBe(0);
	});
});
