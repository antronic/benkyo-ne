#!/usr/bin/env node
/**
 * Layout check: loads the built app in Chromium and fails on spacing and
 * layout problems a lint cannot see.
 *
 *   npm run build && npm run check:layout
 *
 * For each screen at phone (390), iPad portrait (768), iPad with the side
 * rail (1024) and desktop (1280) widths:
 *   - no horizontal scroll;
 *   - ≥ 600px: the page column is centred in the space right of the rail;
 *   - scrolled down: the compact title bar spans from the rail to the right
 *     edge and its title sits over the centre of the page column;
 *   - text inside a glass card keeps at least 12px from the card's sides and
 *     8px from its top and bottom (nothing hugs an edge);
 *   - buttons, links styled as buttons and form controls are at least 32px
 *     tall (44px is the goal for primary touch targets; `.small` buttons
 *     are allowed down to 32px).
 *
 * The API is mocked: the app runs signed out and offline-first, and the fleet
 * console answers "Sign in first", so the check needs no Worker or secrets.
 * A second pass signs the fleet console "in" with synthetic data
 * (scripts/layout-fixtures.mjs) and checks its lists, forms and the model
 * picker opened.
 * A navigation (flow) pass then walks between screens, which the per-screen
 * checks above never do (PR #31 and #33 missed that Fleet had no nav at all):
 *   - every Fleet page under src/routes/admin is reachable: a static page is
 *     a link in the Fleet nav (sidebar, or the phone menu opened), a detail
 *     page is linked from its parent page;
 *   - every Fleet page shows where you are: an h1, exactly one current
 *     (aria-current="page") nav link that is the page or its section, and
 *     below the overview a visible breadcrumb link to its parent;
 *   - the Fleet nav has a way back out to the app;
 *   - every top-level app screen under src/routes is in the tab bar;
 *   - at 1200px and wider, every Fleet page fills at least 900px beside the sidebar.
 * The avatar setup, a full-screen sheet outside <main>, is walked step by step
 * (start, dice, editor top and scrolled, consent, camera, "no face") with the
 * same checks rooted at the sheet, plus: controls in one row share one height,
 * and the sheet's top padding is not smaller than its side padding.
 * Set LAYOUT_URL to check a server that is already running. Set LAYOUT_REVIEW
 * to a folder to save every avatar setup step for the visual review.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import { FLEET_FIXTURES, FLEET_SAMPLES, FLEET_SCREENS, signedInRoute } from './layout-fixtures.mjs';

const PORT = 4179;
const BASE = process.env.LAYOUT_URL ?? `http://localhost:${PORT}`;
const SHOTS = process.env.LAYOUT_SHOTS; // optional folder for failure screenshots
// LAYOUT_REVIEW=dir saves every step of the full-screen flows (pass or fail) for the visual review
// in the PR (docs/guides/working-carefully.md, "Visual review")
const REVIEW = process.env.LAYOUT_REVIEW;

export const SCREENS = ['/', '/learn', '/learn/level/n5-01', '/learn/browse/kanji', '/learn/browse/kanji/%E6%9D%B1', '/learn/browse/grammar', '/kana', '/words', '/ai', '/ai/ask', '/community', '/week', '/settings', '/design', '/admin', '/admin/accounts', '/admin/promos', '/no-such-page'];
const WIDTHS = [
	['phone', 390, 844],
	['ipad', 768, 1024],
	['ipad-rail', 1024, 1366],
	['desktop', 1280, 800]
];
const EDGE_X = 12;
const EDGE_Y = 8;
const MIN_CONTROL = 32;

/** Runs in the page. Returns a list of problems (strings). */
function inspect({ EDGE_X, EDGE_Y, MIN_CONTROL, desktop, root = 'main' }) {
	const out = [];
	const visible = (el) => {
		const r = el.getBoundingClientRect();
		const s = getComputedStyle(el);
		return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
	};
	const name = (el) => {
		const cls = [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 3).join('.');
		const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
		return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}> "${text}"`;
	};

	const doc = document.scrollingElement;
	if (doc.scrollWidth > doc.clientWidth + 1) out.push(`horizontal scroll: page is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport`);

	const page = document.querySelector('main.page');
	if (desktop && page) {
		// Measure what is drawn (the children), not the padding box.
		const kids = [...page.children].filter((el) => visible(el) && getComputedStyle(el).position !== 'fixed');
		const r = page.getBoundingClientRect();
		const rail = r.left; // .page starts right of the rail
		const left = Math.min(...kids.map((el) => el.getBoundingClientRect().left)) - rail;
		const right = doc.clientWidth - Math.max(...kids.map((el) => el.getBoundingClientRect().right));
		if (Math.abs(left - right) > 2) out.push(`page column not centred: ${Math.round(left)}px on the left, ${Math.round(right)}px on the right`);
	}

	// Text must not hug the edge of the card it sits in.
	for (const card of document.querySelectorAll(`${root} .glass`)) {
		if (!visible(card) || card.closest('[data-layout-skip]')) continue;
		const box = card.getBoundingClientRect();
		// Pills, steppers and segmented controls are controls, not cards.
		if (box.height < 48) continue;
		const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			if (!n.textContent.trim()) continue;
			const host = n.parentElement;
			// Text in a nested glass card is that card's business.
			if (host.closest('.glass') !== card || !visible(host)) continue;
			// Text in a closed <details> is not shown.
			const closed = host.closest('details:not([open])');
			if (closed && !host.closest('summary')) continue;
			const range = document.createRange();
			range.selectNodeContents(n);
			// Text cut off by an ellipsis or a scroll box only shows inside that box.
			let clip = null;
			for (let a = host; a && a !== card; a = a.parentElement) {
				if (getComputedStyle(a).overflowX !== 'visible') {
					clip = a.getBoundingClientRect();
					break;
				}
			}
			for (const raw of range.getClientRects()) {
				const t = clip
					? { left: Math.max(raw.left, clip.left), right: Math.min(raw.right, clip.right), top: Math.max(raw.top, clip.top), bottom: Math.min(raw.bottom, clip.bottom) }
					: { left: raw.left, right: raw.right, top: raw.top, bottom: raw.bottom };
				if (t.right - t.left <= 0 || t.bottom <= t.top) continue;
				// Fully outside the card: clipped or scrolled away, not hugging.
				if (t.bottom <= box.top || t.top >= box.bottom || t.right <= box.left || t.left >= box.right) continue;
				const gaps = [t.left - box.left, box.right - t.right, t.top - box.top, box.bottom - t.bottom];
				const bad = gaps[0] < EDGE_X - 0.5 || gaps[1] < EDGE_X - 0.5 || gaps[2] < EDGE_Y - 0.5 || gaps[3] < EDGE_Y - 0.5;
				if (bad) {
					out.push(`text hugs card edge in ${name(card)}: "${n.textContent.trim().slice(0, 24)}" is ${gaps.map((g) => Math.round(g)).join('/')}px from left/right/top/bottom`);
					break;
				}
			}
		}
	}

	const CONTROL = 'button, a.btn, label.btn, [role="button"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), select';
	const controls = [...document.querySelectorAll(CONTROL.split(', ').map((c) => `${root} ${c}`).join(', '))];
	for (const el of controls) {
		if (!visible(el) || el.closest('[data-layout-skip]')) continue;
		const h = el.getBoundingClientRect().height;
		if (h < MIN_CONTROL - 0.5) out.push(`control too small: ${name(el)} is ${Math.round(h)}px tall (min ${MIN_CONTROL}px)`);
	}

	// Controls side by side in one row share one height (a 40px icon button beside a 50px button
	// looked broken in the avatar setup, PR #67). Text-only (plain) buttons and chips are exempt, and
	// so is a row marked data-mixed-sizes (the /design catalogue shows the sizes side by side).
	const rowParents = new Set(controls.filter((el) => visible(el) && !el.closest('[data-layout-skip]')).map((el) => el.parentElement));
	for (const row of rowParents) {
		const s = getComputedStyle(row);
		if (!/flex/.test(s.display) || s.flexDirection !== 'row' || row.closest('[data-mixed-sizes]')) continue;
		const kids = [...row.children].filter((el) => el.matches(CONTROL) && visible(el) && !el.matches('.plain, .chip, [role="tab"], [role="radio"], [role="option"]'));
		if (kids.length < 2) continue;
		const boxes = kids.map((el) => el.getBoundingClientRect());
		// only controls on the same line (a wrapped row is two rows)
		const line = boxes.filter((b) => b.top < boxes[0].bottom - 1 && b.bottom > boxes[0].top + 1);
		if (line.length < 2) continue;
		const hs = line.map((b) => Math.round(b.height));
		if (Math.max(...hs) - Math.min(...hs) > 1) out.push(`controls in one row have different heights: ${kids.slice(0, line.length).map((el, i) => `${name(el)} ${hs[i]}px`).join(', ')}`);
	}

	// "Back" leads: it sits on the left, where iOS puts it (the avatar setup's consent and problem
	// steps had it on the right, where "Later" goes).
	const scope = document.querySelector(root);
	if (scope) {
		const mid = (scope.getBoundingClientRect().left + scope.getBoundingClientRect().right) / 2;
		for (const el of controls) {
			if (!visible(el) || el.textContent.trim() !== 'Back') continue;
			const r = el.getBoundingClientRect();
			if ((r.left + r.right) / 2 > mid) out.push(`${name(el)} is on the right; Back goes on the left`);
		}
	}

	// A full-screen sheet keeps at least its side gutter at the top too (no safe area on a computer
	// or a landscape phone left the avatar setup's "Later" 12px from the top edge).
	if (root !== 'main') {
		const sheet = document.querySelector(root);
		if (sheet && visible(sheet)) {
			const st = getComputedStyle(sheet);
			const top = parseFloat(st.paddingTop), side = Math.min(parseFloat(st.paddingLeft), parseFloat(st.paddingRight));
			if (top + 0.5 < side) out.push(`full-screen sheet ${name(sheet)} has ${Math.round(top)}px padding at the top but ${Math.round(side)}px at the sides`);
		}
	}
	return [...new Set(out)];
}

/** Runs in the page, scrolled down. Problems with the compact title bar (LargeTitle's .navbar). */
function inspectNavbar() {
	const out = [];
	const bar = document.querySelector('.navbar.shown');
	const page = document.querySelector('main.page');
	if (!bar || !page) return out;
	const doc = document.scrollingElement;
	const b = bar.getBoundingClientRect();
	const p = page.getBoundingClientRect();
	if (Math.abs(b.left - p.left) > 1 || Math.abs(b.right - doc.clientWidth) > 1)
		out.push(`title bar spans ${Math.round(b.left)}–${Math.round(b.right)}px, expected ${Math.round(p.left)}–${doc.clientWidth}px (rail to right edge)`);
	const title = bar.querySelector('.inline-title')?.getBoundingClientRect();
	const kids = [...page.children].filter((el) => el !== bar && el.getBoundingClientRect().width > 0 && getComputedStyle(el).position !== 'fixed');
	if (title && kids.length) {
		const left = Math.min(...kids.map((el) => el.getBoundingClientRect().left));
		const right = Math.max(...kids.map((el) => el.getBoundingClientRect().right));
		const off = (title.left + title.right) / 2 - (left + right) / 2;
		if (Math.abs(off) > 2) out.push(`title bar title is ${Math.round(off)}px off the centre of the page column`);
	}
	return out;
}

/** Route patterns ('/admin/accounts/[id]') for every +page.svelte under a routes folder. */
export function routesUnder(dir, base = 'src/routes') {
	const out = [];
	const walk = (d) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (name === '+page.svelte') out.push('/' + relative(base, d).split('\\').join('/').replace(/\/?\([^)]+\)/g, ''));
		}
	};
	walk(dir);
	return out.map((r) => r.replace(/\/$/, '') || '/').sort();
}
/** Top-level app screens that are deliberately not in the tab bar, and why. */
const OFF_TAB_BAR = { '/design': 'developer catalog', '/admin': 'Fleet, opened from Settings', '/week': 'weekly report, opened from the Your week card on Today' };

/** Runs in the page: hrefs of the visible links in navs matching `sel`. */
function navLinks(sel) {
	return [...document.querySelectorAll(sel)].flatMap((nav) =>
		[...nav.querySelectorAll('a[href]')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => ({ href: new URL(a.href).pathname, current: a.getAttribute('aria-current') === 'page', text: a.textContent.trim().replace(/\s+/g, ' ') }))
	);
}

/** Runs in the page: what tells you where you are. */
function whereAmI(parent) {
	const out = [];
	const title = [...document.querySelectorAll('main h1')].find((h) => h.getBoundingClientRect().height > 0)?.textContent.trim() ?? '';
	const h1 = [...document.querySelectorAll('main h1')].find((h) => h.getBoundingClientRect().height > 0 && h.textContent.trim());
	if (!h1) out.push('no visible page title (h1)');
	if (parent) {
		const crumbs = [...document.querySelectorAll('main nav[aria-label*="breadcrumb" i] a[href]')].filter((a) => a.getBoundingClientRect().width > 0);
		if (!crumbs.some((a) => new URL(a.href).pathname === parent)) out.push(`no visible breadcrumb link back to ${parent}`);
	}
	return { problems: out, title };
}

/** Runs in the page: mark the first-run intro, onboarding and Kuri's hello as seen. */
function skipIntro() {
	return new Promise((done) => {
		const req = indexedDB.open('benkyo');
		req.onsuccess = () => {
			const tx = req.result.transaction('meta', 'readwrite');
			const meta = tx.objectStore('meta');
			for (const k of ['introSeen', 'kuriIntroSeen', 'onboardingSeen']) meta.put(true, k);
			tx.oncomplete = () => done();
			tx.onerror = () => done();
		};
		req.onerror = () => done();
	});
}

const DIALOG = '[role="dialog"][aria-modal="true"]';
/** A small PNG with no face in it (a grey square), for the "Choose a photo" path. */
const NO_FACE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAwElEQVR4nNXOQREAAAyDMKRX+kTw4BYFYc9RByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AGLOmBRByzqgEUdsKgDFnXAog5Y1AHrAB8+AWlViFU0AAAAAElFTkSuQmCC', 'base64');

/**
 * The avatar setup (AvatarSetup.svelte), a full-screen sheet outside <main>, step by step:
 * start, after the dice, consent, the camera (Chromium's fake camera), the "no face" problem from
 * a chosen photo, and the editor at the top and scrolled (the sticky compact preview).
 * Each step gets the same checks as a screen, rooted at the sheet.
 */
async function avatarFlow(browser, label, width, height, problems) {
	const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['camera'] });
	await ctx.route('**/api/**', signedInRoute);
	const page = await ctx.newPage();
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.evaluate(skipIntro);
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	const at = (step) => `avatar setup (${step}) @ ${label} ${width}px`;
	const check = async (step) => {
		await page.waitForTimeout(400);
		const found = await page.evaluate(inspect, { EDGE_X, EDGE_Y, MIN_CONTROL, desktop: false, root: DIALOG });
		for (const f of found) problems.push(`${at(step)}: ${f}`);
		const dir = REVIEW ?? (found.length ? SHOTS : null);
		if (dir) {
			mkdirSync(dir, { recursive: true });
			await page.screenshot({ path: `${dir}/avatar-${label}-${step}.png` });
		}
	};
	const press = async (step, name) => {
		const el = page.locator(DIALOG).getByRole('button', { name, exact: true }).first();
		if (!(await el.count())) {
			problems.push(`${at(step)}: nothing to press called "${name}"`);
			return false;
		}
		await el.click();
		return true;
	};
	try {
		const open = page.getByRole('button', { name: 'Make it', exact: true });
		try {
			await open.waitFor({ timeout: 8000 });
		} catch {
			problems.push(`avatar setup @ ${label} ${width}px: the "Make your avatar" prompt did not show on Today (scripts/layout-fixtures.mjs SIGNED_IN_ME)`);
			return;
		}
		await open.click();
		await page.locator(DIALOG).waitFor();
		await check('start');
		if (await press('start', 'Random look')) await check('dice');
		if (await press('dice', 'Build it myself')) {
			await check('editor');
			await page.locator(DIALOG).evaluate((d) => d.scrollTo(0, d.scrollHeight));
			await page.waitForTimeout(400);
			await check('editor-scrolled');
			await press('editor', 'Back');
		}
		if (await press('start', 'Use a selfie')) {
			await check('consent');
			if (await press('consent', 'Open camera')) {
				try {
					await page.locator(`${DIALOG} video`).waitFor({ timeout: 30000 });
					await page.waitForFunction(() => !document.querySelector('.cam-wait'), null, { timeout: 15000 });
					await check('camera');
					await page.locator(DIALOG).locator('input[type="file"]').first().setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: NO_FACE_PNG });
					await page.getByText('We couldn’t find a face').waitFor({ timeout: 30000 });
					await check('no-face');
				} catch (e) {
					problems.push(`${at('camera')}: the camera or photo step did not show (${String(e.message ?? e).split('\n')[0]})`);
				}
			}
		}
	} finally {
		await ctx.close();
	}
}

async function waitFor(url, ms = 20000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`server at ${url} did not start`);
}

async function main() {
	let server;
	if (!process.env.LAYOUT_URL) {
		server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
	}
	const problems = [];
	// a fake camera, so the avatar setup's camera step can be checked
	const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
	try {
		await waitFor(BASE + '/');
		for (const [label, width, height] of WIDTHS) {
			const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
			await ctx.route('**/api/**', (route) => {
				const path = new URL(route.request().url()).pathname;
				if (path.startsWith('/api/admin'))
					return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'signin', message: 'Sign in with your passkey first' }) });
				return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
			});
			const page = await ctx.newPage();
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			await page.evaluate(skipIntro);
			for (const path of SCREENS) {
				await page.goto(BASE + path, { waitUntil: 'networkidle' });
				await page.waitForTimeout(400);
				const found = await page.evaluate(inspect, { EDGE_X, EDGE_Y, MIN_CONTROL, desktop: width >= 600 });
				// Scroll so the large title collapses into the compact title bar, then check that bar.
				await page.evaluate(() => scrollTo(0, document.scrollingElement.scrollHeight));
				await page.waitForTimeout(500);
				found.push(...(await page.evaluate(inspectNavbar)));
				for (const f of found) problems.push(`${path} @ ${label} ${width}px: ${f}`);
				if (found.length && SHOTS) {
					mkdirSync(SHOTS, { recursive: true });
					await page.screenshot({ path: `${SHOTS}/${label}${path.replace(/\//g, '_') || '_'}.png`, fullPage: true });
				}
			}

			// Every top-level app screen is in the tab bar.
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			const tabs = (await page.evaluate(navLinks, 'nav.tabbar')).map((l) => l.href);
			// screens that are not in the bar are one tap away, in the More sheet (src/lib/nav.ts)
			const more = page.locator('nav.tabbar button.more');
			if (await more.count()) {
				await more.click();
				await page.waitForTimeout(600);
				const sheet = (await page.evaluate(navLinks, DIALOG)).map((l) => l.href);
				if (!sheet.length) problems.push(`/ @ ${label} ${width}px: the More tab opened no sheet of screens`);
				tabs.push(...sheet);
				await page.keyboard.press('Escape');
				await page.waitForTimeout(400);
			}
			for (const r of routesUnder('src/routes').filter((r) => r.split('/').length === 2 && !(r in OFF_TAB_BAR))) {
				if (!tabs.includes(r)) problems.push(`${r} @ ${label} ${width}px: not reachable, it is not in the tab bar or its More sheet (src/lib/nav.ts)`);
			}
			await ctx.close();

			// Fleet console with synthetic data, forms opened.
			const fctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
			await fctx.route('**/api/**', (route) => {
				const path = new URL(route.request().url()).pathname;
				const body = FLEET_FIXTURES[path];
				return route.fulfill({ status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body ?? { error: 'not_found' }) });
			});
			const fpage = await fctx.newPage();
			// A script error while a form is used (the SvelteKit "500" page) is a failure too.
			const pageErrors = [];
			fpage.on('pageerror', (e) => pageErrors.push(e.message));
			await fpage.goto(BASE + '/', { waitUntil: 'networkidle' });
			await fpage.evaluate(skipIntro);
			for (const s of FLEET_SCREENS) {
				await fpage.goto(BASE + s.path, { waitUntil: 'networkidle' });
				await fpage.waitForTimeout(400);
				const where = `${s.path}${s.label ? ` (${s.label})` : ''} @ ${label} ${width}px`;
				let opened = true;
				for (const text of s.open) {
					const el = fpage.getByText(text, { exact: true }).first();
					if (!(await el.count())) {
						problems.push(`${where}: nothing to press called "${text}" (update scripts/layout-fixtures.mjs)`);
						opened = false;
						break;
					}
					await el.click();
					await fpage.waitForTimeout(300);
				}
				if (!opened) continue;
				// type into fields (selector → text), as a person would, key by key
				for (const [sel, text] of Object.entries(s.type ?? {})) {
					const field = fpage.locator(sel).first();
					if (!(await field.count())) {
						problems.push(`${where}: no field ${sel} to type in (update scripts/layout-fixtures.mjs)`);
						continue;
					}
					try {
						await field.fill('', { timeout: 5000 });
						await field.pressSequentially(text, { timeout: 5000 });
					} catch {
						problems.push(`${where}: typing "${text}" into ${sel} failed: the field went away`);
					}
					await fpage.waitForTimeout(200);
				}
				for (const e of pageErrors.splice(0)) problems.push(`${where}: script error: ${e}`);
				if (await fpage.getByText('Internal Error', { exact: true }).count()) problems.push(`${where}: the page broke into the error screen`);
				const found = await fpage.evaluate(inspect, { EDGE_X, EDGE_Y, MIN_CONTROL, desktop: width >= 600 });
				for (const f of found) problems.push(`${where}: ${f}`);
				if (found.length && SHOTS) {
					mkdirSync(SHOTS, { recursive: true });
					await fpage.screenshot({ path: `${SHOTS}/fleet-${label}${s.path.replace(/\//g, '_')}${s.label ? '-' + s.label.replace(/\W+/g, '-') : ''}.png`, fullPage: true });
				}
			}

			// Navigation (flow) pass: reachability and "where am I" for every Fleet page.
			const FLEET_NAV_SEL = 'nav[aria-label="Fleet"]';
			const openNav = async () => {
				if ((await fpage.evaluate(navLinks, FLEET_NAV_SEL)).length) return true;
				const pill = fpage.locator('[aria-haspopup="dialog"][aria-label^="Fleet menu"]').first();
				if (!(await pill.count())) return false;
				await pill.click();
				await fpage.waitForTimeout(400);
				return (await fpage.evaluate(navLinks, FLEET_NAV_SEL)).length > 0;
			};
			const closeNav = async () => {
				if (await fpage.locator('[role="dialog"][aria-label="Fleet menu"]').count()) {
					await fpage.keyboard.press('Escape');
					await fpage.waitForTimeout(400);
				}
			};
			const routes = routesUnder('src/routes/admin');
			const urlOf = (r) => (r.includes('[') ? FLEET_SAMPLES[r] : r);
			await fpage.goto(BASE + '/admin', { waitUntil: 'networkidle' });
			await fpage.waitForTimeout(300);
			const at = `@ ${label} ${width}px`;
			if (!(await openNav())) problems.push(`/admin ${at}: no Fleet navigation (a nav labelled "Fleet", or a "Fleet menu" button that opens it)`);
			const navHrefs = (await fpage.evaluate(navLinks, FLEET_NAV_SEL)).map((l) => l.href);
			if (!navHrefs.some((h) => !h.startsWith('/admin'))) problems.push(`/admin ${at}: the Fleet nav has no way back to the app`);
			await closeNav();
			for (const r of routes) {
				const url = urlOf(r);
				if (!url) {
					problems.push(`${r}: no sample URL for this dynamic route (add it to FLEET_SAMPLES in scripts/layout-fixtures.mjs)`);
					continue;
				}
				const isDetail = r.includes('[');
				const parent = r === '/admin' ? null : isDetail ? url.slice(0, url.lastIndexOf('/')) : '/admin';
				if (!isDetail && !navHrefs.includes(r)) problems.push(`${r} ${at}: not reachable, it is not in the Fleet nav (src/lib/admin/nav.ts)`);
				if (isDetail) {
					await fpage.goto(BASE + parent, { waitUntil: 'networkidle' });
					await fpage.waitForTimeout(300);
					const prefix = parent + '/';
					const linked = await fpage.evaluate((pre) => [...document.querySelectorAll('main a[href]')].some((a) => new URL(a.href).pathname.startsWith(pre)), prefix);
					if (!linked) problems.push(`${r} ${at}: not reachable, ${parent} has no link to a ${prefix}… page`);
				}
				await fpage.goto(BASE + url, { waitUntil: 'networkidle' });
				await fpage.waitForTimeout(300);
				const { problems: found, title } = await fpage.evaluate(whereAmI, parent);
				// Desktop: Fleet uses the screen, not a phone-width column (Columns, DataTable, --page-max).
				if (width >= 1200) {
					const used = await fpage.evaluate(() => {
						const kids = [...document.querySelectorAll('main.page > *')].filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).position !== 'fixed');
						return Math.max(0, ...kids.map((el) => el.getBoundingClientRect().width));
					});
					if (used < 900) found.push(`content is only ${Math.round(used)}px wide on a ${width}px screen (expected at least 900px beside the sidebar)`);
				}
				if (await openNav()) {
					const current = (await fpage.evaluate(navLinks, FLEET_NAV_SEL)).filter((l) => l.current);
					if (current.length !== 1) found.push(`${current.length} current links in the Fleet nav, expected 1 (aria-current="page")`);
					else if (!(url === current[0].href || url.startsWith(current[0].href + '/'))) found.push(`the Fleet nav marks ${current[0].href} as current`);
					else if (!isDetail && r !== '/admin' && current[0].text !== title) found.push(`the nav calls this page "${current[0].text}" but its title says "${title}"`);
					await closeNav();
				} else found.push('no Fleet navigation on this page');
				for (const f of found) problems.push(`${url} ${at}: ${f}`);
			}
			await fctx.close();

			await avatarFlow(browser, label, width, height, problems);
		}
	} finally {
		await browser.close();
		server?.kill();
	}
	if (problems.length) {
		for (const p of problems) console.error(p);
		console.error(`\nLayout check: ${problems.length} problem(s). See docs/DESIGN-SYSTEM.md (Spacing).`);
		process.exit(1);
	}
	console.log(`Layout check: ${SCREENS.length} screens, ${FLEET_SCREENS.length} Fleet views with data and 7 avatar setup steps × ${WIDTHS.length} widths, plus navigation for ${routesUnder('src/routes/admin').length} Fleet pages and the tab bar, no problems.`);
}

await main();
