/**
 * AI availability for the UI. AI is optional everywhere: features degrade to
 * dictionary-only when you're signed out, offline, have no key, or the
 * monthly cap is reached.
 */
import * as api from '#lib/ai/client.ts';
import type { CredentialInfo, Me, Usage } from '#lib/ai/contract.ts';
import type { BetaStatus } from '#lib/beta/contract.ts';
import { telemetry } from '#lib/beta/telemetry.svelte.ts';
import { t } from '#lib/i18n/index.svelte.ts';

class Ai {
	checked = $state(false);
	/** /api/auth/me answered this session, so signedIn is the server's word (not just the default) */
	reached = $state(false);
	signedIn = $state(false);
	account = $state<Me['account']>(null);
	signupOpen = $state(true);
	/** closed, but an invite code still works */
	signupInvite = $state(false);
	appleEnabled = $state(false);
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
			? t('ai.reason.offline')
			: !this.signedIn
				? t('ai.reason.signIn')
				: this.needsConsent
					? t('ai.reason.consent')
					: this.credentials.length === 0
					? t('ai.reason.noKey')
					: this.usage && this.usage.spentUsd >= this.usage.capUsd
						? t('ai.reason.cap')
						: ''
	);

	async refresh() {
		this.online = navigator.onLine;
		if (!this.online) return;
		try {
			const m = await api.me();
			this.signedIn = m.signedIn;
			this.account = m.account;
			this.reached = true;
			this.signupOpen = m.signupOpen;
			this.signupInvite = !!m.signupInvite;
			this.appleEnabled = !!m.appleEnabled;
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
