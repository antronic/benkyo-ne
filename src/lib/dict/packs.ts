/**
 * "Words you can read" (docs/AI-PLAN.md §4 step 1, D7/D8): real common JMdict words whose
 * reading uses only kana the learner knows. Deterministic and offline (common-words table only).
 */
import type { Word } from '@johnmorrisdotca/jisho/words';
import type { CardKind, FillRequest } from '#lib/ai/contract.ts';
import { commonWords, fold, jisho, meta } from '#lib/dict/dict.ts';
import { isReadable } from '#lib/dict/readable.ts';

export interface PackPick {
	/** `word:<id>` (or `phrase:<id>` for JMdict expressions, matching UserCard ids) */
	key: string;
	id: number;
	/** written form when the word is usually written with kanji, else the reading */
	text: string;
	/** kana reading: the card front (D17) */
	reading: string;
	/** written forms for the back ("also written 池"); empty for kana-only words */
	written: string[];
	gloss: string;
	kind: CardKind;
	rank: number | null;
}

/** First-sense marks that keep a word out of packs: archaic, obsolete, rare, dated, vulgar/offensive. */
const BAD_FIRST = ['arch', 'obs', 'rare', 'dated', 'vulg', 'X', 'sens', 'derog', 'hist'];
/** If every sense carries one of these, the word is out. */
const BAD_ALL = ['arch', 'obs', 'rare', 'dated'];

/** Kana length that counts for "2–4 kana" (small ゃゅょ fold into the kana before them). */
function moraLength(reading: string): number {
	return [...reading].filter((c) => !/[ゃゅょゎぁぃぅぇぉャュョヮァィゥェォ]/u.test(c)).length;
}

interface Candidate {
	word: Word & { id: number };
	score: number;
	kind: CardKind;
}

/**
 * Lower is better. JMdict's rank alone favours newspaper words (価格, 改革), so it is log-scaled
 * and combined with how basic the kanji are and how short the word is:
 *   ln(rank)                       250 → 5.5, 12,000 (ichi1 only) → 9.4, unranked → 10.3
 *   + 0.5 per school grade above 1 of the hardest kanji (secondary/unlisted count as 8–10)
 *   + 0 / 0.3 / 0.6 for 2 / 3 / 4 kana, + 2 for 5–6
 *   − 0.5 if usually written in kana (what a kana-stage learner actually sees)
 *   − 0.4 if in a basic-vocabulary list (ichi1, spec1, spec2)
 */
/** Newspaper/institution vocabulary is common but not beginner-friendly (e.g. 大手, 国会, 計画). */
const ADULT_TOPICS =
	/\b(compan(y|ies)|corporat|parliament|diet\b|nation(al)?|state\b|govern|politic|econom|industr|business|financ|militar|legislat|administrat|enterprise|municipal|metropol|project|plan\b)/i;
const JLPT_PENALTY: Record<string, number> = { N5: 0, N4: 0.3, N3: 1.5, N2: 2.5, N1: 3.5 };

function scoreOf(
	w: Word,
	len: number,
	grade: (k: string) => number | null,
	kanjiIn: (t: string) => string[],
	level: (k: string) => string | null = () => 'N5'
): number {
	let score = Math.log(w.rank >= 100000 ? 30000 : w.rank);
	const kanji = w.written === w.reading ? [] : kanjiIn(w.written);
	const hardest = kanji.reduce((g, k) => Math.max(g, grade(k) ?? 10), 1);
	score += 0.5 * (hardest - 1);
	score += len <= 2 ? 0 : len === 3 ? 0.3 : len === 4 ? 0.6 : 2;
	if (w.written === w.reading) score -= 0.5;
	if (w.priority.some((p) => p === 'ichi1' || p === 'spec1' || p === 'spec2')) score -= 0.4;
	// beginner-friendliness: kanji above JLPT N4 and institutional topics sink
	score += kanji.reduce((m, k) => Math.max(m, JLPT_PENALTY[level(k) ?? 'N1'] ?? 3.5), 0);
	if (ADULT_TOPICS.test(w.meaning)) score += 3;
	return score;
}

let candidatesP: Promise<Candidate[]> | null = null;

/** Every common word that could ever go in a pack, best first (known-kana filter applied later). */
function candidates(): Promise<Candidate[]> {
	return (candidatesP ??= (async () => {
		const [j, c, m, idx, { GRADES }, { JLPT }] = await Promise.all([
			jisho(),
			commonWords(),
			meta(),
			import('@johnmorrisdotca/jisho'),
			import('@johnmorrisdotca/jisho/grades'),
			import('@johnmorrisdotca/jisho/jlpt')
		]);
		const best = new Map<string, Candidate>();
		for (const w of j.allWords(c)) {
			if (typeof w.id !== 'number' || !w.meaning) continue;
			const id = w.id;
			const len = moraLength(w.reading);
			if (len < 2 || len > 6) continue;
			if (m.grammar.has(id)) continue;
			if (m.secondary.get(id)?.has(fold(w.reading))) continue;
			const first = w.senses[0]?.marks ?? [];
			if (first.some((x) => BAD_FIRST.includes(x))) continue;
			if (w.senses.length && w.senses.every((s) => s.marks.some((x) => BAD_ALL.includes(x)))) continue;
			const score = scoreOf(w, len, (k) => idx.gradeOf(GRADES, k), idx.kanjiIn, (k) => idx.levelOf(JLPT, k));
			const cand: Candidate = { word: w as Word & { id: number }, score, kind: m.phrase.has(id) ? 'phrase' : 'word' };
			// one word per reading (two cards both fronted あか would be ambiguous)
			const key = fold(w.reading);
			const held = best.get(key);
			if (!held || cand.score < held.score || (cand.score === held.score && id < held.word.id)) best.set(key, cand);
		}
		return [...best.values()].sort((a, b) => a.score - b.score || a.word.id - b.word.id);
	})().catch((e) => {
		candidatesP = null;
		throw e;
	}));
}

/** mulberry32 */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Pick `count` (default 6) common words the learner can read, commonest first, skipping
 * `excludeIds` (already in the deck / shown recently). Without a seed: the top `count`.
 * With a seed: a deterministic draw from the top `count × 3` readable words, returned in
 * frequency order. Returns [] when nothing (or the dictionary) is available.
 */
export async function pickPackWords(opts: {
	knownKana: Iterable<string>;
	excludeIds?: Iterable<number>;
	count?: number;
	seed?: number;
}): Promise<PackPick[]> {
	const known = new Set(opts.knownKana);
	const exclude = new Set(opts.excludeIds ?? []);
	const count = Math.max(0, Math.floor(opts.count ?? 6));
	if (!count || !known.size) return [];
	let all: Candidate[];
	try {
		all = await candidates();
	} catch (e) {
		console.warn('[dict] common words unavailable', e);
		return [];
	}
	const pool: Candidate[] = [];
	const window = opts.seed === undefined ? count : count * 3;
	for (const c of all) {
		if (exclude.has(c.word.id) || !isReadable(c.word.reading, known)) continue;
		pool.push(c);
		if (pool.length >= window) break;
	}
	let chosen = pool;
	if (opts.seed !== undefined && pool.length > count) {
		const r = rng(opts.seed);
		const idx = pool.map((_, i) => i);
		for (let i = idx.length - 1; i > 0; i--) {
			const k = Math.floor(r() * (i + 1));
			[idx[i], idx[k]] = [idx[k], idx[i]];
		}
		chosen = idx
			.slice(0, count)
			.sort((a, b) => a - b)
			.map((i) => pool[i]);
	}
	return chosen.slice(0, count).map(({ word: w, kind }) => ({
		key: `${kind}:${w.id}`,
		id: w.id,
		text: w.written,
		reading: w.reading,
		written: [...w.forms],
		gloss: w.meaning,
		kind,
		rank: w.rank >= 100000 ? null : w.rank
	}));
}

/** PackPick[] → FillRequest['items'] for the AI enrich step. */
export function toFillItems(picks: PackPick[]): FillRequest['items'] {
	return picks.map(({ key, text, reading, kind, gloss }) => ({ key, text, reading, kind, gloss }));
}
