/**
 * Level courses (JLPT N5 to N1). Each level's units load on demand, so the
 * app bundle does not grow with the content (docs/LEVELS.md).
 *
 * A unit whose Japanese has not been checked by a reviewer is a draft. Drafts
 * are shown only when the learner turns on "Show draft units" in Settings,
 * and always carry a "Draft" badge.
 */
import type { EnTh, JlptLevel, LevelUnit, LevelWord } from './types.ts';

export type { EnTh, JlptLevel, LevelUnit, LevelWord } from './types.ts';

export interface LevelInfo {
	id: JlptLevel;
	hue: number;
	/** units planned for the level (docs/LEVELS.md), to show progress of the writing */
	planned: number;
	load: () => Promise<LevelUnit[]>;
}

export const LEVELS: LevelInfo[] = [{ id: 'N5', hue: 150, planned: 27, load: () => import('./n5.ts').then((m) => m.N5_UNITS) }];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id.toUpperCase());

/** Not yet checked by a Japanese reviewer. */
export const isDraft = (u: LevelUnit) => !u.review.ja;

/** Thai not yet checked by a native speaker (shown with the "AI Thai" badge). */
export const thaiUnchecked = (u: LevelUnit) => !u.review.th;

/** Units a learner sees: reviewed ones, plus drafts when asked for. */
export const visibleUnits = (units: LevelUnit[], showDrafts: boolean) => units.filter((u) => showDrafts || !isDraft(u));

/** Hidden card tag for words added from a level unit (same shape as course tags). */
export const levelTag = (u: LevelUnit) => `~course:${u.level.toLowerCase()}/${u.id}`;

/** The text of an EnTh in a locale: Thai when asked for and present, else English. */
export const pick = (x: EnTh, locale: string) => (locale === 'th' && x.th ? x.th : x.en);

/** The written form of a word, or its reading when it has none. */
export const wordText = (w: LevelWord) => w.kanji ?? w.reading;
