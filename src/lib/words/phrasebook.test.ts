import { describe, expect, it } from 'vitest';
import type { UserCard } from '#lib/ai/contract.ts';
import { addSighting, filterCounts, inPhrasebook, rankPhrasebook, recentCount, SAME_SIGHTING_MS, viasOf } from './phrasebook.ts';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const card = (id: string, extra: Partial<UserCard> = {}): UserCard => ({
	id: `word:${id}`,
	kind: 'word',
	front: id,
	kanji: null,
	gloss: id,
	gloss2: null,
	usage: null,
	hook: null,
	example: null,
	verified: true,
	source: 'user',
	tags: [],
	createdAt: 0,
	updatedAt: 0,
	deleted: false,
	...extra
});

describe('addSighting', () => {
	it('counts each sighting and keeps the newest ten', () => {
		let s = addSighting(null, { at: 0, via: 'photo', ctx: '資料を  共有\nします' });
		expect(s).toEqual({ count: 1, recent: [{ at: 0, via: 'photo', ctx: '資料を 共有 します' }] });
		for (let i = 1; i <= 12; i++) s = addSighting(s, { at: i * DAY, via: 'lookup', ctx: null });
		expect(s.count).toBe(13);
		expect(s.recent).toHaveLength(10);
		expect(s.recent[0].at).toBe(12 * DAY);
	});

	it('ignores the same photo read twice in a row', () => {
		const a = addSighting(null, { at: 0, via: 'photo', ctx: 'x' });
		expect(addSighting(a, { at: SAME_SIGHTING_MS - 1, via: 'photo', ctx: 'x' })).toBe(a);
		expect(addSighting(a, { at: SAME_SIGHTING_MS - 1, via: 'photo', ctx: 'y' }).count).toBe(2);
		expect(addSighting(a, { at: SAME_SIGHTING_MS, via: 'photo', ctx: 'x' }).count).toBe(2);
	});
});

describe('ranking', () => {
	const seen = (...ats: [number, 'photo' | 'lookup' | 'writing'][]) => ({
		count: ats.length,
		recent: ats.map(([at, via]) => ({ at, via, ctx: null }))
	});
	const often = card('often', { seen: seen([NOW - DAY, 'photo'], [NOW - 2 * DAY, 'writing'], [NOW - 3 * DAY, 'photo']) });
	const old = card('old', { seen: { count: 40, recent: [{ at: NOW - 90 * DAY, via: 'lookup', ctx: null }] } });
	const fresh = card('fresh', { createdAt: NOW });
	const pack = card('pack', { source: 'pack' });
	const packSeen = card('packseen', { source: 'pack', seen: seen([NOW - DAY, 'writing']) });

	it('puts what came up this month first, then all-time, then newest; packs only once seen', () => {
		expect(rankPhrasebook([fresh, old, often, pack, packSeen], 'all', NOW).map((c) => c.front)).toEqual(['often', 'packseen', 'old', 'fresh']);
		expect(inPhrasebook(pack)).toBe(false);
		expect(inPhrasebook(card('gone', { deleted: true }))).toBe(false);
	});

	it('filters by where it came up and counts each filter', () => {
		expect(rankPhrasebook([often, old, packSeen], 'writing', NOW).map((c) => c.front)).toEqual(['often', 'packseen']);
		expect(filterCounts([often, old, fresh, pack, packSeen])).toEqual({ all: 4, photo: 1, lookup: 1, writing: 2, add: 0 });
		expect(recentCount(old.seen, NOW)).toBe(0);
		expect(viasOf(often)).toEqual(['photo', 'writing']);
	});
});
