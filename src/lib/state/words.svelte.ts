/**
 * Word & phrase cards (docs/AI-PLAN.md §4, §4b): content lives here, scheduling
 * stays in the FSRS review log (progress store) under the same card id.
 *
 * New-card order each day (D19):
 *   1. curriculum lessons   (consume the budget as they're completed)
 *   2. cards you made        (source user | scenario)
 *   3. pack words            (≤ 30 % of the daily new-card limit)
 * Cards whose kana reading you can't read yet are "parked" until you can.
 */
import { browser } from '$app/env';
import { get, getAll, put } from '#lib/db/idb.ts';
import type { UserCard } from '#lib/ai/contract.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import { isReadable } from '#lib/dict/readable.ts';
import { NOW_TAG, isSystemTag } from '#lib/content/courses.ts';

export const PACK_SHARE = 0.3;

const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');

class Words {
	ready = $state(false);
	cards = $state<Record<string, UserCard>>({});
	/** pack words introduced today (for the 30 % share) */
	packToday = $state({ date: dayKey(), n: 0 });

	list = $derived(
		Object.values(this.cards)
			.filter((c) => !c.deleted)
			.sort((a, b) => b.createdAt - a.createdAt)
	);

	tags = $derived.by(() => {
		const m = new Map<string, number>();
		for (const c of this.list) for (const t of c.tags) if (!isSystemTag(t)) m.set(t, (m.get(t) ?? 0) + 1);
		return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
	});

	async load() {
		if (!browser || this.ready) return;
		const [all, pt] = await Promise.all([getAll<UserCard>('userCards'), get<{ date: string; n: number }>('meta', 'packToday')]);
		this.cards = Object.fromEntries(all.map((c) => [c.id, c]));
		if (pt && pt.date === dayKey()) this.packToday = pt;
		this.ready = true;
	}

	isParked(c: UserCard): boolean {
		// "Learn now with romaji" (course units) skips waiting for the kana lessons
		if (c.tags.includes(NOW_TAG)) return false;
		return !isReadable(c.front, progress.knownKana);
	}

	/** Cards not yet introduced (no FSRS state), not parked. */
	unintroduced = $derived(
		this.list.filter((c) => {
			const s = progress.cards[c.id];
			return (!s || s.state === 'new') && !this.isParked(c);
		})
	);

	parked = $derived(this.list.filter((c) => !progress.cards[c.id] && this.isParked(c)));

	/** Which new word/phrase cards may be introduced right now, in priority order. */
	newQueue = $derived.by(() => {
		let budget = progress.newBudgetLeft;
		if (budget <= 0) return [] as UserCard[];
		const packCap = Math.max(0, Math.floor(progress.settings.newPerDay * PACK_SHARE) - this.currentPackToday());
		const mine = this.unintroduced.filter((c) => c.source !== 'pack').sort((a, b) => a.createdAt - b.createdAt);
		const pack = this.unintroduced.filter((c) => c.source === 'pack').sort((a, b) => a.createdAt - b.createdAt);
		const out = mine.slice(0, budget);
		budget -= out.length;
		out.push(...pack.slice(0, Math.min(budget, packCap)));
		return out;
	});

	private currentPackToday() {
		return this.packToday.date === dayKey() ? this.packToday.n : 0;
	}

	async notePackIntroduced() {
		const n = this.currentPackToday() + 1;
		this.packToday = { date: dayKey(), n };
		await put('meta', $state.snapshot(this.packToday), 'packToday');
	}

	async save(card: Omit<UserCard, 'updatedAt'> & { updatedAt?: number }) {
		const prev = this.cards[card.id];
		const next: UserCard = {
			...card,
			tags: [...new Set(card.tags.map((t) => t.trim()).filter(Boolean))],
			createdAt: prev?.createdAt ?? card.createdAt,
			updatedAt: Date.now()
		};
		this.cards[next.id] = next;
		await put('userCards', $state.snapshot(next));
		return next;
	}

	async remove(id: string) {
		const c = this.cards[id];
		if (c) await this.save({ ...c, deleted: true });
	}

	async setTags(id: string, tags: string[]) {
		const c = this.cards[id];
		if (c) await this.save({ ...c, tags });
	}

	/** Merge cards from another device (last write wins). */
	async merge(remote: UserCard[]) {
		for (const r of remote) {
			const l = this.cards[r.id];
			if (!l || r.updatedAt > l.updatedAt) {
				this.cards[r.id] = r;
				await put('userCards', r);
			}
		}
	}

	byTag(tag: string) {
		return this.list.filter((c) => c.tags.includes(tag));
	}
}

export const words = new Words();
