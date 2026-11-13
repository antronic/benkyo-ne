// Simulates the embedded deploy / offline before first use: every per-piece dictionary chunk
// fails to load, only the (precached) common-words table works.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@johnmorrisdotca/jisho/words', async (importOriginal) => {
	const real = await importOriginal<typeof import('@johnmorrisdotca/jisho/words')>();
	const fail = () => Promise.reject(new real.WordsLoadError('readings', 3, 316, new TypeError('Failed to fetch')));
	return { ...real, loadWords: fail, findInflected: fail, readText: fail, findByMeaning: fail };
});
vi.mock('@johnmorrisdotca/jisho/entries', () => ({
	loadEntry: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
}));

const { lookupJapanese, lookupJapaneseResult, lookupEnglish, verifyItem, verifyText, getGlosses } = await import('#lib/dict/dict.ts');
const { pickPackWords } = await import('#lib/dict/packs.ts');

describe('dictionary with only the common words', { timeout: 30000 }, () => {
	it('lookups fall back to the common words', async () => {
		expect((await lookupJapanese('いけ'))[0]).toMatchObject({ text: '池', id: 1421700 });
		expect((await lookupJapanese('食べなかった'))[0]).toMatchObject({ text: '食べる', inflection: 'negative, past' });
		expect((await lookupJapaneseResult('いけ')).available).toBe(false);
		expect((await lookupEnglish('pond'))[0].text).toBe('池');
		expect(await getGlosses(1421700, 'en')).toContain('pond');
	});

	it('verifies common words, reports rare ones as unavailable (not wrong)', async () => {
		expect(await verifyItem({ text: '池', reading: 'いけ' })).toMatchObject({ verified: true, available: true });
		expect(await verifyItem({ text: 'いただきます', reading: 'いただきます' })).toMatchObject({ verified: true, kind: 'phrase' });
		const rare = await verifyItem({ text: '蹲踞', reading: 'そんきょ' });
		expect(rare).toMatchObject({ verified: false, available: false });
	});

	it('verifyText segments with the common words', async () => {
		const r = await verifyText('池があります。', 'いけがあります');
		expect(r.ok).toBe(true);
		expect(r.tokens.map((t) => t.surface)).toEqual(['池', 'が', 'あります', '。']);
		expect(r.tokens[2]).toMatchObject({ base: 'ある', reading: 'あります' });
		const kana = await verifyText('あかいいけ');
		expect(kana.ok).toBe(true);
		const rare = await verifyText('蹲踞をする');
		expect(rare).toMatchObject({ ok: false, available: false });
	});

	it('packs still work', async () => {
		expect((await pickPackWords({ knownKana: [...'あいうえおかきくけこ'], excludeIds: [] })).length).toBe(6);
	});
});
