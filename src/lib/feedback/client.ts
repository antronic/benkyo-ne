/**
 * Browser client for content feedback (worker/feedback.ts). Errors carry a
 * `problem` so the screen can say what to do next.
 */
import type { FeedbackReason, MyVotes, Vote } from './contract.ts';

export type FeedbackProblem = 'offline' | 'network' | 'signed_out' | 'already_reported' | 'rate_limited' | 'other';

export class FeedbackRequestError extends Error {
	constructor(
		public status: number,
		public problem: FeedbackProblem,
		message: string
	) {
		super(message);
	}
}

async function call<T>(method: string, path: string, json?: unknown): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new FeedbackRequestError(0, 'offline', 'offline');
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: json === undefined ? undefined : { 'content-type': 'application/json' },
			body: json === undefined ? undefined : JSON.stringify(json)
		});
	} catch {
		throw new FeedbackRequestError(0, 'network', 'network');
	}
	const body = (await res.json().catch(() => null)) as { problem?: string; error?: string; message?: string } | null;
	if (!res.ok) {
		const problem: FeedbackProblem =
			res.status === 401 ? 'signed_out' : body?.problem === 'already_reported' ? 'already_reported' : res.status === 429 ? 'rate_limited' : 'other';
		throw new FeedbackRequestError(res.status, problem, body?.message ?? `HTTP ${res.status}`);
	}
	return body as T;
}

export const feedbackApi = {
	mine: () => call<MyVotes>('GET', '/api/feedback/mine'),
	vote: (subject: string, label: string, vote: Vote) => call<{ vote: Vote }>('POST', '/api/feedback/vote', { subject, label, vote }),
	report: (subject: string, label: string, reason: FeedbackReason, detail: string, locale: string) =>
		call<{ ok: true }>('POST', '/api/feedback/report', { subject, label, reason, detail, locale })
};
export type FeedbackApi = typeof feedbackApi;

/** What to tell the learner when a call fails, as a message key. */
export const feedbackProblemKey = (e: unknown) => `feedback.err.${e instanceof FeedbackRequestError ? e.problem : 'other'}` as const;
