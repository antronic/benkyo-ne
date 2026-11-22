/**
 * Kuri's keep-out zones: Kuri may never cover a button, link, field or the menu bar.
 *
 * Kuri is a fixed 104px square that takes taps (drag, tap to say hi), so anywhere it stands
 * it would block what is underneath. The walker asks this module where it may stand:
 * - hard boxes (controls and fixed bars) are never covered, with a small gap around them;
 * - soft boxes (cards and text) may be covered, but a spot that covers less of them wins.
 * When no spot is free, Kuri steps away (hidden, no taps) until one is.
 *
 * The geometry is pure so vitest can check it (keepOut.test.ts); readObstacles reads the page.
 */

/** `k` weighs a soft box: text counts fully (1), a card's empty space a little */
export type Box = { x: number; y: number; w: number; h: number; k?: number };
export type Point = { x: number; y: number };
/** where Kuri's top-left corner may go */
export type Area = { left: number; top: number; right: number; bottom: number };

/** the gap Kuri keeps from any control */
export const GAP = 6;

export function hits(a: Box, b: Box, gap = 0) {
	return a.x < b.x + b.w + gap && b.x - gap < a.x + a.w && a.y < b.y + b.h + gap && b.y - gap < a.y + a.h;
}

export function overlap(a: Box, b: Box) {
	const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
}

const at = (p: Point, size: number): Box => ({ x: p.x, y: p.y, w: size, h: size });

/** Kuri at p covers no control. */
export function clear(p: Point, size: number, hard: Box[], gap = GAP) {
	const b = at(p, size);
	return !hard.some((h) => hits(b, h, gap));
}

/** Kuri can walk in a straight line from a to b without passing over a control. */
export function pathClear(a: Point, b: Point, size: number, hard: Box[], gap = GAP) {
	const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
	for (let i = 1; i <= n; i++) {
		const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
		if (!clear(p, size, hard, gap)) return false;
	}
	return true;
}

/** How much of Kuri at p lies over cards and text, 0 (none) to about 1 (all of it). */
export function cover(p: Point, size: number, soft: Box[]) {
	const b = at(p, size);
	let sum = 0;
	for (const s of soft) sum += overlap(b, s) * (s.k ?? 1);
	return Math.min(1, sum / (size * size));
}

export type Spot = Point & { cover: number };

/** Every free spot in the area on a grid (plus the area's corners), with how much it covers. */
export function freeSpots(area: Area, size: number, hard: Box[], soft: Box[], step = 12): Spot[] {
	const out: Spot[] = [];
	if (area.right < area.left || area.bottom < area.top) return out;
	const xs: number[] = [];
	const ys: number[] = [];
	for (let x = area.left; x < area.right; x += step) xs.push(x);
	xs.push(area.right);
	for (let y = area.top; y < area.bottom; y += step) ys.push(y);
	ys.push(area.bottom);
	for (const y of ys)
		for (const x of xs) {
			const p = { x, y };
			if (clear(p, size, hard)) out.push({ x, y, cover: cover(p, size, soft) });
		}
	return out;
}

/**
 * The best spot to move to from `from`: covers the least text, then is the closest.
 * `near` scales how much distance matters (px that cost as much as covering everything).
 */
export function nearest(spots: Spot[], from: Point, near = 600): Spot | null {
	let best: Spot | null = null;
	let score = Infinity;
	for (const s of spots) {
		const v = s.cover + Math.hypot(s.x - from.x, s.y - from.y) / near;
		if (v < score) (score = v), (best = s);
	}
	return best;
}

/**
 * A spot to wander to: one Kuri can walk to in a straight line, not too close and not too far,
 * among those that cover the least text. `rand` is Math.random, passed in for tests.
 */
export function wanderTarget(spots: Spot[], from: Point, size: number, hard: Box[], rand = Math.random, reach = 280): Spot | null {
	const options = spots.filter((s) => {
		const d = Math.hypot(s.x - from.x, s.y - from.y);
		return d > 40 && d < reach;
	});
	if (!options.length) return null;
	const least = Math.min(...options.map((s) => s.cover));
	const good = options.filter((s) => s.cover <= least + 0.15);
	for (let tries = 0; tries < 12 && good.length; tries++) {
		const i = Math.floor(rand() * good.length);
		const s = good[i];
		if (pathClear(from, s, size, hard)) return s;
		good.splice(i, 1);
	}
	return null;
}

/** Anything a tap can reach. */
export const CONTROLS =
	'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [role="menuitem"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
/** Menu bars: the tab bar, side rail and sidebar, the compact title bar, toolbars. Only counted when fixed or sticky. */
export const BARS = 'nav, header, [role="navigation"], [role="banner"], [role="toolbar"], [role="tablist"], .navbar';
/** Cards Kuri would rather not sit on (text counts more, line by line). */
export const CARDS = '.card';
const CARD_K = 0.25;

const toBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/**
 * Read the page's keep-out boxes in viewport coordinates. Elements in `skip` (Kuri itself and
 * its bubble), in a dialog (sheets sit above Kuri), hidden, or that take no taps are left out.
 */
export function readObstacles(skip: (Element | null | undefined)[]): { hard: Box[]; soft: Box[] } {
	const vw = document.documentElement.clientWidth;
	const vh = innerHeight;
	const visible = (el: Element) => {
		if (skip.some((s) => s && (s === el || s.contains(el)))) return null;
		if (el.closest('[role="dialog"], [aria-hidden="true"], [inert]')) return null;
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return null;
		const cs = getComputedStyle(el);
		if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || cs.display === 'contents') return null;
		return { r, cs };
	};
	const hard: Box[] = [];
	const soft: Box[] = [];
	for (const el of document.querySelectorAll(CONTROLS)) {
		const v = visible(el);
		if (v) hard.push(toBox(v.r));
	}
	for (const el of document.querySelectorAll(BARS)) {
		const v = visible(el);
		if (v && (v.cs.position === 'fixed' || v.cs.position === 'sticky') && v.cs.opacity !== '0') hard.push(toBox(v.r));
	}
	for (const el of document.querySelectorAll(CARDS)) {
		const v = visible(el);
		if (v) soft.push({ ...toBox(v.r), k: CARD_K });
	}
	// the text itself, one box per line, so the empty end of a heading is free to sit on
	const main = document.querySelector('main') ?? document.body;
	const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let n = walk.nextNode(); n; n = walk.nextNode()) {
		if (!n.textContent?.trim() || !n.parentElement || skip.some((s) => s?.contains(n))) continue;
		range.selectNodeContents(n);
		for (const r of range.getClientRects()) if (r.width >= 1 && r.bottom > 0 && r.top < vh) soft.push(toBox(r));
	}
	return { hard, soft };
}
