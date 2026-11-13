export type Script = 'hiragana' | 'katakana';

export interface Kana {
	char: string;
	romaji: string;
	script: Script;
	row: string; // 'a', 'k', 's', … 'g', 'z', 'd', 'b', 'p'
}

// Gojūon grid: rows × vowel columns. '' = empty cell.
const ROWS: [row: string, hira: string, kata: string, romaji: string[]][] = [
	['a', 'あいうえお', 'アイウエオ', ['a', 'i', 'u', 'e', 'o']],
	['k', 'かきくけこ', 'カキクケコ', ['ka', 'ki', 'ku', 'ke', 'ko']],
	['s', 'さしすせそ', 'サシスセソ', ['sa', 'shi', 'su', 'se', 'so']],
	['t', 'たちつてと', 'タチツテト', ['ta', 'chi', 'tsu', 'te', 'to']],
	['n', 'なにぬねの', 'ナニヌネノ', ['na', 'ni', 'nu', 'ne', 'no']],
	['h', 'はひふへほ', 'ハヒフヘホ', ['ha', 'hi', 'fu', 'he', 'ho']],
	['m', 'まみむめも', 'マミムメモ', ['ma', 'mi', 'mu', 'me', 'mo']],
	['y', 'や　ゆ　よ', 'ヤ　ユ　ヨ', ['ya', '', 'yu', '', 'yo']],
	['r', 'らりるれろ', 'ラリルレロ', ['ra', 'ri', 'ru', 're', 'ro']],
	['w', 'わ　　　を', 'ワ　　　ヲ', ['wa', '', '', '', 'wo']],
	['nn', 'ん　　　　', 'ン　　　　', ['n', '', '', '', '']],
	['g', 'がぎぐげご', 'ガギグゲゴ', ['ga', 'gi', 'gu', 'ge', 'go']],
	['z', 'ざじずぜぞ', 'ザジズゼゾ', ['za', 'ji', 'zu', 'ze', 'zo']],
	['d', 'だぢづでど', 'ダヂヅデド', ['da', 'ji', 'zu', 'de', 'do']],
	['b', 'ばびぶべぼ', 'バビブベボ', ['ba', 'bi', 'bu', 'be', 'bo']],
	['p', 'ぱぴぷぺぽ', 'パピプペポ', ['pa', 'pi', 'pu', 'pe', 'po']]
];

export const KANA: Kana[] = [];
/** Grid for the chart: script → rows of 5 cells (null = empty). */
export const GRID: Record<Script, { row: string; cells: (Kana | null)[] }[]> = {
	hiragana: [],
	katakana: []
};

for (const [row, hira, kata, romaji] of ROWS) {
	for (const [script, chars] of [
		['hiragana', hira],
		['katakana', kata]
	] as const) {
		const cells = [...chars].map((ch, i) => {
			if (!romaji[i]) return null;
			const k: Kana = { char: ch, romaji: romaji[i], script, row };
			KANA.push(k);
			return k;
		});
		GRID[script].push({ row, cells });
	}
}

export const byChar = new Map(KANA.map((k) => [k.char, k]));

/** Alternative accepted romanisations when typing answers. */
export const ALT_ROMAJI: Record<string, string[]> = {
	shi: ['si'],
	chi: ['ti'],
	tsu: ['tu'],
	fu: ['hu'],
	ji: ['zi', 'di'],
	zu: ['du'],
	wo: ['o'],
	n: ['nn']
};

export function romajiMatches(kana: Kana, input: string): boolean {
	const v = input.trim().toLowerCase();
	return v === kana.romaji || (ALT_ROMAJI[kana.romaji] ?? []).includes(v);
}

export function speak(text: string) {
	if (typeof speechSynthesis === 'undefined') return;
	const u = new SpeechSynthesisUtterance(text);
	u.lang = 'ja-JP';
	u.rate = 0.8;
	const ja = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ja'));
	if (ja) u.voice = ja;
	speechSynthesis.cancel();
	speechSynthesis.speak(u);
}
