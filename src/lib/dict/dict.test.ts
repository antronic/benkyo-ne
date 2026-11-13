import { describe, expect, it } from 'vitest';
import { getGlosses, lookupEnglish, lookupJapanese, lookupRomaji, verifyItem, verifyText } from '#lib/dict/dict.ts';
import { META_RELEASE } from '#lib/dict/meta.data.ts';
import { loadCommonWords } from '@johnmorrisdotca/jisho/words';

describe('dictionary (real JMdict data)', { timeout: 30000 }, () => {
	it('meta.data.ts matches the installed package (rerun meta.build.mjs after upgrading)', async () => {
		expect(META_RELEASE).toBe((await loadCommonWords()).release);
	});

	it('looks up kana and kanji exactly', async () => {
		const [ike] = await lookupJapanese('いけ');
		expect(ike).toMatchObject({ id: 1421700, text: '池', reading: 'いけ', gloss: 'pond', common: true, kind: 'word' });
		expect(ike.written).toContain('池');
		expect((await lookupJapanese('池'))[0].reading).toBe('いけ');
	});

	it('reduces conjugated forms to the dictionary form', async () => {
		const hits = await lookupJapanese('食べなかった');
		expect(hits[0]).toMatchObject({ text: '食べる', reading: 'たべる', inflection: 'negative, past' });
	});

	it('romaji → kana → lookup', async () => {
		expect((await lookupRomaji('ike'))[0]).toMatchObject({ text: '池', reading: 'いけ' });
		expect((await lookupRomaji('taberu'))[0].text).toBe('食べる');
	});

	it('English → words, commonest first', async () => {
		const hits = await lookupEnglish('pond', 5);
		expect(hits[0].text).toBe('池');
		const ranks = hits.map((h) => h.rank ?? 100000);
		expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
	});

	it('glosses: English only', async () => {
		expect(await getGlosses(1421700, 'en')).toContain('pond');
		expect(await getGlosses(1421700, 'de')).toBeNull();
	});

	it('verifies AI example sentences', async () => {
		const ok = await verifyText('池があります。');
		expect(ok.ok).toBe(true);
		expect(ok.available).toBe(true);
		expect(ok.tokens.map((t) => t.surface)).toEqual(['池', 'が', 'あります', '。']);
		expect(ok.tokens[0]).toMatchObject({ known: true, wordId: 1421700, reading: 'いけ' });
		expect(ok.tokens[2]).toMatchObject({ base: 'ある', inflection: 'polite' });

		expect((await verifyText('いけがあります', 'いけがあります')).ok).toBe(true);
		expect((await verifyText('池があります', 'いけがあります')).readingMatches).toBe(true);
		expect((await verifyText('本がある', 'ほんがある')).readingMatches).toBe(true); // alternative reading
		expect((await verifyText('池があります', 'うみがあります')).ok).toBe(false);

		const bad = await verifyText('ぬぽぬぽがあります');
		expect(bad.ok).toBe(false);
		expect(bad.unknown.length).toBeGreaterThan(0);
	});

	it('verifies items, words and phrases', async () => {
		expect(await verifyItem({ text: '池', reading: 'いけ' })).toMatchObject({ verified: true, kind: 'word', hit: { id: 1421700 } });
		expect((await verifyItem({ text: '池', reading: 'うみ' })).verified).toBe(false);
		const itadakimasu = await verifyItem({ text: 'いただきます', reading: 'いただきます' });
		expect(itadakimasu).toMatchObject({ verified: true, kind: 'phrase', hit: { id: 1410800 } });
		expect((await verifyItem({ text: 'お願いします', reading: 'おねがいします' })).kind).toBe('phrase');
		const multi = await verifyItem({ text: 'ラーメンをください', reading: 'らーめんをください' });
		expect(multi).toMatchObject({ verified: true, kind: 'phrase', hit: null });
		expect((await verifyItem({ text: 'ぬぽぬぽ', reading: 'ぬぽぬぽ' })).verified).toBe(false);
	});
});
