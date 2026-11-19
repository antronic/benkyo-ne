/**
 * Level courses (JLPT N5 to N1): the shape of one unit. See docs/LEVELS.md.
 *
 * A unit teaches a few kanji, about a dozen words, three grammar points and
 * one short reading. Facts (kanji readings and meanings) come from KANJIDIC2
 * through @johnmorrisdotca/jisho at run time, so a unit only names its kanji.
 * Everything a learner reads is stored in English and Thai side by side.
 */
import type { CardKind } from '#lib/ai/contract.ts';

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

/** A text in both explanation languages. */
export interface EnTh {
	en: string;
	th: string;
}

export interface LevelWord {
	/** kana, as on the card front */
	reading: string;
	/** written form when it uses kanji */
	kanji?: string;
	gloss: EnTh;
	kind: CardKind;
}

export interface Example {
	ja: string;
	en: string;
	th: string;
}

export interface GrammarPoint {
	/** unique across all levels, e.g. 'n5-desu' */
	id: string;
	/** the pattern as learners see it: '〜は〜です' */
	pattern: string;
	/** how it is built: 'N1 は N2 です' */
	formation: string;
	meaning: EnTh;
	/** one or two sentences of explanation, or a trap for Thai speakers */
	note?: EnTh;
	examples: Example[];
}

export interface Question {
	q: EnTh;
	choices: EnTh[];
	/** index into choices */
	answer: number;
}

export interface Reading {
	title: EnTh;
	/** one line per entry (a dialogue line or a sentence) */
	lines: Example[];
	questions: Question[];
}

/** Who checked a part of the unit, and when (YYYY-MM-DD). null = not checked yet. */
export interface Review {
	by: string;
	on: string;
}

export interface LevelUnit {
	/** unique across all levels, e.g. 'n5-01' (also the id stored in progress.completed) */
	id: string;
	level: JlptLevel;
	title: EnTh;
	/** what the learner can do after the unit */
	goal: EnTh;
	/** kanji introduced in this unit */
	kanji: string[];
	words: LevelWord[];
	grammar: GrammarPoint[];
	reading: Reading;
	/** Japanese checked by a fluent reviewer; Thai checked by a native speaker */
	review: { ja: Review | null; th: Review | null };
	/** how the draft was made, e.g. 'ai-draft 2026-11-19' */
	source: string;
}
