import { confusablesOf } from '#lib/content/confusables.ts';
import { byChar, KANA, type Kana } from '#lib/content/kana.ts';

export function shuffle<T>(a: T[]): T[] {
	const r = [...a];
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

/**
 * Multiple-choice options for a kana. Distractors come from look-alikes
 * first (interleaving + discrimination), then from `pool`, then anywhere.
 */
export function choicesFor(k: Kana, pool: Kana[] = [], n = 4): Kana[] {
	const out = new Map<string, Kana>([[k.char, k]]);
	const add = (c: Kana | undefined) => {
		if (c && out.size < n && c.romaji !== k.romaji) out.set(c.char, c);
	};
	shuffle(confusablesOf(k.char))
		.map((c) => byChar.get(c))
		.filter((c) => c?.script === k.script)
		.forEach(add);
	shuffle(pool.filter((p) => p.script === k.script)).forEach(add);
	shuffle(KANA.filter((p) => p.script === k.script && !p.row.match(/[gzdbp]/))).forEach(add);
	return shuffle([...out.values()]);
}
