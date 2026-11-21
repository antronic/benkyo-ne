/**
 * The app's main navigation (docs/DESIGN-SYSTEM.md, "Navigation for many items").
 *
 * Five places (docs/UX-FLOW.md, phase 4): Today, Learn, Review, Words, Settings. Kana lives
 * inside Learn, Ask AI and Community inside Words (`also` marks the screens a tab holds,
 * so the tab lights up on them). Five fit every bar, so there is no More tab; the pins and More
 * sheet below stay for a longer list.
 *
 * One list for every layout. The layouts pick from it:
 *   bottom bar (phone, unfolded Duo portrait, iPad portrait) and the folded side
 *     column: the learner's pinned tabs, then "More" for the rest;
 *   side rail (RAIL_QUERY): every item in groups, Settings at the bottom, unless the
 *     screen is too short, then it falls back to pinned tabs + More;
 *   sidebar (SIDEBAR_QUERY, desktop): every item with its label, under group headings.
 */
import type { MessageKey } from '#lib/i18n/index.svelte.ts';

export type NavGroup = 'study' | 'make' | 'people' | 'you';

export interface NavItem {
	href: string;
	label: MessageKey;
	/** one line under the label in the More sheet */
	desc: MessageKey;
	/** SVG path (24×24, stroked); empty for the kana glyph */
	icon: string;
	group: NavGroup;
	/** other top-level screens this tab holds (Kana in Learn) */
	also?: string[];
}

export const NAV_ITEMS: NavItem[] = [
	{ href: '/', label: 'nav.today', desc: 'nav.desc.today', group: 'study', icon: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z' },
	{ href: '/learn', label: 'nav.learn', desc: 'nav.desc.learn', group: 'study', also: ['/kana'], icon: 'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19' },
	{ href: '/review', label: 'nav.review', desc: 'nav.desc.review', group: 'study', icon: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' },
	{ href: '/words', label: 'nav.words', desc: 'nav.desc.words', group: 'make', also: ['/ai', '/community'], icon: 'M8.5 4H18a2 2 0 0 1 2 2v9.5M6 7.5h9.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2zM7.5 12h6.5M7.5 15.5h4' },
	{ href: '/settings', label: 'nav.settings', desc: 'nav.desc.settings', group: 'you', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z' }
];

export const MORE_ICON = 'M5.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM5.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z';

export const GROUP_LABEL: Record<NavGroup, MessageKey> = {
	study: 'nav.group.study',
	make: 'nav.group.make',
	people: 'nav.group.people',
	you: 'nav.group.you'
};

/** Pinned tabs on a new device, in order: the daily loop first. */
export const DEFAULT_PINS = ['/', '/learn', '/review', '/words', '/settings'];

/** How many tabs a bottom bar holds (More included): 5 on a phone, 7 from 600 px. */
export function barSlots(width: number): number {
	return width >= 600 ? 7 : 5;
}

/** Most tabs a learner can pin (the widest bar, less the More tab). */
export const MAX_PINS = 6;

/** The item a path belongs to (a lesson belongs to Learn), or null for screens outside the nav. */
export function itemFor(path: string, items: NavItem[] = NAV_ITEMS): NavItem | null {
	if (path === '/') return items.find((i) => i.href === '/') ?? null;
	const under = (h: string) => path === h || path.startsWith(h + '/');
	return items.find((i) => i.href !== '/' && (under(i.href) || i.also?.some(under))) ?? null;
}

/** Saved pins, cleaned: known items only, no repeats, in the saved order. */
export function cleanPins(saved: readonly string[] | undefined, items: NavItem[] = NAV_ITEMS): string[] {
	const known = new Set(items.map((i) => i.href));
	const out: string[] = [];
	for (const h of saved ?? DEFAULT_PINS) if (known.has(h) && !out.includes(h)) out.push(h);
	return out.slice(0, MAX_PINS);
}

/**
 * What a bar with `slots` places shows. Everything fits: every item, no More.
 * Otherwise `slots - 1` tabs, the pinned ones first (topped up from the list if fewer
 * are pinned), shown in list order, then More, which holds the rest in list order.
 */
export function splitBar(slots: number, pins: readonly string[] | undefined, items: NavItem[] = NAV_ITEMS): { tabs: NavItem[]; more: NavItem[] } {
	if (items.length <= slots) return { tabs: items, more: [] };
	const pinned = new Set(cleanPins(pins, items));
	// pinned first, then the rest, each in list order, so tabs never jump around
	const tabs = [...items.filter((i) => pinned.has(i.href)), ...items.filter((i) => !pinned.has(i.href))].slice(0, slots - 1);
	return { tabs: items.filter((i) => tabs.includes(i)), more: items.filter((i) => !tabs.includes(i)) };
}

/** Items in group order for the rail and sidebar, Settings ('you') last. */
export function grouped(items: NavItem[] = NAV_ITEMS): { group: NavGroup; items: NavItem[] }[] {
	const order: NavGroup[] = ['study', 'make', 'people', 'you'];
	return order.map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter((g) => g.items.length);
}

/** Full-screen steps (a lesson, a review, a pack, Ask AI, Fleet): no navigation bar, swipe back to leave. */
export function isImmersive(path: string): boolean {
	return /^\/(learn\/.+|review|words\/.+|ai\/.+|admin)/.test(path.split(/[?#]/)[0]);
}

/**
 * Where a full-screen step goes back to (the close button, swipe-back, Done): the screen it was
 * opened from, so a lesson opened from Today closes to Today and one opened from Learn to Learn.
 * Called on every navigation with what was saved so far; `from` and `to` are paths (with any
 * query). Moving between full-screen steps (a lesson to the next one) keeps the saved screen;
 * arriving on a normal screen, or in Fleet (it has its own trail), clears it.
 */
export function returnTarget(saved: string | null, from: string | null, to: string): string | null {
	if (!isImmersive(to) || to.startsWith('/admin')) return null;
	if (from && !isImmersive(from)) return from;
	return saved;
}
