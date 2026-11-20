import { describe, expect, it } from 'vitest';
import { leftBelow, minLeft, showMore } from './scrollMore.ts';

describe('More below (scrollMore.ts)', () => {
	it('shows at the top of a long screen', () => {
		expect(showMore(0, 800, 3000)).toBe(true);
	});

	it('hides near the bottom and at the end', () => {
		expect(showMore(3000 - 800 - 150, 800, 3000)).toBe(false);
		expect(showMore(2200, 800, 3000)).toBe(false);
	});

	it('does not show on a screen that is only a little taller than the window', () => {
		expect(showMore(0, 800, 1000)).toBe(false);
		expect(showMore(0, 800, 800)).toBe(false);
	});

	it('needs at least 200px, or 40% of a tall screen, still below', () => {
		expect(minLeft(400)).toBe(200);
		expect(minLeft(1000)).toBe(400);
		expect(showMore(0, 1000, 1390)).toBe(false);
		expect(showMore(0, 1000, 1410)).toBe(true);
	});

	it('never reports less than nothing below (iOS rubber-band overscroll)', () => {
		expect(leftBelow(2400, 800, 3000)).toBe(0);
	});
});
