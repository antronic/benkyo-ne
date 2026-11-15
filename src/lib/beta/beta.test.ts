import { describe, expect, it } from 'vitest';
import { REDACTED, scrub, scrubText } from './scrub.ts';
import { MAX_EVENTS_PER_BATCH, parseEvents, takeBatch } from './contract.ts';

describe('scrub', () => {
	it('drops secret-looking fields at any depth', () => {
		expect(scrub({ apiKey: 'x', nested: { token: 'y', ok: 1, recoveryCode: 'z' }, api_key: 'w', authorization: 'b' })).toEqual({
			nested: { ok: 1 }
		});
	});
	it('redacts key-like text', () => {
		expect(scrubText('my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz ok')).toBe(`my key is ${REDACTED} ok`);
		expect(scrubText('sk-or-v1-0123456789abcdef0123')).toBe(REDACTED);
		expect(scrubText('Bearer abcdefghijklmnopqrstuv')).toBe(REDACTED);
		expect(scrubText('ABCDE-FGHJK-MNPQR-STVWX')).toBe(REDACTED);
	});
	it('leaves normal learning text alone', () => {
		expect(scrubText('What does 勉強 mean? sk is fine, so is task-list')).toBe('What does 勉強 mean? sk is fine, so is task-list');
		expect(scrub({ cardId: 'kana:あ', grade: 3, keyboard: 'ja' })).toEqual({ cardId: 'kana:あ', grade: 3, keyboard: 'ja' });
	});
});

describe('parseEvents', () => {
	const now = Date.UTC(2026, 10, 15);
	const ok = { at: now - 1000, kind: 'progress', name: 'review', sid: 's1', data: { grade: 3 } };

	it('keeps valid events and drops bad ones', () => {
		const out = parseEvents({ events: [ok, { ...ok, kind: 'ai' }, { ...ok, name: 'Bad Name' }, null, 'x'] }, now);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ kind: 'progress', name: 'review', at: now - 1000, data: { grade: 3 } });
	});
	it('replaces nonsense times with the receive time', () => {
		expect(parseEvents({ events: [{ ...ok, at: 5 }] }, now)[0].at).toBe(now);
		expect(parseEvents({ events: [{ ...ok, at: now + 30 * 86_400_000 }] }, now)[0].at).toBe(now);
	});
	it('scrubs data and caps size and count', () => {
		expect(parseEvents({ events: [{ ...ok, data: { apiKey: 'sk-ant-123', note: 'x' } }] }, now)[0].data).toEqual({ note: 'x' });
		expect(parseEvents({ events: [{ ...ok, data: { big: 'a'.repeat(20000) } }] }, now)[0].data).toEqual({ truncated: true });
		expect(parseEvents({ events: Array(500).fill(ok) }, now)).toHaveLength(MAX_EVENTS_PER_BATCH);
	});
	it('handles a missing or malformed body', () => {
		expect(parseEvents(null)).toEqual([]);
		expect(parseEvents({ events: 'nope' })).toEqual([]);
	});
});

describe('scrub field names', () => {
	it('keeps token counts but drops tokens', () => {
		expect(scrub({ inputTokens: 5, outputTokens: 2, sessionToken: 'x', key: 'y', keys: 3 })).toEqual({ inputTokens: 5, outputTokens: 2, keys: 3 });
	});
});

describe('takeBatch', () => {
	const ev = (n: number) => ({ at: 1, kind: 'error' as const, name: 'x', sid: 's', data: { m: 'a'.repeat(n) } });
	it('caps by count', () => {
		expect(takeBatch(Array.from({ length: 250 }, () => ev(10)))).toHaveLength(MAX_EVENTS_PER_BATCH);
	});
	it('caps by bytes but always takes at least one', () => {
		expect(takeBatch(Array.from({ length: 100 }, () => ev(8000))).length).toBeLessThan(30);
		expect(takeBatch([ev(500_000)])).toHaveLength(1);
		expect(takeBatch([])).toEqual([]);
	});
});
