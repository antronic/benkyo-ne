/**
 * Haptics that actually fire on iPhone.
 *
 * iOS Safari has no Vibration API. Since iOS 18, toggling a native
 * `<input type="checkbox" switch>` plays the system "selection" haptic, also
 * when the toggle comes from a click on its <label>. This file keeps one
 * hidden switch and clicks its label. On Android/desktop we use
 * navigator.vibrate. Haptics only fire from inside a user gesture.
 */
export type HapticKind = 'selection' | 'success' | 'warning' | 'error' | 'impact';

const PATTERNS: Record<HapticKind, number[]> = {
	selection: [6],
	impact: [10],
	success: [8, 60, 12],
	warning: [12, 80, 12],
	error: [14, 50, 14, 50, 14]
};

let label: HTMLLabelElement | null = null;

function iosTick() {
	if (!label) {
		label = document.createElement('label');
		label.setAttribute('aria-hidden', 'true');
		label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px';
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.setAttribute('switch', '');
		input.tabIndex = -1;
		label.append(input);
		document.body.append(label);
	}
	label.click();
}

const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function haptic(kind: HapticKind = 'selection') {
	if (typeof document === 'undefined') return;
	const pattern = PATTERNS[kind];
	if (canVibrate()) {
		navigator.vibrate(pattern);
		return;
	}
	// iOS: one system tick per pulse, ~70 ms apart (the system tick has a fixed strength).
	const pulses = Math.ceil(pattern.length / 2);
	for (let i = 0; i < pulses; i++) setTimeout(iosTick, i * 70);
}
