/**
 * "Make it Japanglish": guess how an English word becomes katakana, with the
 * rules that fired, so learners see *why* (bus → バス, bed → ベッド).
 *
 * English spelling doesn't reliably encode sound, so this is a teaching
 * guess; the UI shows the real dictionary loanword when one exists.
 */

export interface Rule {
	id: string;
	title: string;
	explain: string;
	example: string;
}

export const RULES: Rule[] = [
	{ id: 'vowel', title: 'Every consonant needs a vowel', explain: 'Japanese syllables end in a vowel, so a lone consonant gets an extra “u” (t/d get “o”).', example: 'test → te-su-to → テスト' },
	{ id: 'long', title: 'Long sounds become ー', explain: 'Stretched vowels (ee, oo, a_e, -er) are written with the long-vowel bar.', example: 'game → gē-mu → ゲーム' },
	{ id: 'er', title: '-er / -or / -ar → アー', explain: 'Unstressed endings become a long “a”.', example: 'computer → コンピューター' },
	{ id: 'small-tsu', title: 'Short vowel + hard stop → ッ', explain: 'A clipped ending (p, t, k, d, g after a short vowel) doubles the consonant with small ッ.', example: 'bed → be-d-do → ベッド' },
	{ id: 'l-r', title: 'L and R are the same', explain: 'Japanese has one sound between l and r, written with ラ行.', example: 'hotel → ho-te-ru → ホテル' },
	{ id: 'v-b', title: 'V becomes B', explain: 'Most loanwords use バ行 for v (ヴ exists but is rarer).', example: 'video → ビデオ' },
	{ id: 'th', title: 'TH becomes S or Z', explain: 'There is no “th”; it becomes サ行 (or ザ行).', example: 'thrill → スリル' },
	{ id: 'u-a', title: 'Short “u” sounds like ア', explain: 'The “uh” in bus or cup is written with ア-row kana.', example: 'bus → バス, cup → カップ' },
	{ id: 'silent-e', title: 'Final e changes the vowel', explain: 'a_e → エー, i_e → アイ, o_e → オー, u_e → ユー; the e itself is silent.', example: 'time → タイム, home → ホーム' },
	{ id: 'tion', title: '-tion → ション', explain: 'Common endings have fixed shapes: -tion → ション, -ture → チャー.', example: 'station → ステーション' },
	{ id: 'y-end', title: 'Final y → イー', explain: 'A y at the end of a word becomes a long “i”.', example: 'happy → ハッピー' },
	{ id: 'c', title: 'C is K or S', explain: 'c before e/i/y sounds like s; otherwise k. ck → ック.', example: 'city → シティー, cake → ケーキ' }
];

const ruleById = new Map(RULES.map((r) => [r.id, r]));

interface Step {
	rule: Rule;
	before: string;
	after: string;
}

/** Spelling → rough romaji, recording which rules fired. */
function toRomaji(word: string, steps: Step[]): string {
	let s = word.toLowerCase().replace(/[^a-z]/g, '');
	const apply = (id: string, re: RegExp, to: string) => {
		const next = s.replace(re, to);
		if (next !== s) {
			steps.push({ rule: ruleById.get(id)!, before: s, after: next });
			s = next;
		}
	};
	apply('tion', /ation$/, 'e:shon');
	apply('tion', /tion$/, 'shon');
	apply('tion', /sion$/, 'jon');
	apply('tion', /ture$/, 'cha:');
	apply('th', /th/g, 's');
	s = s.replace(/ph/g, 'f');
	apply('c', /ck/g, 'kk');
	apply('c', /c(?=[eiy])/g, 's');
	apply('c', /c/g, 'k');
	s = s.replace(/qu/g, 'kw').replace(/x/g, 'kus');
	apply('long', /ee|ea/g, 'i:');
	apply('long', /oo/g, 'u:');
	apply('er', /(er|or|ar)$/, 'a:');
	apply('silent-e', /a([^aeiou])e$/, 'e:$1');
	apply('silent-e', /i([^aeiou])e$/, 'ai$1');
	apply('silent-e', /o([^aeiou])e$/, 'o:$1');
	apply('silent-e', /u([^aeiou])e$/, 'yu:$1');
	apply('y-end', /([^aeiou])y$/, '$1i:');
	s = s.replace(/([^aeiou])y([^aeiou])/g, '$1i$2');
	apply('l-r', /l/g, 'r');
	apply('v-b', /v/g, 'b');
	apply('u-a', /(^|[^aeiouy])u(?=[^aeiou]{1,2}$)/, '$1a');
	apply('small-tsu', /(^|[^aeiou])([aeiou])([ptkdg])$/, '$1$2$3$3');
	return s;
}

const ROW: Record<string, string> = {
	'': 'アイウエオ', k: 'カキクケコ', g: 'ガギグゲゴ', s: 'サシスセソ', z: 'ザジズゼゾ', t: 'タティトゥテト',
	d: 'ダディドゥデド', n: 'ナニヌネノ', h: 'ハヒフヘホ', f: 'ファフィフフェフォ', b: 'バビブベボ', p: 'パピプペポ',
	m: 'マミムメモ', y: 'ヤイユイェヨ', r: 'ラリルレロ', w: 'ワウィウウェウォ', sh: 'シャシシュシェショ',
	ch: 'チャチチュチェチョ', j: 'ジャジジュジェジョ', ts: 'ツァツィツツェツォ'
};
// Rows whose kana are 2 chars for some vowels: split into 5 cells.
const CELLS: Record<string, string[]> = Object.fromEntries(
	Object.entries(ROW).map(([k, v]) => [k, v.match(/[ァ-ヴ][ァィゥェォャュョ]?/g)!])
);
const V = 'aiueo';

/** Rough romaji → katakana (doubles → ッ, repeated vowel → ー, n → ン). */
function romajiToKatakana(r: string, steps: Step[]): string {
	let out = '';
	let addedVowel = false;
	for (let i = 0; i < r.length; ) {
		const c = r[i];
		if (c === ':') {
			out += 'ー'; // long-vowel marker from the spelling rules
			i++;
			continue;
		}
		if (V.includes(c)) {
			const prev = out.at(-1);
			if (i > 0 && r[i - 1] === c && prev && prev !== 'ッ') out += 'ー';
			else out += CELLS[''][V.indexOf(c)];
			i++;
			continue;
		}
		if (c === 'n' && (i + 1 >= r.length || (!V.includes(r[i + 1]) && r[i + 1] !== 'y'))) {
			out += 'ン';
			i++;
			continue;
		}
		if (r[i + 1] === c) {
			out += 'ッ';
			i++;
			continue;
		}
		const two = r.slice(i, i + 2);
		const cons = CELLS[two] && ['sh', 'ch', 'ts'].includes(two) ? two : c;
		const cells = CELLS[cons];
		i += cons.length;
		if (!cells) continue; // unknown letter: skip
		const v = r[i];
		if (v && V.includes(v)) {
			out += cells[V.indexOf(v)];
			i++;
		} else {
			// lone consonant: add a vowel (t/d → o, ch/j/sh → i, else u)
			const vow = cons === 't' || cons === 'd' ? 'o' : ['ch', 'j', 'sh'].includes(cons) ? 'i' : 'u';
			out += cells[V.indexOf(vow)];
			addedVowel = true;
		}
	}
	if (addedVowel) steps.push({ rule: ruleById.get('vowel')!, before: r, after: out });
	return out;
}

export interface Conversion {
	input: string;
	guess: string;
	steps: Step[];
}

export function japanglish(english: string): Conversion {
	const steps: Step[] = [];
	const romaji = toRomaji(english, steps);
	const guess = romajiToKatakana(romaji, steps);
	if (/ー/.test(guess) && !steps.some((s) => s.rule.id === 'long' || s.rule.id === 'er' || s.rule.id === 'silent-e'))
		steps.push({ rule: ruleById.get('long')!, before: romaji, after: guess });
	// one entry per rule, in the order they fired
	const seen = new Set<string>();
	return { input: english, guess, steps: steps.filter((s) => !seen.has(s.rule.id) && seen.add(s.rule.id)) };
}
