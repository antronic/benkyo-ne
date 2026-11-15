/**
 * AI availability for the UI. AI is optional everywhere: features degrade to
 * dictionary-only when you're signed out, offline, have no key, or the
 * monthly cap is reached.
 */
import * as api from '#lib/ai/client.ts';
import type { CredentialInfo, Me, Usage } from '#lib/ai/contract.ts';
import type { BetaStatus } from '#lib/beta/contract.ts';
import { telemetry } from '#lib/beta/telemetry.svelte.ts';

class Ai {
	checked = $state(false);
	signedIn = $state(false);
	account = $state<Me['account']>(null);
	signupOpen = $state(true);
	credentials = $state<CredentialInfo[]>([]);
	usage = $state<Usage | null>(null);
	online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	/** beta consent for the signed-in account (null: signed out, or an older server) */
	beta = $state<BetaStatus | null>(null);
	/** signed in but hasn't agreed to the current beta consent: the consent screen shows */
	needsConsent = $derived(this.signedIn && !!this.beta && this.beta.acceptedVersion !== this.beta.version);

	available = $derived(
		this.online &&
			this.signedIn &&
			!this.needsConsent &&
			this.credentials.length > 0 &&
			(!this.usage || this.usage.spentUsd < this.usage.capUsd)
	);

	/** Why AI isn't available, for a friendly inline hint. */
	reason = $derived(
		!this.online
			? 'You’re offline. AI parts will run when you reconnect.'
			: !this.signedIn
				? 'Sign in or create an account in Settings to use AI.'
				: this.needsConsent
					? 'Agree to the beta terms to use AI.'
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
			this.beta = m.signedIn ? (m.beta ?? null) : null;
			telemetry.setEnabled(m.signedIn && !!m.beta && m.beta.acceptedVersion === m.beta.version, m.account?.id ?? null);
			if (m.signedIn && this.needsConsent) {
				// AI routes refuse until the consent is given
				this.credentials = [];
				this.usage = null;
			} else if (m.signedIn) {
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
