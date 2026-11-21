import { t } from '#lib/i18n/index.svelte.ts';
import type { AskFocus } from './contract.ts';

/** Starter questions for a chat about one word; the kanji one only when the word has kanji. */
export function focusStarters(f: AskFocus): string[] {
	const word = f.word;
	const hasKanji = /[一-鿿々]/.test(word);
	return [t('ask.focusStarter1', { word }), t('ask.focusStarter2', { word }), t('ask.focusStarter3', { word }), hasKanji ? t('ask.focusStarterKanji', { word }) : t('ask.focusStarter4', { word })];
}
