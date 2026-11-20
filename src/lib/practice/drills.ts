/**
 * Practice drills for learners who already know the material and want reps,
 * not new lessons. A drill picks cards you have already met; the review
 * screen runs them, and (as with tag drills, D21) a card that isn't due is
 * practised without changing its schedule. Due cards are graded as usual.
 */
import { confusablesOf } from '#lib/content/confusables.ts';
import { retrievability, type Card } from '#lib/srs/fsrs.ts';
import { kanjiIn } from './forgetting.ts';

export type DrillId = 'mixed' | 'lookalikes' | 'weakest' | 'words' | 'forgetting';

export interface Drill {
	id: DrillId;
	emoji: string;
	title: string;
	blurb: string;
}

export const DRILLS: Drill[] = [
	{ id: 'mixed', emoji: '🔀', title: 'Mixed kana', blurb: 'Hiragana and katakana you know, shuffled together.' },
	{ id: 'lookalikes', emoji: '👀', title: 'Look-alikes', blurb: 'さ/ち, シ/ツ, ソ/ン… tell similar shapes apart.' },
	{ id: 'weakest', emoji: '🩹', title: 'Weakest first', blurb: 'The cards you are most likely to forget next.' },
	{ id: 'words', emoji: '💬', title: 'Words & phrases', blurb: 'Every word card you have started, mixed.' },
	{ id: 'forgetting', emoji: '🧠', title: 'Kanji you keep forgetting', blurb: 'This week’s misreads and the ones you couldn’t write.' }
];

/** What the kanji drill needs besides the cards: this week's set (docs/EVERYDAY.md). */
export interface DrillExtra {
	/** Kanji from this week's set, most slips first. */
	forgotten?: readonly string[];
	/** The written form of a word card (null for other cards). */
	textOf?: (id: string) => string | null;
}

export const DRILL_SIZE = 20;

export const isDrillId = (s: string | null): s is DrillId => DRILLS.some((d) => d.id === s);

const met = (c: Card) => c.state !== 'new';
const isKana = (id: string) => id.startsWith('kana:');

function shuffle<T>(a: T[], rand: () => number): T[] {
	const r = [...a];
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

/** Predicted recall right now (0..1). */
export function recallNow(c: Card, now: number): number {
	if (!c.lastReview) return 0;
	return retrievability((now - c.lastReview) / 864e5, Math.max(c.stability, 0.01));
}

/**
 * Card ids for a drill, at most `n`.
 * `isWord(id)` says whether a non-kana id is a live word/phrase card.
 */
export function pickDrill(
	id: DrillId,
	cards: Record<string, Card>,
	isWord: (id: string) => boolean,
	now = Date.now(),
	n = DRILL_SIZE,
	rand = Math.random,
	extra: DrillExtra = {}
): string[] {
	const all = Object.values(cards).filter(met);
	const kana = all.filter((c) => isKana(c.id));
	const known = new Set(kana.map((c) => c.id.slice(5)));
	switch (id) {
		case 'mixed':
			return shuffle(kana, rand).slice(0, n).map((c) => c.id);
		case 'lookalikes':
			return shuffle(
				kana.filter((c) => confusablesOf(c.id.slice(5)).some((o) => known.has(o))),
				rand
			)
				.slice(0, n)
				.map((c) => c.id);
		case 'words':
			return shuffle(all.filter((c) => !isKana(c.id) && isWord(c.id)), rand)
				.slice(0, n)
				.map((c) => c.id);
		case 'weakest':
			return shuffle(
				all
					.filter((c) => isKana(c.id) || isWord(c.id))
					.sort((a, b) => recallNow(a, now) - recallNow(b, now))
					.slice(0, n),
				rand
			).map((c) => c.id);
		case 'forgetting': {
			// the kanji card itself, then words written with it, for each kanji in the set
			const set = new Set(extra.forgotten ?? []);
			if (!set.size) return [];
			const picked = all.filter((c) => {
				if (c.id.startsWith('kanji:')) return set.has(c.id.slice(6));
				return !isKana(c.id) && isWord(c.id) && kanjiIn(extra.textOf?.(c.id)).some((k) => set.has(k));
			});
			return shuffle(picked, rand)
				.slice(0, n)
				.map((c) => c.id);
		}
	}
}

/** How many cards each drill would offer (for the Learn screen). */
export function drillCounts(cards: Record<string, Card>, isWord: (id: string) => boolean, extra: DrillExtra = {}): Record<DrillId, number> {
	const big = Number.MAX_SAFE_INTEGER;
	return Object.fromEntries(DRILLS.map((d) => [d.id, pickDrill(d.id, cards, isWord, Date.now(), big, Math.random, extra).length])) as Record<DrillId, number>;
}
