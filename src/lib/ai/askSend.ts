/**
 * One Ask AI turn: answer the question at the end of a thread, streaming the text as it comes.
 * Shared by the Ask AI screen (/ai/ask) and the Ask AI peek on word cards (AskPeek.svelte).
 */
import * as api from './client.ts';
import type { AskRequest, AskResponse } from './contract.ts';
import { finishAskText } from './askStream.ts';
import type { AskThread } from './threads.ts';

export type AskOutcome =
	| { ok: true }
	/** kept: the part written before it stopped is in the thread; otherwise the question was taken back out */
	| { ok: false; stopped: boolean; kept: boolean; message: string | null };

type Stream = (req: AskRequest, onText: (t: string) => void, signal?: AbortSignal) => Promise<AskResponse>;

/** The thread's last message is the learner's question; the answer (or what was written of it) is added to the thread. */
export async function answerLast(
	thread: AskThread,
	ctx: { knownKana: string[]; secondLang: string | null },
	onText: (t: string) => void,
	signal: AbortSignal,
	stream: Stream = api.askStream
): Promise<AskOutcome> {
	const turns = thread.msgs.slice(-12).map((m) => ({ role: m.role, text: m.text }));
	const req: AskRequest = { turns, knownKana: ctx.knownKana, secondLang: ctx.secondLang, focus: thread.focus ?? null };
	let text = '';
	try {
		const r = await stream(
			req,
			(t) => {
				text += t;
				onText(t);
			},
			signal
		);
		thread.msgs.push({ role: 'assistant', text: r.answer, reply: r });
		return { ok: true };
	} catch (e) {
		const stopped = (e as Error)?.name === 'AbortError';
		const message = e instanceof Error && !stopped ? e.message : null;
		const partial = text ? finishAskText(text, req) : null;
		if (partial) {
			thread.msgs.push({ role: 'assistant', text: partial.answer, reply: partial, partial: true });
			return { ok: false, stopped, kept: true, message };
		}
		thread.msgs.pop();
		return { ok: false, stopped, kept: false, message };
	}
}
