import { goto } from '$app/navigation';
import { ui } from './ui.svelte.ts';

/**
 * Leave a full-screen step: back to the screen it was opened from (ui.returnTo, kept by the root
 * layout), or to `fallback` when there is none (the step was opened from a link or a reload).
 */
export function leave(fallback: string) {
	return goto(ui.returnTo ?? fallback);
}
