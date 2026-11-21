import { describe, expect, it } from 'vitest';
import { barSlots, cleanPins, DEFAULT_PINS, grouped, isImmersive, itemFor, NAV_ITEMS, returnTarget, splitBar } from './nav.ts';

const hrefs = (xs: { href: string }[]) => xs.map((x) => x.href);

describe('main navigation', () => {
	it('five places, the same on every bar: no More tab', () => {
		expect(hrefs(NAV_ITEMS)).toEqual(['/', '/learn', '/review', '/words', '/settings']);
		for (const w of [390, 690]) expect(splitBar(barSlots(w), undefined).more).toEqual([]);
	});

	// a longer list (pins and More stay for it)
	const LONG = ['/', '/a', '/b', '/c', '/d', '/e', '/f'].map((href) => ({ ...NAV_ITEMS[0], href }));

	it('a phone bar holds four tabs and More; the rest are in More', () => {
		const { tabs, more } = splitBar(5, undefined, LONG);
		expect(hrefs(tabs)).toEqual(['/', '/a', '/b', '/c']);
		expect(hrefs(more)).toEqual(['/d', '/e', '/f']);
	});

	it('every screen is either a tab or in More, once', () => {
		for (const slots of [5, 7]) {
			const { tabs, more } = splitBar(slots, ['/f', '/d'], LONG);
			expect([...hrefs(tabs), ...hrefs(more)].sort()).toEqual(hrefs(LONG).sort());
		}
	});

	it('pinned tabs come first and keep the list order', () => {
		const { tabs } = splitBar(5, ['/f', '/d'], LONG);
		expect(hrefs(tabs)).toEqual(['/', '/a', '/d', '/f']);
	});

	it('drops unknown and repeated pins', () => {
		expect(cleanPins(['/x', '/words', '/words', '/'])).toEqual(['/words', '/']);
		expect(cleanPins(undefined)).toEqual(DEFAULT_PINS);
	});

	it('a screen below a tab belongs to it; Kana is in Learn, Ask AI and Community in Words', () => {
		expect(itemFor('/learn/kanji/1')?.href).toBe('/learn');
		expect(itemFor('/kana')?.href).toBe('/learn');
		expect(itemFor('/ai')?.href).toBe('/words');
		expect(itemFor('/community')?.href).toBe('/words');
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
