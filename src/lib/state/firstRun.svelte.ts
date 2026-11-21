/**
 * Learn first, set up later (docs/UX-FLOW.md, phase 3). A new account goes straight into its
 * first lesson; two things it would have done at sign-up wait instead, kept on this device:
 *
 * - `consentLater`: the beta consent shows after the first lesson is done (the root layout
 *   holds it back until then). AI and beta data stay off until it is given, because the Worker
 *   refuses both without it. An account that has to re-consent is not affected: only a sign-up
 *   on this device sets it.
 * - `recoveryPending`: the recovery code was not shown at sign-up; Today's set-up card makes a
 *   fresh one (`/api/auth/recovery-code`) when the learner asks. The code itself is never stored.
 */
import { get, put } from '#lib/db/idb.ts';

class FirstRun {
	consentLater = $state(false);
	recoveryPending = $state(false);

	async load() {
		const [c, r] = await Promise.all([get<boolean>('meta', 'consentLater'), get<boolean>('meta', 'recoveryPending')]);
		this.consentLater = !!c;
		this.recoveryPending = !!r;
	}
	setConsentLater(v: boolean) {
		this.consentLater = v;
		return put('meta', v, 'consentLater').catch(() => {});
	}
	setRecoveryPending(v: boolean) {
		this.recoveryPending = v;
		return put('meta', v, 'recoveryPending').catch(() => {});
	}
}

export const firstRun = new FirstRun();
