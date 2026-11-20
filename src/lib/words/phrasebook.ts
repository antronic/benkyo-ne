/**
 * Personal phrasebook (docs/EVERYDAY.md): your own cards, ranked by how often
 * they come up in your life. A "sighting" is recorded when a word turns up in a
 * photo you read, a look-up, or a message the Writing helper checked.
 *
 * Pure functions only; the words store saves the result.
 */
import { SEEN_RECENT, type Seen, type Sighting, type SightingVia, type UserCard } from '#lib/ai/contract.ts';

const DAY = 86_400_000;
/** Two sightings of the same card from the same place within this time count once (a re-run of the same photo). */
export const SAME_SIGHTING_MS = 10 * 60_000;
/** The window "comes up most" looks at. */
export const RECENT_DAYS = 30;

export type PhrasebookFilter = 'all' | SightingVia;

const clean = (ctx: string | null | undefined) => {
	const s = (ctx ?? '').replace(/\s+/g, ' ').trim();
	return s ? s.slice(0, 300) : null;
};

/** The card's sightings with one more; a repeat of the last one within SAME_SIGHTING_MS is ignored. */
export function addSighting(seen: Seen | null | undefined, s: Sighting): Seen {
	const prev = seen ?? { count: 0, recent: [] };
	const next: Sighting = { at: s.at, via: s.via, ctx: clean(s.ctx) };
	const last = prev.recent[0];
	if (last && last.via === next.via && last.ctx === next.ctx && Math.abs(next.at - last.at) < SAME_SIGHTING_MS) return prev;
	return { count: prev.count + 1, recent: [next, ...prev.recent].slice(0, SEEN_RECENT) };
}

/** Sightings in the last RECENT_DAYS (from the kept recent list). */
export function recentCount(seen: Seen | null | undefined, now = Date.now()): number {
	return (seen?.recent ?? []).filter((s) => now - s.at <= RECENT_DAYS * DAY).length;
}

/** Where the card came up, most frequent first, without repeats. */
export function viasOf(card: Pick<UserCard, 'seen'>): SightingVia[] {
	const n = new Map<SightingVia, number>();
	for (const s of card.seen?.recent ?? []) n.set(s.via, (n.get(s.via) ?? 0) + 1);
	return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** Cards in your phrasebook: your own (not pack) cards, or any card that came up in your life. */
export function inPhrasebook(c: UserCard): boolean {
	return !c.deleted && (c.source !== 'pack' || (c.seen?.count ?? 0) > 0);
}

/**
 * Ranked phrasebook: what came up most in the last 30 days first, then the
 * all-time count, then the newest. `filter` keeps cards that came up that way.
 */
export function rankPhrasebook(cards: UserCard[], filter: PhrasebookFilter = 'all', now = Date.now()): UserCard[] {
	return cards
		.filter(inPhrasebook)
		.filter((c) => filter === 'all' || (c.seen?.recent ?? []).some((s) => s.via === filter))
		.sort(
			(a, b) =>
				recentCount(b.seen, now) - recentCount(a.seen, now) ||
				(b.seen?.count ?? 0) - (a.seen?.count ?? 0) ||
				b.createdAt - a.createdAt
		);
}

/** How many cards each filter keeps, for the chips. */
export function filterCounts(cards: UserCard[]): Record<PhrasebookFilter, number> {
	const own = cards.filter(inPhrasebook);
	const has = (v: SightingVia) => own.filter((c) => (c.seen?.recent ?? []).some((s) => s.via === v)).length;
	return { all: own.length, photo: has('photo'), lookup: has('lookup'), writing: has('writing'), add: has('add') };
}
