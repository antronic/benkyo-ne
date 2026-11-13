import { describe, expect, it } from 'vitest';
import { toRomaji } from './romaji.ts';

describe('toRomaji', () => {
	it.each([
		['あいうえお', 'aiueo'],
		['しちつふ', 'shichitsufu'],
		['きょう', 'kyou'],
		['がっこう', 'gakkou'],
		['まっちゃ', 'matcha'],
		['きんえん', "kin'en"],
		['こんにちは', 'konnichiha'],
		['ほんや', "hon'ya"],
		['ラーメン', 'rāmen'],
		['コーヒー', 'kōhī'],
		['いただきます。', 'itadakimasu.'],
		['ジャパン', 'japan'],
		['池', '池'],
		['いけ 池', 'ike 池']
	])('%s → %s', (kana, romaji) => {
		expect(toRomaji(kana)).toBe(romaji);
	});
});
