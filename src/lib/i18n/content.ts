/**
 * Lesson content in the interface language.
 *
 * Lesson and course data (lessons.ts, courses.ts, mnemonics.ts) stay in
 * English. Translations live beside them here, keyed by the English text, so
 * the content files need no changes and anything not yet translated (new
 * units, AI-made cards) simply shows in English.
 */
import { i18n } from './index.svelte.ts';
import { baseOf, mnemonicFor } from '#lib/content/mnemonics.ts';
import { CONTENT_TH } from './content.th.ts';

const MAPS: Record<string, Record<string, string>> = { th: CONTENT_TH };

/** Translate a piece of lesson content (title, note, gloss, story…). */
export function c(text: string): string;
export function c(text: string | undefined): string | undefined;
export function c(text: string | undefined): string | undefined {
	if (!text) return text;
	return MAPS[i18n.locale]?.[text] ?? text;
}

/** Glosses with several senses ("yes; okay") are translated sense by sense when no whole match exists. */
export function gloss(text: string): string {
	const map = MAPS[i18n.locale];
	if (!map) return text;
	if (map[text]) return map[text];
	const parts = text.split('; ');
	return parts.length > 1 && parts.every((p) => map[p]) ? parts.map((p) => map[p]).join(', ') : text;
}

/** Kana script name for the interface ("hiragana" → "ฮิรางานะ"). */
export const scriptName = (s: string) => c(s);

/** Mnemonic story for a kana, translated. Dakuten/handakuten stories are built from their base kana. */
export function story(char: string): string {
	const base = baseOf(char);
	if (base && i18n.locale === 'th') {
		const isP = 'ぱぴぷぺぽパピプペポ'.includes(char);
		return `${base} เติม${isP ? 'วงกลมเล็ก ゜ (h → p)' : 'ขีดเล็กสองขีด ゛ (เสียงก้อง)'}`;
	}
	return c(mnemonicFor(char).story);
}
