/**
 * The signed-in learner's avatar (docs/AVATAR.md).
 *
 * The account holds it (GET /api/auth/me → account.avatar); a copy in localStorage
 * (`benkyo.avatar`) keeps it on screen offline and before /api/auth/me answers.
 * `setup` opens the avatar sheet (AvatarSetup.svelte) from sign-up, the Today prompt or Settings.
 */
import * as api from '#lib/ai/client.ts';
import { ai } from '#lib/state/ai.svelte.ts';
import { telemetry } from '#lib/beta/telemetry.svelte.ts';
import { cleanPerson, compactPerson, type Person } from '#lib/avatar/person.ts';
import type { Ask } from '#lib/avatar/mapping.ts';

const KEY = 'benkyo.avatar';
type Stored = { id: number; avatar: Partial<Person> | null };

function readStored(): Stored | null {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return v && typeof v.id === 'number' ? { id: v.id, avatar: v.avatar ? compactPerson(cleanPerson(v.avatar)!) : null } : null;
	} catch {
		return null;
	}
}

class AvatarState {
	#stored = $state<Stored | null>(typeof localStorage === 'undefined' ? null : readStored());
	/** the avatar sheet: where it was opened from, or null when closed */
	setup = $state<null | 'signup' | 'prompt' | 'settings'>(null);

	/** the signed-in learner's parts; null: none (the initial shows) */
	person = $derived.by((): Partial<Person> | null => {
		const acct = ai.account;
		if (acct && acct.avatar !== undefined) return acct.avatar ?? null;
		if (!ai.reached && this.#stored) return this.#stored.avatar; // offline: the last known avatar
		return null;
	});

	/** show the one-time "Make your avatar" card on Today (existing accounts) */
	prompt = $derived(ai.reached && ai.signedIn && !ai.needsConsent && ai.account?.avatarAsked === false);

	#keep(acct: typeof ai.account, assign = true) {
		if (assign) ai.account = acct;
		if (!acct) return;
		const avatar = acct.avatar ? compactPerson(cleanPerson(acct.avatar)!) : null;
		this.#stored = { id: acct.id, avatar };
		try {
			localStorage.setItem(KEY, JSON.stringify(this.#stored));
		} catch {
			/* private mode: fine, it still shows while the app is open */
		}
	}

	/** Save to the account. Throws on failure, so the sheet can say so and keep the choices. */
	async save(p: Person, how: { source: 'selfie' | 'manual'; asked: Ask[] }) {
		const me = await api.putAvatar(compactPerson(p));
		this.#keep(me.account);
		telemetry.track('event', 'avatar_saved', { source: how.source, parts: compactPerson(p), asked: how.asked });
	}

	async remove() {
		const me = await api.putAvatar(null);
		this.#keep(me.account);
		telemetry.track('event', 'avatar_removed', {});
	}

	/** "Not now" on the one-time prompt (or skipping the sign-up step). */
	async later() {
		const me = await api.avatarLater();
		this.#keep(me.account);
	}

	/** keep the offline copy in step with /api/auth/me */
	sync() {
		if (ai.account) this.#keep($state.snapshot(ai.account), false);
		else if (ai.reached && !ai.signedIn) {
			this.#stored = null;
			try {
				localStorage.removeItem(KEY);
			} catch {
				/* nothing kept */
			}
		}
	}
}

export const avatar = new AvatarState();
