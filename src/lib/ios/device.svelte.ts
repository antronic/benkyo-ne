/**
 * Size classes and posture, so layout follows the *space* rather than the
 * device model. On iPhone Duo:
 *   folded (outer screen, ~380–470 CSS px wide)   → compact
 *   unfolded portrait (~600–700 px, tall)          → regular, bottom tab bar
 *   unfolded landscape (~950 px)                   → regular + wide, side rail
 * Unfolded portrait is regular width but tall: a side rail there would take
 * ~15% of the width for no gain, so the tab bar stays at the bottom and the
 * content gets the full width.
 * Fold and unfold just resize the viewport. All state lives in stores, so
 * nothing is lost and the layout re-flows mid-lesson.
 */
import { MediaQuery } from 'svelte/reactivity';

export const regular = new MediaQuery('min-width: 600px');
export const wide = new MediaQuery('min-width: 900px');
/**
 * Where the tab bar becomes a side rail: regular width in landscape, or any
 * screen wide enough that the rail still leaves a roomy content column.
 * Keep in sync with the same media query in app.css and TabBar.svelte.
 */
export const RAIL_QUERY = '(min-width: 600px) and (orientation: landscape), (min-width: 840px)';
export const rail = new MediaQuery(RAIL_QUERY);
/**
 * Where the rail grows into a sidebar with labels and group headings (desktop).
 * Keep in sync with app.css and TabBar.svelte.
 */
export const SIDEBAR_QUERY = '(min-width: 1200px)';
export const sidebar = new MediaQuery(SIDEBAR_QUERY);
/**
 * Tall enough for the rail to hold every screen in src/lib/nav.ts (8 rows of 58 px,
 * group gaps and margins). Shorter (a landscape phone), the rail shows the pinned
 * tabs and More, like the bottom bar.
 */
export const railFits = new MediaQuery('(min-height: 600px)');
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
