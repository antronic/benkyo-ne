/**
 * Kanji you keep forgetting (docs/EVERYDAY.md). Misreads come from the review
 * log; "couldn't write" slips are recorded here when a kanji drawn from memory
 * is wrong. Slips stay on this device (meta 'kanjiWriteSlips', last 60 days).
 */
import { browser } from '$app/env';
import { get, getAll, put } from '#lib/db/idb.ts';
import { forgottenKanji, keepRecent, type Slipped, type WriteSlip } from '#lib/practice/forgetting.ts';
import type { StoredLog } from '#lib/state/progress.svelte.ts';
import { words } from '#lib/state/words.svelte.ts';

const KEY = 'kanjiWriteSlips';

class Forgetting {
	ready = $state(false);
	/** This week's set, most slips first. */
	set = $state<Slipped[]>([]);
	private slips: WriteSlip[] = [];
	private loading: Promise<void> | null = null;

	load(): Promise<void> {
		if (!browser) return Promise.resolve();
		this.loading ??= this.refresh();
		return this.loading;
	}

	/** Read the log again (after a review session). */
	async refresh() {
		try {
			const [logs, slips] = await Promise.all([getAll<StoredLog>('logs'), get<WriteSlip[]>('meta', KEY)]);
			this.slips = keepRecent(slips ?? []);
			this.set = forgottenKanji(logs, this.slips, (id) => words.cards[id]?.kanji ?? null);
		} catch {
			/* no database (private mode): the set stays empty */
		} finally {
			this.ready = true;
		}
	}

	/** A kanji drawn wrong from memory. */
	async addWriteSlip(char: string) {
		await this.load();
		this.slips = keepRecent([...this.slips, { char, at: Date.now() }]);
		try {
			await put('meta', this.slips, KEY);
		} catch {
			/* a lost slip only makes the set a little shorter */
		}
	}
}

export const forgetting = new Forgetting();
