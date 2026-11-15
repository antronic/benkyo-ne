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
	/** first-run questions that set up the plan (after the intro, before sign-up) */
	showOnboarding: false,
	/** beta sign-up / sign-in after the introduction (passkey only) */
	showWelcome: false,
	/** Kuri's first meeting: once, after onboarding (and once for existing users on Today) */
	showKuriIntro: false
});
