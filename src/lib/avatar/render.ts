/**
 * Drawing avatars with Coreva Render (@antronic/coreva-render) and Benkyo's style pack.
 *
 *   avatarSvg(person, size)  instant SVG markup, no GPU, works offline: every small avatar
 *   mountLive(el, person)    the live 3D avatar (looks around, follows the pointer, waves);
 *                            falls back to the SVG still by itself when the GPU or the
 *                            three.js file is not available (offline before its first use)
 *
 * three.js is not bundled: the engine imports it from /avatar/vendor/ (scripts/copy-avatar-vendor.mjs).
 */
import { avatarSVG, mountAvatar, setLiveLimit, type AvatarHandle } from '@antronic/coreva-render';
import { BENKYO_STYLE } from './pack/benkyo-style.js';
import { cleanPerson, FIXED, type Person } from './person.ts';

export const STYLE = BENKYO_STYLE;

/** The full parameter set the style draws, from a person (or a partial / stored one). */
export function params(p: Partial<Person> | Person | null | undefined): Record<string, unknown> {
	return { ...(cleanPerson(p ?? {}) as Person), ...FIXED };
}

const cache = new Map<string, string>();
/** SVG markup for a person at a CSS size. Memoised: lists draw the same people many times. */
export function avatarSvg(p: Partial<Person> | null | undefined, size: number): string {
	const prm = params(p);
	const key = JSON.stringify(prm) + '@' + size;
	let svg = cache.get(key);
	if (!svg) {
		svg = avatarSVG(prm, size, { style: STYLE });
		if (cache.size > 200) cache.delete(cache.keys().next().value as string);
		cache.set(key, svg);
	}
	return svg;
}

let limited = false;
export interface LiveOptions {
	size: number;
	wave?: boolean;
	follow?: boolean;
	onState?: (state: 'still' | 'strip' | 'live') => void;
}
/** The live avatar in el. Destroy the handle when the element goes away. */
export function mountLive(el: HTMLElement, p: Partial<Person> | null | undefined, o: LiveOptions): AvatarHandle {
	if (!limited) {
		setLiveLimit(2);
		limited = true;
	}
	return mountAvatar(el, params(p), {
		style: STYLE,
		mode: 'auto',
		size: o.size,
		wave: o.wave ?? false,
		follow: o.follow ?? true,
		threeUrl: new URL('/avatar/vendor/three.webgpu.min.js', location.href).href,
		onState: (s) => o.onState?.(s as 'still' | 'strip' | 'live')
	});
}
