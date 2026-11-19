/**
 * The kanji gallery's list (lib/content/kanjiIndex.ts), loaded once: the
 * KANJIDIC2 table and the level units are separate chunks, fetched on demand.
 */
import { buildKanjiIndex, type GalleryKanji } from '#lib/content/kanjiIndex.ts';
import { LEVELS } from '#lib/content/levels/index.ts';
import { levels } from './levels.svelte.ts';

class KanjiIndexStore {
	list = $state<GalleryKanji[] | null>(null);
	failed = $state(false);
	#loading: Promise<GalleryKanji[]> | null = null;

	load(): Promise<GalleryKanji[]> {
		this.#loading ??= (async () => {
			try {
				const [{ readKanji }, { KANJI }, units] = await Promise.all([
					import('@johnmorrisdotca/jisho'),
					import('@johnmorrisdotca/jisho/kanji'),
					Promise.all(LEVELS.map((l) => levels.load(l.id)))
				]);
				this.failed = false;
				return (this.list = buildKanjiIndex(readKanji(KANJI), units.flat()));
			} catch (e) {
				this.failed = true;
				this.#loading = null;
				throw e;
			}
		})();
		return this.#loading;
	}

	byChar(char: string): GalleryKanji | undefined {
		return this.list?.find((k) => k.char === char);
	}
}

export const kanjiIndex = new KanjiIndexStore();
