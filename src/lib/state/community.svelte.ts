/**
 * Your community profile (handle, guidelines, status), loaded once per account
 * from GET /api/community/me (worker/community.ts). Shared notes themselves are
 * fetched per item by CommunityNotes.svelte and are not kept on the device.
 */
import { communityMe, setProfile } from '#lib/community/client.ts';
import type { Me } from '#lib/community/contract.ts';

class Community {
	me = $state<Me | null>(null);
	#account: number | null = null;
	#loading: Promise<Me> | null = null;

	/** Load (or reuse) the profile for this account. */
	ensure(accountId: number, load: () => Promise<Me> = communityMe): Promise<Me> {
		if (this.#account === accountId && this.me) return Promise.resolve(this.me);
		if (this.#account === accountId && this.#loading) return this.#loading;
		this.#account = accountId;
		this.me = null;
		this.#loading = load()
			.then((m) => {
				if (this.#account === accountId) this.me = m;
				return m;
			})
			.finally(() => {
				this.#loading = null;
			});
		return this.#loading;
	}

	async join(handle: string, guidelines: number, save: typeof setProfile = setProfile) {
		this.me = await save(handle, guidelines);
		return this.me;
	}
}

export const community = new Community();
