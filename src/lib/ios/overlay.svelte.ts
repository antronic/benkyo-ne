/**
 * App-level overlays: iOS-style action sheets and toasts (HUDs).
 * Rendered once by <Overlays/> in the root layout.
 */
import { t } from '#lib/i18n/index.svelte.ts';

export interface SheetAction {
	label: string;
	role?: 'destructive' | 'cancel';
}

interface ActionSheetState {
	title?: string;
	message?: string;
	actions: SheetAction[];
	resolve: (index: number) => void;
}

export const overlay = $state({
	sheet: null as ActionSheetState | null,
	toast: null as { text: string; icon?: string; busy?: boolean; id: number } | null
});

/** Resolves with the chosen action index, or -1 when cancelled. */
export function actionSheet(opts: Omit<ActionSheetState, 'resolve'>): Promise<number> {
	return new Promise((resolve) => {
		overlay.sheet = {
			...opts,
			resolve: (i) => {
				overlay.sheet = null;
				resolve(i);
			}
		};
	});
}

export async function confirmDestructive(title: string, message: string, confirmLabel: string) {
	const i = await actionSheet({
		title,
		message,
		actions: [{ label: confirmLabel, role: 'destructive' }, { label: t('common.cancel'), role: 'cancel' }]
	});
	return i === 0;
}

let toastTimer: ReturnType<typeof setTimeout>;
export function toast(text: string, icon?: string, ms = 1800) {
	clearTimeout(toastTimer);
	overlay.toast = { text, icon, id: Date.now() };
	toastTimer = setTimeout(() => (overlay.toast = null), ms);
}

/** A toast with a spinner for work the user didn't start on screen (a link's promo code being used). Stays until the next toast() or clearToast(); gives up after `ms`. */
export function busyToast(text: string, ms = 15000) {
	clearTimeout(toastTimer);
	overlay.toast = { text, busy: true, id: Date.now() };
	toastTimer = setTimeout(() => (overlay.toast = null), ms);
}

export function clearToast() {
	clearTimeout(toastTimer);
	overlay.toast = null;
}
