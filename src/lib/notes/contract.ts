/**
 * Personal notes, shared by the app and the Worker (docs/NOTES.md).
 *
 * A note belongs to one study item, named by its `subject`:
 *   word:… / phrase:…   word and phrase cards (the card id)
 *   kana:あ             a kana
 *   kanji:日            a kanji
 *   unit:travel/basics  a course unit
 *   lesson:<id>         an AI lesson pack
 *   pack:<id>           a reading pack
 */
export interface Note {
	subject: string;
	/** What the item is called ("食べる", "Ramen Shop"), shown in the Notes list. */
	label: string;
	body: string;
	createdAt: number;
	updatedAt: number;
	/** A tombstone, so a delete reaches other devices. */
	deleted: boolean;
}

/** Longest note, in UTF-16 code units. */
export const NOTE_MAX = 4000;

export const SUBJECT_RE = /^(word|phrase|kana|kanji|unit|lesson|pack):\S/;

export type SubjectKind = 'word' | 'phrase' | 'kana' | 'kanji' | 'unit' | 'lesson' | 'pack';

export const subjectKind = (s: string) => s.slice(0, s.indexOf(':')) as SubjectKind;
