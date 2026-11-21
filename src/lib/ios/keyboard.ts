/**
 * Keep the on-screen keyboard up between two typed answers.
 *
 * iOS Safari only raises the keyboard for a focus() that runs inside a tap or
 * key handler, so a field that mounts a moment later (after a transition or the
 * auto-advance delay) gets focus but no keyboard. The fix: in the tap that moves
 * on, focus a hidden stand-in input (the keyboard opens for it), then hand focus
 * to the real field when it mounts. iOS keeps the keyboard up when focus moves
 * from one text input to another, even outside the gesture.
 *
 * Elsewhere (desktop, Android) this is harmless: the field simply takes focus.
 */

let proxy: HTMLInputElement | null = null;
let timer = 0;

/** How long the stand-in waits for the real field before letting the keyboard go. */
const HOLD_MS = 2500;

/** Call inside the tap or key handler that leads to a screen with a text field. */
export function holdKeyboard(): void {
	if (typeof document === 'undefined') return;
	if (!proxy) {
		proxy = document.createElement('input');
		proxy.type = 'text';
		proxy.tabIndex = -1;
		proxy.autocomplete = 'off';
		proxy.setAttribute('aria-hidden', 'true');
		proxy.setAttribute('autocapitalize', 'off');
		proxy.setAttribute('autocorrect', 'off');
		// 16px stops iOS from zooming in on focus; fixed + transparent keeps it off the layout
		Object.assign(proxy.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '1px',
			height: '1px',
			opacity: '0',
			border: '0',
			padding: '0',
			fontSize: '16px',
			pointerEvents: 'none'
		});
		document.body.appendChild(proxy);
	}
	proxy.focus({ preventScroll: true });
	clearTimeout(timer);
	timer = window.setTimeout(releaseKeyboard, HOLD_MS);
}

/** Drop the stand-in (the keyboard closes if nothing else took focus). */
export function releaseKeyboard(): void {
	clearTimeout(timer);
	if (!proxy) return;
	if (document.activeElement === proxy) proxy.blur();
	proxy.remove();
	proxy = null;
}

/**
 * Focus a freshly shown answer field so the learner can type right away.
 * Leaves focus alone when the learner is already in another live control.
 */
export function focusField(el: HTMLInputElement | null | undefined): void {
	if (!el || !el.isConnected) return;
	const active = document.activeElement as HTMLElement | null;
	const busyElsewhere = active && active !== document.body && active !== proxy && active !== el && active.isConnected;
	if (!busyElsewhere) el.focus({ preventScroll: true });
	if (proxy) {
		clearTimeout(timer);
		proxy.remove();
		proxy = null;
	}
}
