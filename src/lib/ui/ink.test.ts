import { describe, expect, it } from 'vitest';
import { inkDuration, sampleInk, simplify, strokePath, tighten, type InkPoint } from './ink.ts';

describe('ink', () => {
	it('draws a stroke as a path, cut at a time', () => {
		const s: InkPoint[] = [
			[0, 0, 0],
			[0.5, 0.5, 100],
			[1, 0, 200]
		];
		expect(strokePath(s, 100, 50)).toBe('M0 0Q50 25 75 12.5L100 0');
		expect(strokePath(s, 100, 50, 100)).toBe('M0 0L50 25');
		expect(strokePath(s, 100, 50, -1)).toBe('');
		expect(strokePath([[0.5, 0.5, 0]], 100, 50)).toBe('M50 25l0.1 0');
	});

	it('keeps the ends and drops points that barely moved', () => {
		const s: InkPoint[] = [
			[0, 0, 0],
			[0.001, 0, 5],
			[0.1, 0, 10],
			[0.1005, 0, 15]
		];
		expect(simplify(s)).toEqual([
			[0, 0, 0],
			[0.1, 0, 10],
			[0.1005, 0, 15]
		]);
	});

	it('shortens long pauses between strokes', () => {
		const ink = {
			aspect: 2,
			strokes: [
				[
					[0, 0, 0],
					[1, 1, 100]
				],
				[
					[0, 0, 5000],
					[1, 1, 5100]
				]
			] as InkPoint[][]
		};
		const t = tighten(ink, 300);
		expect(t.strokes[1][0][2]).toBe(400);
		expect(inkDuration(t)).toBe(500);
	});

	it('has a sample that plays for a couple of seconds', () => {
		const d = inkDuration(sampleInk());
		expect(d).toBeGreaterThan(1500);
		expect(d).toBeLessThan(4000);
	});
});
