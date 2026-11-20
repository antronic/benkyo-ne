import { describe, expect, it } from 'vitest';
import { FeedbackRequestError, type FeedbackApi } from '#lib/feedback/client.ts';
import type { Vote } from '#lib/feedback/contract.ts';

const { feedback } = await import('./feedback.svelte.ts');

function api(fail = false) {
	const sent: [string, Vote][] = [];
	const a: FeedbackApi = {
		mine: async () => ({ votes: { 'kanji:日': 1 } }),
		vote: async (s, _l, v) => {
			if (fail) throw new FeedbackRequestError(0, 'offline', 'offline');
			sent.push([s, v]);
			return { vote: v };
		},
		report: async () => ({ ok: true })
	};
	return { a, sent };
}

describe('feedback store', () => {
	it('loads your votes once per account', async () => {
		const { a } = api();
		await feedback.ensure(7, a);
		expect(feedback.of('kanji:日')).toBe(1);
		expect(feedback.of('kanji:月')).toBe(0);
	});

	it('shows a vote at once, takes it back with 0, and undoes a vote the server refused', async () => {
		const { a, sent } = api();
		await feedback.ensure(8, a);
		await feedback.set('unit:n5-01', 'Greetings', -1, a);
		expect(feedback.of('unit:n5-01')).toBe(-1);
		await feedback.set('unit:n5-01', 'Greetings', 0, a);
		expect(feedback.of('unit:n5-01')).toBe(0);
		expect(sent).toEqual([['unit:n5-01', -1], ['unit:n5-01', 0]]);

		const bad = api(true).a;
		await expect(feedback.set('kanji:日', '日', -1, bad)).rejects.toThrow();
		expect(feedback.of('kanji:日')).toBe(1);
	});
});
