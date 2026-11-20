/**
 * Weekly report (docs/EVERYDAY.md): what you read, wrote and saved in the last
 * 7 days, minutes a day, and one weak spot with a 5 minute drill.
 * Pure functions only; `src/lib/state/week.svelte.ts` loads the data.
 */
import type { UserCard, WriteTo } from '#lib/ai/contract.ts';
import type { PoliteGap } from '#lib/words/writing.ts';
import type { Slipped } from '#lib/practice/forgetting.ts';
import { Again, type Grade } from '#lib/srs/fsrs.ts';

export const DAYS = 7;
const DAY_MS = 86_400_000;

/** One message the Writing helper checked (kept on the device, meta 'writeChecks'). */
export interface WriteCheck {
	at: number;
	to: WriteTo;
	gap: PoliteGap;
}

export type WeakSpot =
	| { kind: 'writing'; to: WriteTo; gap: Exclude<PoliteGap, 'fits'>; off: number; of: number; href: string }
	| { kind: 'kanji'; chars: string[]; href: string }
	| { kind: 'weakest'; misses: number; href: string };

export interface Week {
	/** photos read and words looked up */
	read: number;
	/** messages checked in the Writing helper */
	wrote: number;
	/** cards you made */
	saved: number;
	/** review minutes per local day, oldest first, today last */
	minutes: { day: string; value: number }[];
	totalMinutes: number;
	activeDays: number;
	weak: WeakSpot | null;
}

export interface WeekInput {
	logs: readonly { cardId: string; grade: Grade; reviewedAt: number; durationMs: number }[];
	cards: readonly UserCard[];
	writeChecks: readonly WriteCheck[];
	forgotten: readonly Slipped[];
	now?: number;
}

/** YYYY-MM-DD in local time. */
export const localDay = (t: number) => new Date(t).toLocaleDateString('en-CA');

/** Midnight (local) at the start of the 7-day window that ends today. */
export function weekStart(now: number): number {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - (DAYS - 1));
	return d.getTime();
}

/** A person you write to is a weak spot when at least 2 messages to them were off, and at least half. */
function writingSpot(checks: readonly WriteCheck[]): WeakSpot | null {
	let best: WeakSpot | null = null;
	const people = new Set(checks.map((c) => c.to));
	for (const to of people) {
		const mine = checks.filter((c) => c.to === to);
		const off = mine.filter((c) => c.gap !== 'fits');
		if (off.length < 2 || off.length * 2 < mine.length) continue;
		const casual = off.filter((c) => c.gap === 'tooCasual').length;
		const gap = casual * 2 >= off.length ? 'tooCasual' : 'tooFormal';
		if (!best || (best.kind === 'writing' && off.length > best.off)) best = { kind: 'writing', to, gap, off: off.length, of: mine.length, href: '/ai/write' };
	}
	return best;
}

export function weekReport({ logs, cards, writeChecks, forgotten, now = Date.now() }: WeekInput): Week {
	const since = weekStart(now);
	const inWeek = (t: number) => t >= since && t <= now;

	const reads = new Set<string>();
	for (const c of cards) {
		if (c.deleted) continue;
		for (const s of c.seen?.recent ?? []) {
			if ((s.via === 'photo' || s.via === 'lookup') && inWeek(s.at)) reads.add(`${s.via}:${s.ctx ?? Math.round(s.at / 60_000)}`);
		}
	}
	const checks = writeChecks.filter((c) => inWeek(c.at));
	const saved = cards.filter((c) => !c.deleted && c.source === 'user' && inWeek(c.createdAt)).length;

	const days: string[] = [];
	for (let i = 0; i < DAYS; i++) {
		const d = new Date(since);
		d.setDate(d.getDate() + i);
		days.push(localDay(d.getTime()));
	}
	const ms = new Map(days.map((d) => [d, 0]));
	const weekLogs = logs.filter((l) => inWeek(l.reviewedAt));
	for (const l of weekLogs) {
		const d = localDay(l.reviewedAt);
		if (ms.has(d)) ms.set(d, ms.get(d)! + Math.max(0, l.durationMs));
	}
	const minutes = days.map((day) => ({ day, value: Math.round(ms.get(day)! / 60_000) }));
	const misses = weekLogs.filter((l) => l.grade === Again).length;

	const weak: WeakSpot | null =
		writingSpot(checks) ??
		(forgotten.length ? { kind: 'kanji', chars: forgotten.slice(0, 3).map((k) => k.char), href: '/review?practice=forgetting' } : null) ??
		(misses ? { kind: 'weakest', misses, href: '/review?practice=weakest' } : null);

	return {
		read: reads.size,
		wrote: checks.length,
		saved,
		minutes,
		totalMinutes: minutes.reduce((n, d) => n + d.value, 0),
		activeDays: days.filter((d) => ms.get(d)! > 0).length,
		weak
	};
}

/** Keep only checks from the last `days` days (the stored list never grows past that). */
export const keepRecentChecks = (checks: readonly WriteCheck[], now = Date.now(), days = 60) => checks.filter((c) => now - c.at <= days * DAY_MS);
