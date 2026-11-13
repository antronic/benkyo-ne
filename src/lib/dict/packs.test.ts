import { describe, expect, it } from 'vitest';
import { pickPackWords, toFillItems } from '#lib/dict/packs.ts';
import { isReadable } from '#lib/dict/readable.ts';

const A_K = [...'あいうえおかきくけこ'];

describe('pickPackWords (real JMdict common words)', { timeout: 30000 }, () => {
	it('picks real common words written only with known kana', async () => {
		const picks = await pickPackWords({ knownKana: A_K, excludeIds: [], count: 80 });
		expect(picks.length).toBe(80);
		const readings = picks.map((p) => p.reading);
		for (const r of ['あか', 'いけ', 'ここ', 'かお']) expect(readings).toContain(r);
		for (const p of picks) {
			expect(isReadable(p.reading, A_K)).toBe(true);
			expect(p.key).toBe(`${p.kind}:${p.id}`);
			expect(p.gloss).not.toBe('');
		}
		expect(new Set(readings).size).toBe(readings.length); // one word per reading
		expect(picks.find((p) => p.reading === 'いけ')).toMatchObject({ text: '池', written: ['池'], gloss: 'pond' });
		expect(picks.find((p) => p.reading === 'ここ')?.gloss).toMatch(/here/); // not 九 "nine" (a secondary reading)
		expect(readings.some((r) => r.length === 1)).toBe(false);
	});

	it('default count 6, excludes ids, deterministic per seed', async () => {
		const six = await pickPackWords({ knownKana: A_K, excludeIds: [] });
		expect(six.length).toBe(6);
		const next = await pickPackWords({ knownKana: A_K, excludeIds: six.map((p) => p.id) });
		expect(next.some((p) => six.some((q) => q.id === p.id))).toBe(false);
		const a = await pickPackWords({ knownKana: A_K, excludeIds: [], seed: 42 });
		const b = await pickPackWords({ knownKana: A_K, excludeIds: [], seed: 42 });
		const c = await pickPackWords({ knownKana: A_K, excludeIds: [], seed: 7 });
		expect(a).toEqual(b);
		expect(a.map((p) => p.id)).not.toEqual(c.map((p) => p.id));
	});

	it('skips particles and grammar words', async () => {
		const known = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがでだ'];
		const picks = await pickPackWords({ knownKana: known, excludeIds: [], count: 300 });
		const r = new Set(picks.map((p) => p.reading));
		for (const g of ['から', 'まで', 'けど', 'ので', 'のに', 'など', 'です']) expect(r.has(g)).toBe(false);
		expect(toFillItems(picks.slice(0, 1))[0]).toEqual({
			key: picks[0].key,
			text: picks[0].text,
			reading: picks[0].reading,
			kind: picks[0].kind,
			gloss: picks[0].gloss
		});
	});

	it('nothing known → nothing picked', async () => {
		expect(await pickPackWords({ knownKana: [], excludeIds: [] })).toEqual([]);
	});
});
