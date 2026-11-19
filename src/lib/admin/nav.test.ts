import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FLEET_NAV, fleetParent, fleetSection, fleetTrail } from './nav.ts';

describe('Fleet navigation (nav.ts)', () => {
	it('finds the section of a page, the longest match first', () => {
		expect(fleetSection('/admin')?.label).toBe('Overview');
		expect(fleetSection('/admin/accounts/3')?.href).toBe('/admin/accounts');
		expect(fleetSection('/admin/ai/1')?.href).toBe('/admin/ai');
		expect(fleetSection('/admin/accounts/')?.href).toBe('/admin/accounts');
		expect(fleetSection('/settings')).toBeNull();
	});

	it('builds breadcrumbs and the way back', () => {
		expect(fleetTrail('/admin')).toEqual([]);
		expect(fleetTrail('/admin/promos')).toEqual([{ label: 'Fleet', href: '/admin' }, { label: 'Promo codes' }]);
		expect(fleetTrail('/admin/accounts/3', 'Example Learner')).toEqual([
			{ label: 'Fleet', href: '/admin' },
			{ label: 'Accounts', href: '/admin/accounts' },
			{ label: 'Example Learner' }
		]);
		expect(fleetParent('/admin/accounts/3')).toBe('/admin/accounts');
		expect(fleetParent('/admin/usage')).toBe('/admin');
		expect(fleetParent('/admin')).toBe('/settings');
	});

	it('has a nav entry for every static page under src/routes/admin', () => {
		const pages: string[] = [];
		const walk = (d: string) => {
			for (const n of readdirSync(d)) {
				const p = join(d, n);
				if (statSync(p).isDirectory()) walk(p);
				else if (n === '+page.svelte') pages.push('/' + relative('src/routes', d).split('\\').join('/'));
			}
		};
		walk('src/routes/admin');
		const hrefs = FLEET_NAV.map((i) => i.href);
		expect(pages.filter((p) => !p.includes('[') && !hrefs.includes(p))).toEqual([]);
	});
});
