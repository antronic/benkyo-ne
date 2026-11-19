/**
 * Test out of one level unit: three questions drawn from the unit, the same
 * rule as the kana placement check (placement.ts) on a single lesson.
 *
 *   1. kanji   a unit word written in kanji → pick its reading
 *   2. word    a unit word → pick its meaning
 *   3. grammar an example sentence of one of the unit's grammar points → pick its meaning
 *
 * All three right passes the unit: it is marked done and its words go into the
 * learner's cards, scheduled as known (Good), like the lessons placement skips.
 * One wrong answer opens the unit as usual. Wrong choices come from the same
 * unit first, then from the other units of the level.
 */
import type { EnTh, LevelUnit } from '#lib/content/levels/types.ts';

export type TestKind = 'kanji' | 'word' | 'grammar';

export interface TestQuestion {
	kind: TestKind;
	/** Japanese shown as the question */
	prompt: string;
	/** choices: kana readings for 'kanji', meanings for the others */
	choices: EnTh[];
	answer: number;
}

export const TEST_OUT_SIZE = 3;

function shuffle<T>(a: T[], rand: () => number): T[] {
	const r = [...a];
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

const one = <T>(a: T[], rand: () => number): T | undefined => a[Math.floor(rand() * a.length)];

/** The right choice plus up to three distinct wrong ones, shuffled. */
function withChoices(kind: TestKind, prompt: string, right: EnTh, wrong: EnTh[], rand: () => number): TestQuestion {
	const seen = new Set([right.en]);
	const others: EnTh[] = [];
	for (const w of wrong) {
		if (others.length >= 3) break;
		if (seen.has(w.en)) continue;
		seen.add(w.en);
		others.push(w);
	}
	const choices = shuffle([right, ...others], rand);
	return { kind, prompt, choices, answer: choices.indexOf(right) };
}

export function buildTestOut(unit: LevelUnit, level: LevelUnit[], rand = Math.random): TestQuestion[] {
	const rest = level.filter((u) => u.id !== unit.id);
	const qs: TestQuestion[] = [];

	const kanjiWords = unit.words.filter((w) => w.kanji && unit.kanji.some((k) => w.kanji!.includes(k)));
	const kw = one(kanjiWords.length ? kanjiWords : unit.words.filter((w) => w.kanji), rand);
	if (kw) {
		const asReading = (r: string): EnTh => ({ en: r, th: r });
		const wrong = shuffle([...unit.words, ...rest.flatMap((u) => u.words)], rand).map((w) => asReading(w.reading));
		qs.push(withChoices('kanji', kw.kanji!, asReading(kw.reading), wrong, rand));
	}

	const ww = one(unit.words.filter((w) => w !== kw), rand) ?? kw;
	if (ww) {
		const wrong = [...shuffle(unit.words, rand), ...shuffle(rest.flatMap((u) => u.words), rand)].filter((w) => w !== ww).map((w) => w.gloss);
		qs.push(withChoices('word', ww.kanji ?? ww.reading, ww.gloss, wrong, rand));
	}

	const g = one(unit.grammar, rand);
	const ex = g && one(g.examples, rand);
	if (ex) {
		const all = (us: LevelUnit[]) => us.flatMap((u) => u.grammar.flatMap((p) => p.examples));
		const wrong = [...shuffle(all([unit]), rand), ...shuffle(all(rest), rand)].filter((e) => e !== ex).map((e) => ({ en: e.en, th: e.th }));
		qs.push(withChoices('grammar', ex.ja, { en: ex.en, th: ex.th }, wrong, rand));
	}
	return qs;
}

/** Passed only when every question was answered right. */
export const testOutPassed = (qs: TestQuestion[], picked: (number | null)[]) =>
	qs.length > 0 && qs.every((q, i) => picked[i] === q.answer);
