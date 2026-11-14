/**
 * AI availability for the UI. AI is optional everywhere: features degrade to
 * dictionary-only when you're signed out, offline, have no key, or the
 * monthly cap is reached.
 */
import * as api from '#lib/ai/client.ts';
import type { CredentialInfo, Me, Usage } from '#lib/ai/contract.ts';

class Ai {
	checked = $state(false);
	signedIn = $state(false);
	account = $state<Me['account']>(null);
	signupOpen = $state(true);
	credentials = $state<CredentialInfo[]>([]);
	usage = $state<Usage | null>(null);
	online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

	available = $derived(
		this.online &&
			this.signedIn &&
			this.credentials.length > 0 &&
			(!this.usage || this.usage.spentUsd < this.usage.capUsd)
	);

	/** Why AI isn't available, for a friendly inline hint. */
	reason = $derived(
		!this.online
			? 'You’re offline. AI parts will run when you reconnect.'
			: !this.signedIn
				? 'Sign in or create an account in Settings to use AI.'
				: this.credentials.length === 0
					? 'Add an API key in Settings to use AI.'
					: this.usage && this.usage.spentUsd >= this.usage.capUsd
						? 'This month’s AI spending cap is reached.'
						: ''
	);

	async refresh() {
		this.online = navigator.onLine;
		if (!this.online) return;
		try {
			const m = await api.me();
			this.signedIn = m.signedIn;
			this.account = m.account;
			this.signupOpen = m.signupOpen;
			if (m.signedIn) {
				const [creds, usage] = await Promise.all([api.listCredentials(), api.getUsage()]);
				this.credentials = creds;
				this.usage = usage;
			} else {
				this.credentials = [];
				this.usage = null;
			}
		} catch {
			// API unreachable: treat as unavailable, keep last known state
		} finally {
			this.checked = true;
		}
	}

	watch() {
		const on = () => {
			this.online = navigator.onLine;
			if (this.online) void this.refresh();
		};
		addEventListener('online', on);
		addEventListener('offline', on);
		void this.refresh();
	}
}

export const ai = new Ai();
