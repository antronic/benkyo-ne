/**
 * The avatar "person": every choice that draws someone's avatar, and nothing else.
 *
 * A person is a small object of part ids ({ hair: 'bob', glasses: 'round', … }). It is what the
 * account saves (`accounts.avatar`, PUT /api/auth/avatar), what the beta event `avatar_saved`
 * reports, and what Benkyo's style pack for Coreva Render draws (./pack/benkyo-style.js). It never
 * holds the selfie or anything that could rebuild a face. See docs/AVATAR.md.
 *
 * Shared by the app and the Worker (worker/avatar.ts), so keep it free of browser code.
 */

/* Palettes. Colours come from Benkyo's tokens (src/lib/design/tokens.css) where one exists. */
export const SKIN = { s1: '#FBE7D6', s2: '#F6D5BB', s3: '#EFC29F', s4: '#E3AE85', s5: '#D49A6E', s6: '#C08559', s7: '#A86F47', s8: '#8E5A39', s9: '#73472D', s10: '#5A3622' } as const;
export const HAIRC = { black: '#1d1a19', dark: '#3b2a24', brown: '#6a453b', auburn: '#8a4a3f', red: '#a8442a', blonde: '#d8b26a', platinum: '#ebdfc4', grey: '#c9ccd3', ash: '#8b8f9c' } as const;
export const CLOTH = { shu: '#e8432e', ai: '#3b5bdb', sumire: '#8b5cf6', matcha: '#34a853', sakura: '#f2a7b8', sky: '#4f9fd9', sand: '#d7c49b', slate: '#5d6b82', white: '#f3f5fb', sumi: '#2b2b33' } as const;
export const COLLAR = { navy: '#26305a', white: '#f3f5fb', shu: '#b8264f', ai: '#2b44a8', matcha: '#22803c', sand: '#b59a63' } as const;
export const HEADC = { ai: '#7b93ff', shu: '#ff7a5c', sumire: '#a78bfa', matcha: '#5fd17a', dusty: '#c9a39e', sand: '#d9c6a0', sakura: '#e9a3b4', slate: '#5d6b82', sumi: '#2b2b33' } as const;
export const FRAMEC = { shu: '#e8432e', ai: '#3b5bdb', sumire: '#8b5cf6', matcha: '#34a853', sand: '#c9a46a', graphite: '#4b5263' } as const;

/** Hats and head coverings, and which hair each one hides ('front' fringe, 'top' bun or tie, 'back' behind the head). */
export const HATS = {
	none: { hides: [] },
	hijab: { hides: ['front', 'top', 'back', 'ears', 'neck'] },
	turban: { hides: ['front', 'top', 'back'] },
	cap: { hides: ['front', 'top'] },
	beanie: { hides: ['front', 'top'] },
	bucket: { hides: ['front', 'top'] },
	headscarf: { hides: ['front', 'top'] }
} as const satisfies Record<string, { hides: readonly string[] }>;

/** The parts a learner picks from, in the order the editor shows them. */
export const OPTIONS = {
	hair: ['short', 'swept', 'undercut', 'buzz', 'sides', 'mohawk', 'bob', 'long', 'wavy', 'bun', 'ponytail', 'pigtails', 'braids', 'curly', 'afro', 'locs'],
	headShape: ['round', 'oval', 'square'],
	beard: ['none', 'stubble', 'moustache', 'goatee', 'full'],
	eyes: ['oval', 'dot', 'happy'],
	brows: ['bar', 'arch', 'thick'],
	mouth: ['grin', 'smile', 'calm', 'wow', 'concern'],
	glasses: ['none', 'round', 'square'],
	head: ['none', 'hijab', 'turban', 'cap', 'beanie', 'bucket', 'headscarf'],
	outfit: ['crew', 'polo', 'coat', 'scrubs'],
	blush: ['off', 'on'],
	earrings: ['off', 'on'],
	aid: ['off', 'on']
} as const;

/** Colour choices, by person key. */
export const COLOURS = { skin: SKIN, hairColor: HAIRC, cloth: CLOTH, collar: COLLAR, headColor: HEADC, frameColor: FRAMEC } as const;

type Opt<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number];
type Col<K extends keyof typeof COLOURS> = keyof (typeof COLOURS)[K];

export interface Person {
	skin: Col<'skin'>;
	hair: Opt<'hair'>;
	hairColor: Col<'hairColor'>;
	headShape: Opt<'headShape'>;
	beard: Opt<'beard'>;
	eyes: Opt<'eyes'>;
	brows: Opt<'brows'>;
	mouth: Opt<'mouth'>;
	blush: Opt<'blush'>;
	head: Opt<'head'>;
	headColor: Col<'headColor'>;
	glasses: Opt<'glasses'>;
	aid: Opt<'aid'>;
	earrings: Opt<'earrings'>;
	outfit: Opt<'outfit'>;
	cloth: Col<'cloth'>;
	collar: Col<'collar'>;
	frameColor: Col<'frameColor'>;
}

/** Benkyo's starting look (round frame in shu, ai clothes). */
export const DEFAULTS: Person = {
	skin: 's4',
	hair: 'swept',
	hairColor: 'brown',
	headShape: 'round',
	beard: 'none',
	eyes: 'oval',
	brows: 'bar',
	mouth: 'grin',
	blush: 'on',
	head: 'none',
	headColor: 'ai',
	glasses: 'none',
	aid: 'off',
	earrings: 'off',
	outfit: 'crew',
	cloth: 'ai',
	collar: 'navy',
	frameColor: 'shu'
};

/** What the style pack also needs but the learner never picks (Coreva's Friendly layout). */
export const FIXED = { face: 'on', badge: 'off', frame: 'solid', shape: 'circle', shade: 'on' } as const;

const ALLOWED: Record<keyof Person, readonly string[]> = {
	skin: Object.keys(SKIN),
	hair: OPTIONS.hair,
	hairColor: Object.keys(HAIRC),
	headShape: OPTIONS.headShape,
	beard: OPTIONS.beard,
	eyes: OPTIONS.eyes,
	brows: OPTIONS.brows,
	mouth: OPTIONS.mouth,
	blush: OPTIONS.blush,
	head: OPTIONS.head,
	headColor: Object.keys(HEADC),
	glasses: OPTIONS.glasses,
	aid: OPTIONS.aid,
	earrings: OPTIONS.earrings,
	outfit: OPTIONS.outfit,
	cloth: Object.keys(CLOTH),
	collar: Object.keys(COLLAR),
	frameColor: Object.keys(FRAMEC)
};

export const PERSON_KEYS = Object.keys(ALLOWED) as (keyof Person)[];

/**
 * A complete, valid person from untrusted input (a request body, a stored row, an old save).
 * Unknown keys are dropped and unknown values fall back to DEFAULTS. Returns null when the
 * input is not an object at all.
 */
export function cleanPerson(input: unknown): Person | null {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const src = input as Record<string, unknown>;
	const out = { ...DEFAULTS } as Record<keyof Person, string>;
	for (const k of PERSON_KEYS) {
		const v = src[k];
		if (typeof v === 'string' && ALLOWED[k].includes(v)) out[k] = v;
	}
	return out as unknown as Person;
}

/** Only the choices that differ from DEFAULTS: what gets stored and sent (a few dozen bytes). */
export function compactPerson(p: Person): Partial<Person> {
	const out: Partial<Person> = {};
	for (const k of PERSON_KEYS) if (p[k] !== DEFAULTS[k]) (out as Record<string, string>)[k] = p[k];
	return out;
}
