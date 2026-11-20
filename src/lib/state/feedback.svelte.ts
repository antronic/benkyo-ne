/**
 * Your thumbs on lessons, units and words (lib/feedback), loaded once per
 * account from GET /api/feedback/mine and kept in memory. A vote shows at once
 * and goes back if the server refuses it.
 */
import { feedbackApi, type FeedbackApi } from '#lib/feedback/client.ts';
import type { Vote } from '#lib/feedback/contract.ts';

class Feedback {
	votes = $state<Record<string, 1 | -1>>({});
	#account: number | null = null;
	#loading: Promise<void> | null = null;

	ensure(accountId: number, api: FeedbackApi = feedbackApi): Promise<void> {
		if (this.#account === accountId) return this.#loading ?? Promise.resolve();
		this.#account = accountId;
		this.votes = {};
		this.#loading = api
			.mine()
			.then((m) => {
				if (this.#account === accountId) this.votes = m.votes;
			})
			.catch(() => {
				// offline or signed out: no thumbs lit yet; try again next time
				if (this.#account === accountId) this.#account = null;
			})
			.finally(() => {
				this.#loading = null;
			});
		return this.#loading;
	}

	of(subject: string): Vote {
		return this.votes[subject] ?? 0;
	}

	async set(subject: string, label: string, vote: Vote, api: FeedbackApi = feedbackApi) {
		const before = this.of(subject);
		this.#put(subject, vote);
		try {
			await api.vote(subject, label, vote);
		} catch (e) {
			this.#put(subject, before);
			throw e;
		}
	}

	#put(subject: string, vote: Vote) {
		const next = { ...this.votes };
		if (vote === 0) delete next[subject];
		else next[subject] = vote;
		this.votes = next;
	}
}

export const feedback = new Feedback();
