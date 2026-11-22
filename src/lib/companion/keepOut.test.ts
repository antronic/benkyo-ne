import { describe, expect, it } from 'vitest';
import { clear, cover, freeSpots, GAP, hits, leastCovered, nearest, overlap, pathClear, wanderTarget, type Box } from './keepOut.ts';

const S = 104;
// a phone-sized screen with a tab bar along the bottom and a button in the middle
const area = { left: 4, top: 4, right: 390 - S - 4, bottom: 844 - S - 4 };
const tabBar: Box = { x: 16, y: 768, w: 358, h: 64 };
const button: Box = { x: 36, y: 300, w: 160, h: 50 };
const card: Box = { x: 16, y: 160, w: 358, h: 260 };

describe('keep-out zones', () => {
	it('never offers a spot over a control or the menu bar, gap included', () => {
		const spots = freeSpots(area, S, [tabBar, button], [card]);
		expect(spots.length).toBeGreaterThan(0);
		for (const s of spots) {
			const k = { x: s.x, y: s.y, w: S, h: S };
			expect(hits(k, tabBar, GAP)).toBe(false);
			expect(hits(k, button, GAP)).toBe(false);
		}
	});

	it('offers nothing when controls fill the screen', () => {
		const wall: Box = { x: 0, y: 0, w: 390, h: 844 };
		expect(freeSpots(area, S, [wall], [])).toEqual([]);
	});

	it('prefers a spot that covers less text', () => {
		const spots = freeSpots(area, S, [tabBar, button], [card]);
		const best = nearest(spots, { x: 200, y: 260 });
		expect(best).not.toBeNull();
		expect(best!.cover).toBe(0);
	});

	it('measures how much of Kuri lies over text', () => {
		expect(cover({ x: 16, y: 160 }, S, [card])).toBe(1);
		expect(cover({ x: 0, y: 500 }, S, [card])).toBe(0);
	});

	it('only walks where the straight path is free', () => {
		expect(pathClear({ x: 100, y: 180 }, { x: 100, y: 420 }, S, [button])).toBe(false);
		expect(pathClear({ x: 260, y: 180 }, { x: 260, y: 420 }, S, [button])).toBe(true);
		const spots = freeSpots(area, S, [tabBar, button], []);
		for (let i = 0; i < 20; i++) {
			const to = wanderTarget(spots, { x: 100, y: 180 }, S, [tabBar, button], Math.random);
			if (to) {
				expect(clear(to, S, [tabBar, button])).toBe(true);
				expect(pathClear({ x: 100, y: 180 }, to, S, [tabBar, button])).toBe(true);
			}
		}
	});

	it('with nothing free, finds where Kuri covers the least (Kuri never hides)', () => {
		const left: Box = { x: 0, y: 0, w: 300, h: 844 };
		const right: Box = { x: 310, y: 0, w: 80, h: 844 };
		const p = leastCovered(area, 68, [left, right], { x: 0, y: 0 });
		const k = { x: p.x, y: p.y, w: 68, h: 68 };
		expect(overlap(k, left) + overlap(k, right)).toBeLessThan(68 * 68 * 0.9);
		expect(overlap(k, left) + overlap(k, right)).toBe(68 * 58);
	});
});
