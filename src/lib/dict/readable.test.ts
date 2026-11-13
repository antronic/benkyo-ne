import { describe, expect, it } from 'vitest';
import { isKanaText, isReadable, unknownKanaIn } from '#lib/dict/readable.ts';

const A_K = [...'あいうえおかきくけこ'];

describe('isReadable', () => {
	it('plain kana', () => {
		expect(isReadable('あか', A_K)).toBe(true);
		expect(isReadable('いけ', A_K)).toBe(true);
		expect(isReadable('さけ', A_K)).toBe(false);
		expect(isReadable('', A_K)).toBe(false);
		expect(isReadable('アカ', A_K)).toBe(false); // katakana is separate
	});
	it('punctuation and spaces are ignored', () => {
		expect(isReadable('あか、いけ。', A_K)).toBe(true);
		expect(isReadable(' 「ここ」！ ', A_K)).toBe(true);
		expect(isReadable('。', A_K)).toBe(false);
	});
	it('small っ needs つ', () => {
		expect(isReadable('かっこ', A_K)).toBe(false);
		expect(isReadable('かっこ', [...A_K, 'つ'])).toBe(true);
		expect(isReadable('カッコ', [...'カコ'])).toBe(false);
		expect(isReadable('カッコ', [...'カコツ'])).toBe(true);
	});
	it('small ゃゅょ need the full-size kana', () => {
		expect(isReadable('きょう', A_K)).toBe(false);
		expect(isReadable('きょう', [...A_K, 'よ'])).toBe(true);
		expect(unknownKanaIn('きゃく', A_K)).toEqual(['ゃ']);
		expect(isReadable('ファ', [...'フア'])).toBe(true);
	});
	it('ー is readable once any katakana is known', () => {
		expect(isReadable('ケーキ', [...'ケキ'])).toBe(true);
		expect(isReadable('かー', A_K)).toBe(false);
		expect(isReadable('かー', [...A_K, 'ア'])).toBe(true);
	});
	it('dakuten: the kana itself, or its base plus a started voiced row', () => {
		expect(isReadable('かぎ', A_K)).toBe(false); // G-row not started
		expect(isReadable('かぎ', [...A_K, 'ぎ'])).toBe(true);
		expect(isReadable('かぐ', [...A_K, 'が'])).toBe(true); // く known + G-row started
		expect(isReadable('ざ', [...A_K, 'が'])).toBe(false); // さ unknown, Z-row not started
		expect(isReadable('ぱ', [...'はば'])).toBe(false); // B-row ≠ P-row
		expect(isReadable('ぱ', [...'はぴ'])).toBe(true);
		expect(isReadable('ゴ', [...'コが'])).toBe(false); // hiragana が doesn't start the katakana row
		expect(isReadable('ヴ', [...'ウガ'])).toBe(true);
	});
	it('kanji are unreadable and reported', () => {
		expect(isReadable('池', A_K)).toBe(false);
		expect(unknownKanaIn('池があります', A_K)).toEqual(['池', 'が', 'り', 'ま', 'す']);
	});
	it('isKanaText', () => {
		expect(isKanaText('コーヒー')).toBe(true);
		expect(isKanaText('食べる')).toBe(false);
	});
});
