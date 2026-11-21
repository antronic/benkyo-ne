/** Ambient UI state shared across routes. */
export const ui = $state({
	hue: 8,
	/**
	 * Optional guard run before leaving an immersive screen (swipe-back or the
	 * close button). Return false to stay.
	 */
	backGuard: null as null | (() => Promise<boolean>),
	/** first-launch introduction overlay (replayable from Settings) */
	showIntro: false,
	/** first-run questions that set up the plan (after sign-up and the beta consent, before the avatar) */
	showOnboarding: false,
	/** the questions are waiting for sign-up (and its consent) to finish (docs/ONBOARDING.md) */
	onboardingNext: false,
	/** just signed in or up: a loading screen covers the way to the next screen (Handoff.svelte) */
	handoff: null as null | 'signin' | 'signup',
	/** beta sign-up / sign-in after the introduction (passkey only) */
	showWelcome: false,
	/** Kuri's first meeting: once, after onboarding (and once for existing users on Today) */
	showKuriIntro: false,
	/** the screen a full-screen step was opened from, to go back to (returnTarget in nav.ts) */
	returnTo: null as string | null,
	/** px of a screen's own fixed bottom bar (the Ask AI composer) that the "More below" button clears */
	scrollClear: 0
});
