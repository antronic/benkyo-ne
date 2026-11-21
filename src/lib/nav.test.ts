import { describe, expect, it } from 'vitest';
import { barSlots, cleanPins, DEFAULT_PINS, grouped, isImmersive, itemFor, NAV_ITEMS, returnTarget, splitBar } from './nav.ts';

const hrefs = (xs: { href: string }[]) => xs.map((x) => x.href);

describe('main navigation', () => {
	it('a phone bar holds four tabs and More; the rest are in More', () => {
		const { tabs, more } = splitBar(barSlots(390), undefined);
		expect(hrefs(tabs)).toEqual(['/', '/learn', '/review', '/words']);
		expect(hrefs(more)).toEqual(['/kana', '/ai', '/community', '/settings']);
	});

	it('a 600 px bar holds six tabs and More', () => {
		const { tabs, more } = splitBar(barSlots(690), DEFAULT_PINS);
		expect(tabs).toHaveLength(6);
		expect(hrefs(more)).toEqual(['/kana', '/settings']);
	});

	it('every screen is either a tab or in More, once', () => {
		for (const slots of [5, 7]) {
			const { tabs, more } = splitBar(slots, ['/settings', '/kana']);
			expect([...hrefs(tabs), ...hrefs(more)].sort()).toEqual(hrefs(NAV_ITEMS).sort());
		}
	});

	it('pinned tabs come first and keep the list order', () => {
		const { tabs } = splitBar(5, ['/settings', '/kana']);
		expect(hrefs(tabs)).toEqual(['/', '/learn', '/kana', '/settings']);
	});

	it('no More when everything fits', () => {
		expect(splitBar(NAV_ITEMS.length, undefined).more).toEqual([]);
	});

	it('drops unknown and repeated pins', () => {
		expect(cleanPins(['/x', '/ai', '/ai', '/'])).toEqual(['/ai', '/']);
	});

	it('a screen below a tab belongs to it, other screens to none', () => {
		expect(itemFor('/learn/kanji/1')?.href).toBe('/learn');
		expect(itemFor('/')?.href).toBe('/');
		expect(itemFor('/week')).toBeNull();
		expect(itemFor('/kanaX')).toBeNull();
	});

	it('groups keep Settings last', () => {
		const g = grouped();
		expect(g.at(-1)?.group).toBe('you');
		expect(g.flatMap((x) => hrefs(x.items)).sort()).toEqual(hrefs(NAV_ITEMS).sort());
	});
});

describe('going back from a full-screen step', () => {
	it('a lesson opened from Today goes back to Today, from Learn back to Learn', () => {
		expect(returnTarget(null, '/', '/learn/h1')).toBe('/');
		expect(returnTarget(null, '/learn', '/learn/h1')).toBe('/learn');
	});

	it('the next lesson keeps the screen the first one was opened from', () => {
		const saved = returnTarget(null, '/', '/learn/h1');
		expect(returnTarget(saved, '/learn/h1', '/learn/h2')).toBe('/');
	});

	it('keeps the query of the screen it came from', () => {
		expect(returnTarget(null, '/words?tab=phrasebook', '/words/pack/p1')).toBe('/words?tab=phrasebook');
	});

	it('a normal screen, a reload or Fleet has nothing to go back to', () => {
		expect(returnTarget('/', '/learn/h1', '/learn')).toBeNull();
		expect(returnTarget(null, null, '/review')).toBeNull();
		expect(returnTarget('/', '/', '/admin/accounts')).toBeNull();
	});

	it('knows which screens are full-screen steps', () => {
		expect(isImmersive('/review?practice=x')).toBe(true);
		expect(isImmersive('/learn')).toBe(false);
		expect(isImmersive('/learn/h1')).toBe(true);
		expect(isImmersive('/words')).toBe(false);
		expect(isImmersive('/')).toBe(false);
	});
});
