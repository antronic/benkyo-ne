/** A made-up feedback API for /design: votes and reports stay in memory, nothing is sent. */
import { FeedbackRequestError, type FeedbackApi } from './client.ts';

export function fakeFeedback(opts: { fail?: boolean } = {}): FeedbackApi {
	const wait = () => new Promise((r) => setTimeout(r, 400));
	const reported = new Set<string>();
	return {
		mine: async () => ({ votes: { 'kanji:日': 1 } }),
		vote: async (_s, _l, vote) => {
			await wait();
			if (opts.fail) throw new FeedbackRequestError(0, 'offline', 'offline');
			return { vote };
		},
		report: async (subject) => {
			await wait();
			if (opts.fail) throw new FeedbackRequestError(0, 'network', 'network');
			if (reported.has(subject)) throw new FeedbackRequestError(409, 'already_reported', 'already');
			reported.add(subject);
			return { ok: true };
		}
	};
}
