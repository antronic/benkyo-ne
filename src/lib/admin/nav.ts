/**
 * Fleet console navigation: every page under src/routes/admin, its place in
 * the sidebar and its breadcrumb trail. A new Fleet page goes here too;
 * `npm run check:layout` fails when a page under /admin is not reachable from
 * this nav or does not show where you are (scripts/check-layout.mjs, flow pass).
 */
import type { SideNavItem } from '#lib/ui/index.ts';

export const FLEET_HOME = '/admin';
/** where "Back to Benkyo" goes (the console is opened from Settings) */
export const FLEET_EXIT = '/settings';
/** Wide enough for the sidebar plus the 820px Fleet column; narrower screens get the menu pill. Also in admin.css. */
export const FLEET_SIDEBAR_QUERY = '(min-width: 960px)';

export const FLEET_NAV: SideNavItem[] = [
	{ href: '/admin', label: 'Overview', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' },
	{ href: '/admin/accounts', label: 'Accounts', group: 'People', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0' },
	{ href: '/admin/community', label: 'Community', group: 'People', icon: 'M7 10h10M7 14h6M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2z' },
	{ href: '/admin/feedback', label: 'Feedback', group: 'People', icon: 'M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 3 2l-1 4h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7' },
	{ href: '/admin/invitations', label: 'Invitations', group: 'People', icon: 'M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z' },
	{ href: '/admin/settings', label: 'Sign-up settings', group: 'People', icon: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4' },
	{ href: '/admin/packages', label: 'Packages', group: 'Plans', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
	{ href: '/admin/promos', label: 'Promo codes', group: 'Plans', icon: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM10 5v14' },
	{ href: '/admin/ai', label: 'AI providers', group: 'Plans', icon: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' },
	{ href: '/admin/usage', label: 'Usage', group: 'Plans', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
	{ href: '/admin/system', label: 'System', group: 'Platform', icon: 'M3 12h4l2-6 4 12 2-6h6' },
	{ href: '/admin/errors', label: 'Errors', group: 'Platform', icon: 'M12 3l9.5 17h-19zM12 10v4M12 17.5v.01' },
	{ href: '/admin/audit', label: 'Audit log', group: 'Platform', icon: 'M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' }
];

/** The nav item for a path: the longest href that is the path or a parent of it. */
export function fleetSection(path: string): SideNavItem | null {
	const p = path.replace(/\/+$/, '') || '/';
	let best: SideNavItem | null = null;
	for (const it of FLEET_NAV) {
		if ((p === it.href || p.startsWith(it.href + '/')) && (!best || it.href.length > best.href.length)) best = it;
	}
	return best;
}

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumbs for a Fleet path: Fleet › section › detail. `detail` names a
 * detail page (the account's name); the overview has no trail.
 */
export function fleetTrail(path: string, detail?: string | null): Crumb[] {
	const p = path.replace(/\/+$/, '');
	const section = fleetSection(p);
	if (!section || section.href === FLEET_HOME) return [];
	const trail: Crumb[] = [{ label: 'Fleet', href: FLEET_HOME }];
	if (p === section.href) return [...trail, { label: section.label }];
	return [...trail, { label: section.label, href: section.href }, { label: detail || 'Details' }];
}

/** Where back (edge swipe, the parent crumb) goes from a Fleet path. */
export function fleetParent(path: string): string {
	const trail = fleetTrail(path);
	return trail.length ? trail[trail.length - 2].href! : FLEET_EXIT;
}
