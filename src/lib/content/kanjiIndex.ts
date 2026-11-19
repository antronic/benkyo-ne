/**
 * Every kanji the app teaches, in one list, for the kanji gallery
 * (/learn/browse/kanji): the kanji lessons first, in lesson order, then the
 * level-course kanji in unit order. Facts (meanings, readings, stroke count)
 * come from KANJIDIC2 rows; a lesson kanji keeps its own short keyword.
 */
import type { Kanji as KanjiRow } from '@johnmorrisdotca/jisho';
import { KANJI_LESSONS } from './kanji.ts';
import type { EnTh, JlptLevel, LevelUnit } from './levels/index.ts';

export interface GalleryKanji {
	char: string;
	/** Short English meaning: the lesson keyword, else KANJIDIC2's first meanings. */
	meaning: string;
	on: string[];
	kun: string[];
	strokes: number | null;
	level: JlptLevel | null;
	/** The kanji lesson that teaches it, if any. */
	lesson: { id: string; title: string } | null;
	/** The level unit that teaches it, if any. */
	unit: { id: string; title: EnTh; n: number } | null;
}

export function buildKanjiIndex(rows: readonly KanjiRow[], units: readonly LevelUnit[]): GalleryKanji[] {
	const byChar = new Map(rows.map((r) => [r.kanji, r]));
	const out = new Map<string, GalleryKanji>();
	const level = (r?: KanjiRow) => (r?.level && /^N[1-5]$/.test(r.level) ? (r.level as JlptLevel) : null);

	for (const l of KANJI_LESSONS)
		for (const k of l.chars) {
			const r = byChar.get(k.char);
			out.set(k.char, {
				char: k.char,
				meaning: k.meaning,
				on: [...k.on],
				kun: [...k.kun],
				strokes: r?.strokes ?? null,
				level: level(r),
				lesson: { id: l.id, title: l.title },
				unit: null
			});
		}

	const n = new Map<string, number>();
	for (const u of units) {
		n.set(u.level, (n.get(u.level) ?? 0) + 1);
		for (const ch of u.kanji) {
			const r = byChar.get(ch);
			const unit = { id: u.id, title: u.title, n: n.get(u.level)! };
			const had = out.get(ch);
			if (had) {
				had.unit ??= unit;
				continue;
			}
			out.set(ch, {
				char: ch,
				meaning: r?.meanings.slice(0, 2).join(', ') ?? '',
				on: [...(r?.on ?? [])],
				kun: [...(r?.kun ?? [])],
				strokes: r?.strokes ?? null,
				level: level(r) ?? u.level,
				lesson: null,
				unit
			});
		}
	}
	return [...out.values()];
}

/** Matches a search: the kanji itself, a meaning word, or a reading (kana, okurigana dots ignored). */
export function matchesKanji(k: GalleryKanji, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	if (k.char === q) return true;
	if (k.meaning.toLowerCase().includes(q)) return true;
	const kata = q.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
	return [...k.on, ...k.kun].some((r) => {
		const plain = r.replace(/[.\-]/g, '');
		return plain.startsWith(q) || plain.startsWith(kata);
	});
}
