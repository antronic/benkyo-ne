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
