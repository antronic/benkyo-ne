import data from './strokes.json';

export interface StrokeData {
	/** SVG path data per stroke, 109×109 box (KanjiVG). */
	d: string[];
	/** Stroke-number label positions. */
	n: [number, number][];
	/** Each stroke resampled to 24 points, flattened x,y in 0..1. */
	p: number[][];
}

export const STROKES = data as unknown as Record<string, StrokeData>;
export const strokesOf = (char: string): StrokeData | undefined => STROKES[char];
