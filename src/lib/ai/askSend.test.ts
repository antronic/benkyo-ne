import { describe, expect, it } from 'vitest';
import { answerLast } from './askSend.ts';
import type { AskThread } from './threads.ts';

const thread = (): AskThread => ({ id: 't', title: 'x', createdAt: 1, updatedAt: 1, msgs: [{ role: 'user', text: 'Is it polite?' }], focus: { word: '食べる', reading: 'たべる', meaning: 'to eat' } });
const ctx = { knownKana: ['た'], secondLang: null };
const abort = new AbortController().signal;

describe('answerLast', () => {
	it('sends the word and adds the answer', async () => {
		const t = thread();
		let sent: unknown = null;
		const r = await answerLast(t, ctx, () => {}, abort, async (req, on) => {
			sent = req;
			on('Plain form.');
			return { answer: 'Plain form.', answer2: null, examples: [] };
		});
		expect(r).toEqual({ ok: true });
		expect(sent).toMatchObject({ focus: { word: '食べる' }, turns: [{ role: 'user', text: 'Is it polite?' }] });
		expect(t.msgs.at(-1)).toMatchObject({ role: 'assistant', text: 'Plain form.' });
	});
	it('keeps what was written when the reply stops early', async () => {
		const t = thread();
		const r = await answerLast(t, ctx, () => {}, abort, async (_req, on) => {
			on('Half an answer');
			throw new Error('Connection lost');
		});
		expect(r).toEqual({ ok: false, stopped: false, kept: true, message: 'Connection lost' });
		expect(t.msgs.at(-1)).toMatchObject({ role: 'assistant', partial: true, text: 'Half an answer' });
	});
	it('takes the question back out when nothing came', async () => {
		const t = thread();
		const stop = Object.assign(new Error('stopped'), { name: 'AbortError' });
		const r = await answerLast(t, ctx, () => {}, abort, async () => {
			throw stop;
		});
		expect(r).toEqual({ ok: false, stopped: true, kept: false, message: null });
		expect(t.msgs).toHaveLength(0);
	});
});
