import kana from './strokes.json';
import kanji from './kanji-strokes.json';

export interface StrokeData {
	/** SVG path data per stroke, 109×109 box (KanjiVG). */
	d: string[];
	/** Stroke-number label positions. */
	n: [number, number][];
	/** Each stroke resampled to 24 points, flattened x,y in 0..1. */
	p: number[][];
	/** Kanji only: top-level components as [element, original, firstStroke, lastStroke]. */
	g?: [string, string | null, number, number][];
}

const KANA_STROKES = kana as unknown as Record<string, StrokeData>;
/** Kanji lessons' strokes, plus the level-course kanji once loadLevelStrokes() ran. */
const KANJI_STROKES: Record<string, StrokeData> = { ...(kanji as unknown as Record<string, StrokeData>) };

export const STROKES: Record<string, StrokeData> = { ...KANA_STROKES, ...KANJI_STROKES };
export const strokesOf = (char: string): StrokeData | undefined => STROKES[char];

let levelLoad: Promise<void> | null = null;
/**
 * Stroke data for the level-course kanji (level-kanji-strokes.json, about
 * 150 KB) is a separate chunk: screens that draw those kanji await this first.
 */
export function loadLevelStrokes(): Promise<void> {
	levelLoad ??= import('./level-kanji-strokes.json')
		.then((m) => {
			const more = m.default as unknown as Record<string, StrokeData>;
			Object.assign(KANJI_STROKES, more);
			Object.assign(STROKES, more);
		})
		.catch((e) => {
			levelLoad = null;
			throw e;
		});
	return levelLoad;
}

/** Characters the handwriting matcher should compare a drawing of `char` against. */
export const familyOf = (char: string): string[] =>
	Object.keys(char in KANJI_STROKES ? KANJI_STROKES : KANA_STROKES);

/** Distinct colours for a kanji's components, one per stroke (undefined when it has none). */
export const PART_COLORS = ['#ff6b5a', '#2f8fff', '#3faf4a'];
export function partColors(char: string): (string | undefined)[] | undefined {
	const s = STROKES[char];
	if (!s?.g || s.g.length < 2) return undefined;
	const out: (string | undefined)[] = s.d.map(() => undefined);
	s.g.forEach(([, , from, to], i) => {
		for (let k = from; k <= to; k++) out[k] = PART_COLORS[i % PART_COLORS.length];
	});
	return out;
}
