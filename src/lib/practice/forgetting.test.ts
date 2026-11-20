import { describe, expect, it } from 'vitest';
import { forgottenKanji, kanjiIn, keepRecent, WEEK_MS } from './forgetting.ts';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const text: Record<string, string> = { 'word:kaigi': '会議', 'word:kakunin': '確認' };
const textOf = (id: string) => text[id] ?? null;

describe('kanji you keep forgetting', () => {
	it('counts misreads from Again in the log, for kanji cards and words with kanji', () => {
		const r = forgottenKanji(
			[
				{ cardId: 'kanji:木', grade: 1, reviewedAt: NOW - DAY },
				{ cardId: 'word:kaigi', grade: 1, reviewedAt: NOW - 2 * DAY },
				{ cardId: 'word:kaigi', grade: 1, reviewedAt: NOW - 3 * DAY },
				{ cardId: 'word:kakunin', grade: 3, reviewedAt: NOW - DAY }, // right: not a slip
				{ cardId: 'kana:あ', grade: 1, reviewedAt: NOW - DAY }, // no kanji
				{ cardId: 'kanji:山', grade: 1, reviewedAt: NOW - WEEK_MS - 1 } // last week
			],
			[],
			textOf,
			NOW
		);
		expect(r.map((k) => [k.char, k.misread])).toEqual([
			['会', 2],
			['議', 2],
			['木', 1]
		]);
	});

	it('counts a kanji drawn wrong once, as a write slip', () => {
		const r = forgottenKanji([{ cardId: 'kanji:木', grade: 1, reviewedAt: NOW - DAY + 800 }], [{ char: '木', at: NOW - DAY }], textOf, NOW);
		expect(r).toEqual([{ char: '木', misread: 0, unwritten: 1, lastAt: NOW - DAY }]);
	});

	it('keeps the set short', () => {
		const logs = Array.from({ length: 20 }, (_, i) => ({ cardId: `kanji:${String.fromCharCode(0x4e00 + i)}`, grade: 1 as const, reviewedAt: NOW - i * 1000 }));
		expect(forgottenKanji(logs, [], textOf, NOW)).toHaveLength(12);
	});

	it('finds kanji in text and trims old slips', () => {
		expect(kanjiIn('お疲れ様です、確認々')).toEqual(['疲', '様', '確', '認']);
		expect(keepRecent([{ char: '木', at: NOW - 61 * DAY }, { char: '山', at: NOW - DAY }], NOW)).toEqual([{ char: '山', at: NOW - DAY }]);
	});
});
