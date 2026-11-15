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
const KANJI_STROKES = kanji as unknown as Record<string, StrokeData>;

export const STROKES: Record<string, StrokeData> = { ...KANA_STROKES, ...KANJI_STROKES };
export const strokesOf = (char: string): StrokeData | undefined => STROKES[char];

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
