import { browser } from '$app/env';
import { haptic as iosHaptic, type HapticKind } from '#lib/ios/haptics.ts';
import { clearAll, get, getAll, put, putMany } from '#lib/db/idb.ts';
import { defaultParams, newCard, replay, review, type Card, type Grade, type ReviewLog } from '#lib/srs/fsrs.ts';

export interface Settings {
	retention: number;
	newPerDay: number;
	haptics: boolean;
	autoplayAudio: boolean;
}

interface Today {
	date: string;
	reviews: number;
	learned: number;
}

export type StoredLog = ReviewLog & { synced: 0 | 1 };

const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA'); // YYYY-MM-DD local

class Progress {
	ready = $state(false);
	cards = $state<Record<string, Card>>({});
	completed = $state<string[]>([]);
	settings = $state<Settings>({ retention: 0.9, newPerDay: 10, haptics: true, autoplayAudio: true });
	streak = $state({ days: 0, last: '' });
	today = $state<Today>({ date: dayKey(), reviews: 0, learned: 0 });
	now = $state(Date.now());

	params = $derived({ ...defaultParams, requestRetention: this.settings.retention });
	due = $derived(
		Object.values(this.cards)
			.filter((c) => c.state !== 'new' && c.due <= this.now)
			.sort((a, b) => a.due - b.due)
	);
	learnedCount = $derived(Object.values(this.cards).filter((c) => c.state === 'review').length);
	newBudgetLeft = $derived(Math.max(0, this.settings.newPerDay - this.today.learned));

	async load() {
		if (!browser || this.ready) return;
		const [cards, completed, settings, streak, today] = await Promise.all([
			getAll<Card>('cards'),
			get<string[]>('meta', 'completed'),
			get<Settings>('meta', 'settings'),
			get<{ days: number; last: string }>('meta', 'streak'),
			get<Today>('meta', 'today')
		]);
		this.cards = Object.fromEntries(cards.map((c) => [c.id, c]));
		if (completed) this.completed = completed;
		if (settings) this.settings = { ...this.settings, ...settings };
		if (streak) this.streak = streak;
		if (today && today.date === dayKey()) this.today = today;
		this.ready = true;
		// Keep "due" fresh while the app is open.
		setInterval(() => (this.now = Date.now()), 30_000);
	}

	async saveSettings(s: Partial<Settings>) {
		this.settings = { ...this.settings, ...s };
		await put('meta', $state.snapshot(this.settings), 'settings');
	}

	/** Record one answer: update FSRS state, append to the review log. */
	async record(cardId: string, grade: Grade, durationMs: number) {
		const now = Date.now();
		const prev = this.cards[cardId] ?? newCard(cardId, now);
		const isNew = prev.state === 'new';
		const next = review(prev, grade, now, this.params);
		this.cards[cardId] = next;

		const log: StoredLog = {
			id: `${now.toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
			cardId,
			grade,
			reviewedAt: now,
			elapsedDays: prev.lastReview ? (now - prev.lastReview) / 86_400_000 : 0,
			durationMs: Math.round(durationMs),
			synced: 0
		};

		this.bumpToday(isNew ? 'learned' : 'reviews');
		this.bumpStreak();
		await Promise.all([
			put('cards', $state.snapshot(next)),
			put('logs', log),
			put('meta', $state.snapshot(this.today), 'today'),
			put('meta', $state.snapshot(this.streak), 'streak')
		]);
		return next;
	}

	async completeLesson(id: string) {
		if (!this.completed.includes(id)) this.completed.push(id);
		await put('meta', $state.snapshot(this.completed), 'completed');
	}

	/** Merge logs from another device: replay every affected card. */
	async mergeLogs(remote: ReviewLog[]) {
		if (remote.length === 0) return;
		const local = await getAll<StoredLog>('logs');
		const seen = new Set(local.map((l) => l.id));
		const fresh = remote.filter((l) => !seen.has(l.id)).map((l) => ({ ...l, synced: 1 as const }));
		if (fresh.length === 0) return;
		await putMany('logs', fresh);
		const all = [...local, ...fresh];
		const touched = new Set(fresh.map((l) => l.cardId));
		const updated = [...touched].map((id) => replay(id, all, this.params));
		for (const c of updated) this.cards[c.id] = c;
		await putMany('cards', updated);
	}

	async reset() {
		await clearAll();
		this.cards = {};
		this.completed = [];
		this.streak = { days: 0, last: '' };
		this.today = { date: dayKey(), reviews: 0, learned: 0 };
	}

	private bumpToday(field: 'reviews' | 'learned') {
		if (this.today.date !== dayKey()) this.today = { date: dayKey(), reviews: 0, learned: 0 };
		this.today[field]++;
	}

	private bumpStreak() {
		const d = dayKey();
		if (this.streak.last === d) return;
		const yesterday = dayKey(Date.now() - 86_400_000);
		this.streak = { days: this.streak.last === yesterday ? this.streak.days + 1 : 1, last: d };
	}
}

export const progress = new Progress();

/** Haptic feedback, respecting the user's setting (iOS-capable, see lib/ios/haptics.ts). */
export function haptic(kind: HapticKind = 'selection') {
	if (progress.settings.haptics) iosHaptic(kind);
}
