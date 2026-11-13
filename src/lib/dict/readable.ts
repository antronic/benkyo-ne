/**
 * Can the learner read this kana string? Synchronous and dependency-free (imported by a
 * runes store). `knownKana` is the set of kana chars whose `kana:<char>` card has been
 * learned (hiragana and katakana are separate: knowing か says nothing about カ).
 *
 * Rules, per character:
 * - Plain kana (あ, カ…): the kana itself must be known.
 * - Voiced kana (が, ゾ, ぱ…): known if the kana itself is known, OR its unvoiced base
 *   (か, ソ, は…) is known AND the learner has started that voiced row in that script
 *   (any of がぎぐげご known for が). ヴ needs ウ plus any katakana dakuten kana.
 * - Small ゃゅょ / ャュョ, ゎ, small ぁぃぅぇぉ / ァィゥェォ, ゕゖ: readable if the full-size
 *   kana is known (ゃ needs や), plus the kana before it must itself be readable.
 * - Small っ / ッ (doubled consonant): needs つ / ツ known (the T-row lesson).
 * - Long-vowel mark ー: readable once any katakana is known.
 * - Iteration marks ゝゞヽヾ: readable if the character before them is.
 * - Spaces, punctuation (。、！？「」…・), Latin letters and digits are ignored.
 * - Anything else (kanji, other scripts) is unreadable.
 */

const VOICED_ROWS = ['がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ'];
const SMALL: Record<string, string> = {
	ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', ゕ: 'か', ゖ: 'け'
};
const ITERATION = new Set(['ゝ', 'ゞ', 'ヽ', 'ヾ']);

const toKata = (c: string) => String.fromCharCode(c.charCodeAt(0) + 0x60);
const isHira = (c: string) => c >= 'ぁ' && c <= 'ゖ';
const isKata = (c: string) => c >= 'ァ' && c <= 'ヺ';

/** voiced kana → { base, row } for both scripts */
const VOICED = new Map<string, { base: string; row: string }>();
for (const row of VOICED_ROWS)
	for (const c of row) {
		const base = c.normalize('NFD')[0];
		VOICED.set(c, { base, row });
		VOICED.set(toKata(c), { base: toKata(base), row: [...row].map(toKata).join('') });
	}
VOICED.set('ヴ', { base: 'ウ', row: VOICED_ROWS.join('').split('').map(toKata).join('') });
VOICED.set('ゔ', { base: 'う', row: VOICED_ROWS.join('') });
for (const [small, big] of Object.entries(SMALL)) SMALL[toKata(small)] = toKata(big);

/** Characters that never affect readability. */
function ignorable(c: string): boolean {
	if (/\s/u.test(c)) return true;
	if (/[\p{P}\p{S}\p{N}A-Za-z！-～]/u.test(c)) return c !== 'ー';
	return false;
}

function asSet(knownKana: Iterable<string>): Set<string> {
	return knownKana instanceof Set ? (knownKana as Set<string>) : new Set(knownKana);
}

function readableChar(c: string, prev: boolean | null, known: Set<string>, anyKata: boolean): boolean {
	if (c === 'ー') return anyKata;
	if (c === 'っ') return known.has('つ');
	if (c === 'ッ') return known.has('ツ');
	if (ITERATION.has(c)) return prev === true;
	if (SMALL[c]) return known.has(SMALL[c]) && prev !== false;
	if (known.has(c)) return true;
	const v = VOICED.get(c);
	if (v) return known.has(v.base) && [...v.row].some((r) => known.has(r));
	return false;
}

/** The characters of `reading` the learner can't read yet, once each, in order. */
export function unknownKanaIn(reading: string, knownKana: Iterable<string>): string[] {
	const known = asSet(knownKana);
	let anyKata = false;
	for (const k of known) if (isKata(k)) { anyKata = true; break; }
	const out: string[] = [];
	let prev: boolean | null = null;
	for (const c of reading.normalize('NFC')) {
		if (ignorable(c)) continue;
		const ok = readableChar(c, prev, known, anyKata);
		if (!ok && !out.includes(c)) out.push(c);
		prev = ok;
	}
	return out;
}

/** True if every character of `reading` is readable under the rules above. Empty text is not readable. */
export function isReadable(reading: string, knownKana: Iterable<string>): boolean {
	const text = reading.normalize('NFC');
	if (![...text].some((c) => !ignorable(c))) return false;
	return unknownKanaIn(text, knownKana).length === 0;
}

/** True if `text` is all kana (hiragana, katakana, ー, iteration marks), ignoring punctuation. */
export function isKanaText(text: string): boolean {
	const chars = [...text].filter((c) => !ignorable(c));
	return chars.length > 0 && chars.every((c) => isHira(c) || isKata(c) || c === 'ー' || ITERATION.has(c));
}
