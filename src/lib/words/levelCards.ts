/**
 * Level unit words → the learner's cards (the same path as course units:
 * dictionary check, then saveCandidates). Thai learners get the unit's own
 * Thai gloss as the card's second gloss when the dictionary has none.
 */
import { verifyItem } from '#lib/dict/dict.ts';
import { levelTag, type LevelUnit, type LevelWord } from '#lib/content/levels/index.ts';
import { NOW_TAG } from '#lib/content/courses.ts';
import { saveCandidates, type Candidate } from '#lib/words/maker.ts';
import { words } from '#lib/state/words.svelte.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import type { UserCard } from '#lib/ai/contract.ts';

export type LevelCandidate = Candidate & { word: LevelWord };

export async function levelCandidate(u: LevelUnit, w: LevelWord): Promise<LevelCandidate> {
	const v = await verifyItem({ text: w.kanji ?? w.reading, reading: w.reading });
	const hit = v.hit;
	return {
		key: hit ? `${w.kind}:${hit.id}` : `${w.kind}:custom:${u.id}-${w.reading}`,
		text: w.kanji ?? w.reading,
		reading: w.reading,
		written: w.kanji ? [w.kanji] : [],
		kind: w.kind,
		gloss: w.gloss.en,
		verified: v.verified || !v.available,
		wordId: hit?.id ?? null,
		note: null,
		word: w
	};
}

/** Save the chosen words as cards of this unit. Returns the saved cards. */
export async function saveLevelWords(u: LevelUnit, chosen: LevelCandidate[], learnNow: boolean): Promise<UserCard[]> {
	const saved = await saveCandidates(chosen, { tags: [levelTag(u), ...(learnNow ? [NOW_TAG] : [])], source: 'user' });
	if (progress.settings.secondLang === 'th') {
		for (const c of saved) {
			const th = chosen.find((x) => x.key === c.id)?.word.gloss.th;
			const card = words.cards[c.id];
			if (th && card && !card.gloss2) await words.save({ ...card, gloss2: th });
		}
	}
	return saved;
}
