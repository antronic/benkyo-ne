/** Ambient UI state shared across routes. */
export const ui = $state({
	hue: 8,
	/**
	 * Optional guard run before leaving an immersive screen (swipe-back or the
	 * close button). Return false to stay.
	 */
	backGuard: null as null | (() => Promise<boolean>),
	/** first-launch introduction overlay (replayable from Settings) */
	showIntro: false
});
