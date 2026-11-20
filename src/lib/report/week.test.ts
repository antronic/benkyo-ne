import { describe, expect, it } from 'vitest';
import { keepRecentChecks, localDay, weekReport, weekStart, type WriteCheck } from './week.ts';
import type { UserCard } from '#lib/ai/contract.ts';

const DAY = 86_400_000;
const now = new Date(2026, 10, 20, 15, 0).getTime(); // local 20 Nov, 15:00

const card = (id: string, over: Partial<UserCard> = {}): UserCard => ({
	id,
	kind: 'word',
	front: 'かいぎ',
	kanji: '会議',
	gloss: 'meeting',
	gloss2: null,
	usage: null,
	hook: null,
	example: null as unknown as UserCard['example'],
	verified: true,
	source: 'user',
	tags: [],
	createdAt: now - 30 * DAY,
	updatedAt: now,
	deleted: false,
	...over
});
const log = (at: number, ms: number, grade: 1 | 3 = 3) => ({ cardId: 'kana:あ', grade, reviewedAt: at, durationMs: ms });
const empty = { logs: [], cards: [], writeChecks: [], forgotten: [], now };

describe('weekly report', () => {
	it('covers 7 local days ending today', () => {
		const r = weekReport(empty);
		expect(r.minutes.map((d) => d.day)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
		expect(localDay(weekStart(now))).toBe('2026-11-14');
		expect(r.weak).toBeNull();
	});

	it('adds review minutes per day and counts active days', () => {
		const r = weekReport({ ...empty, logs: [log(now - 60_000, 90_000), log(now - 120_000, 90_000), log(now - 2 * DAY, 60_000), log(now - 9 * DAY, 600_000)] });
		expect(r.minutes.at(-1)!.value).toBe(3);
		expect(r.minutes.at(-3)!.value).toBe(1);
		expect(r.totalMinutes).toBe(4);
		expect(r.activeDays).toBe(2);
	});

	it('counts each photo or look-up once, and only your own new cards as saved', () => {
		const seen = { count: 4, recent: [
			{ at: now - DAY, via: 'photo' as const, ctx: '会議は三時から' },
			{ at: now - 2 * DAY, via: 'lookup' as const, ctx: '会議' },
			{ at: now - 3 * DAY, via: 'writing' as const, ctx: 'x' },
			{ at: now - 20 * DAY, via: 'photo' as const, ctx: 'old' }
		] };
		const cards = [
			card('word:1', { seen, createdAt: now - DAY }),
			card('word:2', { seen: { count: 1, recent: [{ at: now - DAY, via: 'photo', ctx: '会議は三時から' }] } }),
			card('word:3', { source: 'pack', createdAt: now - DAY }),
			card('word:4', { deleted: true, createdAt: now - DAY })
		];
		const r = weekReport({ ...empty, cards });
		expect(r.read).toBe(2);
		expect(r.saved).toBe(1);
	});

	it('the weak spot is first the person your messages keep missing, then forgotten kanji, then misses', () => {
		const checks: WriteCheck[] = [
			{ at: now - DAY, to: 'boss', gap: 'tooCasual' },
			{ at: now - DAY, to: 'boss', gap: 'tooCasual' },
			{ at: now - DAY, to: 'boss', gap: 'fits' },
			{ at: now - DAY, to: 'friend', gap: 'tooFormal' }
		];
		const forgotten = [{ char: '議', misread: 2, unwritten: 0, lastAt: now }];
		expect(weekReport({ ...empty, writeChecks: checks, forgotten }).weak).toEqual({ kind: 'writing', to: 'boss', gap: 'tooCasual', off: 2, of: 3, href: '/ai/write' });
		expect(weekReport({ ...empty, writeChecks: checks.slice(2), forgotten }).weak).toEqual({ kind: 'kanji', chars: ['議'], href: '/review?practice=forgetting' });
		expect(weekReport({ ...empty, logs: [log(now - DAY, 1000, 1)] }).weak).toEqual({ kind: 'weakest', misses: 1, href: '/review?practice=weakest' });
		expect(weekReport({ ...empty, writeChecks: checks }).wrote).toBe(4);
	});

	it('keeps 60 days of checks', () => {
		expect(keepRecentChecks([{ at: now - 61 * DAY, to: 'boss', gap: 'fits' }, { at: now - DAY, to: 'boss', gap: 'fits' }], now)).toHaveLength(1);
	});
});
