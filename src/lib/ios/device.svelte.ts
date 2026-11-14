/**
 * Size classes and posture, so layout follows the *space* rather than the
 * device model. On iPhone Duo:
 *   folded (outer screen, ~380–470 CSS px wide)   → compact
 *   unfolded portrait (~600–670 px)                → regular
 *   unfolded landscape (~950 px)                   → regular + wide
 * Fold and unfold just resize the viewport. All state lives in stores, so
 * nothing is lost and the layout re-flows mid-lesson.
 */
import { MediaQuery } from 'svelte/reactivity';

export const regular = new MediaQuery('min-width: 600px');
export const wide = new MediaQuery('min-width: 900px');
/** Two side-by-side viewport segments (open device across the hinge). Progressive enhancement. */
export const spanning = new MediaQuery('(horizontal-viewport-segments: 2)');
export const standalone = new MediaQuery('(display-mode: standalone)');
export const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

/**
 * Side safe-area insets, measured from CSS env() via a probe element.
 * iOS 27 can put the status bar in a column on the right edge (e.g. a
 * folded iPhone Duo); when that column is wide enough, the tab bar can
 * live there as a vertical icon rail.
 */
class Insets {
	left = $state(0);
	right = $state(0);
	private probe: HTMLDivElement | null = null;

	measure = () => {
		if (typeof document === 'undefined') return;
		if (!this.probe) {
			this.probe = document.createElement('div');
			this.probe.style.cssText =
				'position:fixed;visibility:hidden;pointer-events:none;top:0;height:0;' +
				'padding-left:var(--safe-left);padding-right:var(--safe-right)';
			document.body.append(this.probe);
		}
		const cs = getComputedStyle(this.probe);
		this.left = parseFloat(cs.paddingLeft) || 0;
		this.right = parseFloat(cs.paddingRight) || 0;
	};

	watch() {
		this.measure();
		addEventListener('resize', this.measure);
		addEventListener('orientationchange', () => setTimeout(this.measure, 300));
	}
}

export const insets = new Insets();
/** Minimum side column (pt) that fits a 44pt icon rail with breathing room. */
export const SIDE_RAIL_MIN = 52;
