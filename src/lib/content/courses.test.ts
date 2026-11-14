import { describe, expect, it } from 'vitest';
import { COURSES } from './courses.ts';
import { verifyItem } from '#lib/dict/dict.ts';

describe('course content', () => {
	it('every item exists in the dictionary with that reading', async () => {
		const bad: string[] = [];
		for (const c of COURSES)
			for (const u of c.units)
				for (const i of u.items) {
					const v = await verifyItem({ text: i.kanji ?? i.reading, reading: i.reading });
					const v2 = v.verified ? v : await verifyItem({ text: i.reading, reading: i.reading });
					if (!v2.verified) bad.push(`${c.id}/${u.id}: ${i.kanji ?? ''} ${i.reading}`);
				}
		expect(bad).toEqual([]);
	}, 60_000);
	it('units have unique ids and ~6 items', () => {
		for (const c of COURSES) {
			expect(new Set(c.units.map((u) => u.id)).size).toBe(c.units.length);
			for (const u of c.units) expect(u.items.length).toBeGreaterThanOrEqual(5);
		}
	});
});
