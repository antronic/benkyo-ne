/**
 * Weekly report (docs/EVERYDAY.md). Reads the review log, your cards, this
 * week's forgotten kanji and the Writing helper checks (kept on this device,
 * meta 'writeChecks', last 60 days) and works out the week.
 */
import { browser } from '$app/env';
import { get, getAll, put } from '#lib/db/idb.ts';
import { keepRecentChecks, weekReport, type Week, type WriteCheck } from '#lib/report/week.ts';
import type { StoredLog } from '#lib/state/progress.svelte.ts';
import { forgetting } from '#lib/state/forgetting.svelte.ts';
import { words } from '#lib/state/words.svelte.ts';

const KEY = 'writeChecks';

class WeekReport {
	ready = $state(false);
	week = $state<Week | null>(null);

	/** Work the week out again from what is stored now. */
	async refresh() {
		try {
			const [logs, checks] = await Promise.all([getAll<StoredLog>('logs'), get<WriteCheck[]>('meta', KEY), forgetting.refresh()]);
			this.week = weekReport({ logs, cards: words.list, writeChecks: checks ?? [], forgotten: forgetting.set });
		} catch {
			/* no database (private mode): the report stays empty */
		} finally {
			this.ready = true;
		}
	}

	/** A message the Writing helper checked. */
	async addCheck(check: WriteCheck) {
		if (!browser) return;
		try {
			const prev = (await get<WriteCheck[]>('meta', KEY)) ?? [];
			await put('meta', keepRecentChecks([...prev, check]), KEY);
		} catch {
			/* a lost check only makes the report a little shorter */
		}
	}
}

export const week = new WeekReport();
