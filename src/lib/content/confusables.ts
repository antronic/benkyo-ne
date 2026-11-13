/**
 * Look-alike groups. Used as distractors in multiple-choice questions, so
 * learners have to tell similar shapes apart rather than guess from shape alone.
 */
export const CONFUSABLE_GROUPS: string[][] = [
	['さ', 'ち', 'き'],
	['ぬ', 'め', 'あ', 'お'],
	['ね', 'れ', 'わ'],
	['る', 'ろ'],
	['は', 'ほ', 'け'],
	['い', 'り', 'こ'],
	['う', 'ら', 'つ'],
	['ま', 'も', 'よ'],
	['シ', 'ツ'],
	['ソ', 'ン', 'リ'],
	['ク', 'ケ', 'タ', 'ワ'],
	['コ', 'ユ', 'ロ'],
	['ノ', 'メ', 'ヌ'],
	['チ', 'テ', 'ナ'],
	['ウ', 'ワ', 'フ', 'ラ'],
	['カ', 'か'],
	['ヘ', 'へ'],
	['リ', 'り'],
	['ヤ', 'や'],
	['セ', 'せ'],
	['キ', 'き'],
	['モ', 'も']
];

const index = new Map<string, Set<string>>();
for (const g of CONFUSABLE_GROUPS) {
	for (const c of g) {
		const s = index.get(c) ?? new Set();
		g.forEach((o) => o !== c && s.add(o));
		index.set(c, s);
	}
}

export function confusablesOf(char: string): string[] {
	return [...(index.get(char) ?? [])];
}
