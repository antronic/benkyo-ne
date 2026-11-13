/**
 * Kana → romaji (modified Hepburn), for the small romaji line shown under
 * Japanese text. Non-kana characters (kanji, punctuation, Latin) pass through.
 *
 *   きゃ → kya, っか → kka, っち → tchi, ん+vowel/y → n' , おう → ou, ラーメン → rāmen
 */
const BASE: Record<string, string> = {
	あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
	か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
	さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
	た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
	な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
	は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
	ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
	や: 'ya', ゆ: 'yu', よ: 'yo',
	ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
	わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n',
	が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
	ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
	だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
	ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
	ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
	ゔ: 'vu',
	ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa'
};

// Small-kana combinations (yōon and katakana extensions, written in hiragana here).
const COMBO: Record<string, string> = {
	きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
	しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she', じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
	ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
	にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
	びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
	みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
	ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
	うぃ: 'wi', うぇ: 'we', うぉ: 'wo', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
	つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso', いぇ: 'ye'
};

const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Katakana → hiragana (other characters unchanged). */
const hira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function toRomaji(text: string): string {
	const s = hira(text.normalize('NFC'));
	let out = '';
	let geminate = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		const pair = s.slice(i, i + 2);
		let r: string | undefined = COMBO[pair];
		if (r) i++;
		else r = BASE[c];

		if (c === 'っ') {
			geminate = true;
			continue;
		}
		if (c === 'ー') {
			const last = out.at(-1);
			if (last && MACRON[last]) out = out.slice(0, -1) + MACRON[last];
			continue;
		}
		if (r === undefined) {
			// not kana: pass through (kanji, punctuation, spaces, Latin)
			if (geminate) geminate = false;
			out += c === '　' ? ' ' : c === '。' ? '.' : c === '、' ? ',' : c;
			continue;
		}
		if (geminate) {
			out += r.startsWith('ch') ? 't' : r[0];
			geminate = false;
		}
		// ん before a vowel or y is written n' to keep syllables apart (kin'en vs kinen)
		if (out.endsWith('n') && s[i - (r.length > 0 && COMBO[pair] ? 2 : 1)] === 'ん' && /^[aiueoy]/.test(r)) out += "'";
		out += r;
	}
	return out;
}
