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
 * Set LAYOUT_URL to check a server that is already running.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4179;
const BASE = process.env.LAYOUT_URL ?? `http://localhost:${PORT}`;
const SHOTS = process.env.LAYOUT_SHOTS; // optional folder for failure screenshots

export const SCREENS = ['/', '/learn', '/kana', '/words', '/ai', '/settings', '/design', '/admin', '/admin/accounts'];
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
function inspect({ EDGE_X, EDGE_Y, MIN_CONTROL, desktop }) {
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
	for (const card of document.querySelectorAll('main .glass')) {
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
			for (const t of range.getClientRects()) {
				if (t.width === 0) continue;
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

	for (const el of document.querySelectorAll('main button, main a.btn, main [role="button"], main input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), main select')) {
		if (!visible(el) || el.closest('[data-layout-skip]')) continue;
		const h = el.getBoundingClientRect().height;
		if (h < MIN_CONTROL - 0.5) out.push(`control too small: ${name(el)} is ${Math.round(h)}px tall (min ${MIN_CONTROL}px)`);
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
	const browser = await chromium.launch();
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
			// Skip the first-run intro, onboarding and Kuri's hello.
			await page.evaluate(
				() =>
					new Promise((done) => {
						const req = indexedDB.open('benkyo');
						req.onsuccess = () => {
							const tx = req.result.transaction('meta', 'readwrite');
							const meta = tx.objectStore('meta');
							for (const k of ['introSeen', 'kuriIntroSeen', 'onboardingSeen']) meta.put(true, k);
							tx.oncomplete = () => done();
							tx.onerror = () => done();
						};
						req.onerror = () => done();
					})
			);
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
			await ctx.close();
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
	console.log(`Layout check: ${SCREENS.length} screens × ${WIDTHS.length} widths, no problems.`);
}

await main();
