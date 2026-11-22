#!/usr/bin/env node
/**
 * Render check: catches GPU work that glitches or heats phones, which no screenshot shows.
 *
 *   npm run build && npm run check:render
 *
 * Loads the built app in Chromium with a software GPU (SwiftShader), counts every WebGL and
 * WebGPU canvas context the page creates, and walks the avatar setup the way a learner does:
 * open it, roll the dice, open the editor and tap tiles, go back. It fails when:
 *   - the live avatar never starts (so the rest of the check would prove nothing);
 *   - a dice roll or editor tap creates a new GPU context: a live avatar must not rebuild its
 *     engine for a new look (on iPhone and iPad each rebuild showed torn, blue-tinted frames and
 *     heated the phone; PR #66 and #67, docs/guides/lessons.md live-avatar-editor); going back to the
 *     start screen may build one new live avatar for the look it now shows, not more;
 *   - more GPU contexts are alive at once than setLiveLimit allows (src/lib/avatar/render.ts);
 *   - a GPU context is lost, or the page logs an error.
 * It also opens Settings (three Kuris), drops every Kuri's WebGL context the way Safari does after
 * the app sat in the background, and fails unless each Kuri gets a fresh, working context
 * (src/lib/companion/Kuri.svelte; docs/guides/lessons.md kuri-context-lost).
 * Then it shakes Kuri on Today: a shake makes Kuri dizzy, a plain drag does not.
 * Last it watches Kuri on Today at phone, iPad and desktop width while it says hello, wanders,
 * the page scrolls and it is put down on a button: Kuri must never cover a control or the menu
 * bar (src/lib/companion/keepOut.ts), and the hello must be a speech bubble, not a full screen.
 *
 * The API is mocked with a synthetic signed-in learner (scripts/layout-fixtures.mjs).
 * Set LAYOUT_URL to check a server that is already running.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { signedInRoute } from './layout-fixtures.mjs';

const PORT = 4181;
const BASE = process.env.LAYOUT_URL ?? `http://localhost:${PORT}`;
const DIALOG = '[role="dialog"][aria-modal="true"]';
const LIVE_LIMIT = 2; // setLiveLimit in src/lib/avatar/render.ts
const WIDTHS = [
	['phone', 390, 844],
	['desktop', 1280, 800]
];

/** Runs before the app: counts GPU contexts (one per canvas), live ones and lost ones. */
function countGpu() {
	const gpu = { made: 0, lost: 0, log: [] };
	window.__gpu = gpu;
	const canvases = new Set();
	const orig = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
		const c = orig.call(this, kind, ...rest);
		if (c && /^(webgl2?|webgpu)$/.test(kind) && !canvases.has(this)) {
			canvases.add(this);
			gpu.made++;
			gpu.log.push(`${kind} #${gpu.made} at ${Math.round(performance.now())}ms`);
			this.addEventListener('webglcontextlost', () => gpu.lost++);
		}
		return c;
	};
	// contexts whose canvas is still in the page (a disposed engine removes its canvas)
	gpu.alive = () => [...canvases].filter((c) => c.isConnected && c.width > 0).length;
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

function skipIntro() {
	return new Promise((done) => {
		const req = indexedDB.open('benkyo');
		req.onsuccess = () => {
			const tx = req.result.transaction('meta', 'readwrite');
			for (const k of ['introSeen', 'kuriIntroSeen', 'onboardingSeen']) tx.objectStore('meta').put(true, k);
			tx.oncomplete = () => done();
			tx.onerror = () => done();
		};
		req.onerror = () => done();
	});
}

async function walk(browser, label, width, height, problems) {
	const at = `avatar setup @ ${label} ${width}px`;
	// motion on: the live avatar only starts without reduced motion
	const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'no-preference' });
	await ctx.addInitScript(countGpu);
	await ctx.route('**/api/**', signedInRoute);
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e.message ?? e).split('\n')[0]));
	const gpu = () => page.evaluate(() => ({ made: window.__gpu.made, lost: window.__gpu.lost, alive: window.__gpu.alive(), log: window.__gpu.log }));
	const peak = { alive: 0 };
	const sample = async () => {
		const g = await gpu();
		peak.alive = Math.max(peak.alive, g.alive);
		return g;
	};
	const press = async (name) => {
		await page.locator(DIALOG).getByRole('button', { name, exact: true }).first().click();
		await page.waitForTimeout(700);
		await sample();
	};
	try {
		await page.goto(BASE + '/', { waitUntil: 'networkidle' });
		await page.evaluate(skipIntro);
		await page.goto(BASE + '/', { waitUntil: 'networkidle' });
		await page.getByRole('region', { name: 'Set up Benkyo' }).getByRole('button', { name: 'Make', exact: true }).click();
		await page.locator(DIALOG).waitFor();
		// the live engine loads three.js and builds; give it time on a software GPU
		let started = null;
		for (let i = 0; i < 40 && !started; i++) {
			await page.waitForTimeout(500);
			const g = await sample();
			if (g.made > 0) started = g;
		}
		if (!started) {
			problems.push(`${at}: the live avatar never started (no WebGL or WebGPU context in 20 s), so rebuilds cannot be checked`);
			return;
		}
		// let the wave and any first-time work settle
		await page.waitForTimeout(5000);
		const base = await sample();

		for (let i = 0; i < 3; i++) await press('Random look');
		await press('Build it myself');
		const tiles = page.locator(`${DIALOG} [role="radio"], ${DIALOG} [role="option"]`);
		const n = Math.min(await tiles.count(), 6);
		for (let i = 0; i < n; i++) {
			await tiles.nth(i).click();
			await page.waitForTimeout(400);
			await sample();
		}
		const taps = await sample();
		if (taps.made > base.made)
			problems.push(`${at}: ${taps.made - base.made} new GPU context(s) during the dice and editor taps; a live avatar must not rebuild its engine for a new look (${taps.log.slice(base.made).join(', ')})`);
		// back on the start screen, a new live avatar for the look now shown is fine: one, not one per tap
		await press('Back');
		await page.waitForTimeout(5000);
		const end = await sample();
		if (end.made > taps.made + 1) problems.push(`${at}: ${end.made - taps.made} new GPU contexts on going back to the start screen (expected at most 1)`);
		if (peak.alive > LIVE_LIMIT) problems.push(`${at}: ${peak.alive} GPU contexts alive at once (limit ${LIVE_LIMIT}, setLiveLimit in src/lib/avatar/render.ts)`);
		if (end.lost) problems.push(`${at}: ${end.lost} GPU context(s) lost`);
		for (const e of [...new Set(errors)]) problems.push(`${at}: page error: ${e}`);
		console.log(`${at}: ${base.made} GPU context(s) at start, ${taps.made} after 3 dice rolls and ${n} editor taps, ${end.made} back on the start screen, at most ${peak.alive} alive`);
	} finally {
		await ctx.close();
	}
}

/** Settings shows three Kuris. Lose each one's context; each must come back on a new canvas. */
async function kuriLost(browser, problems) {
	const at = 'Kuri context loss @ Settings';
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
	await ctx.route('**/api/**', signedInRoute);
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e.message ?? e).split('\n')[0]));
	const kuris = () =>
		page.$$eval('canvas.kuri', (cs) =>
			cs.map((c) => {
				c.dataset.seen ??= String(Math.random());
				const g = c.getContext('webgl');
				return { id: c.dataset.seen, ok: !!g && !g.isContextLost() };
			})
		);
	try {
		await page.goto(BASE + '/', { waitUntil: 'networkidle' });
		await page.evaluate(skipIntro);
		await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
		await page.waitForFunction(() => document.querySelectorAll('canvas.kuri').length >= 3, null, { timeout: 20000 }).catch(() => {});
		await page.waitForTimeout(1500);
		const before = await kuris();
		if (before.length < 3) {
			problems.push(`${at}: expected 3 Kuris on Settings, found ${before.length}`);
			return;
		}
		await page.$$eval('canvas.kuri', (cs) => cs.forEach((c) => c.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext()));
		await page.waitForTimeout(2500);
		const after = await kuris();
		const old = new Set(before.map((k) => k.id));
		const fresh = after.filter((k) => !old.has(k.id) && k.ok).length;
		if (fresh < before.length) problems.push(`${at}: ${fresh} of ${before.length} Kuris came back after their WebGL context was lost; a lost context never draws again, so Kuri must rebuild on a new canvas`);
		for (const e of [...new Set(errors)]) problems.push(`${at}: page error: ${e}`);
		console.log(`${at}: ${before.length} Kuris, ${fresh} rebuilt after losing their context`);
	} finally {
		await ctx.close();
	}
}

/**
 * Today: pick Kuri up and shake it. Kuri must get dizzy (its dizzy line shows when set down),
 * while a plain drag must not (src/lib/companion/KuriWalker.svelte).
 */
async function kuriShake(browser, problems) {
	const at = 'Kuri shake @ Today';
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'no-preference' });
	await ctx.route('**/api/**', signedInRoute);
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e.message ?? e).split('\n')[0]));
	const said = () => page.locator('.say.on').textContent({ timeout: 300 }).catch(() => '');
	const grab = async () => {
		const b = await page.locator('.walker').boundingBox();
		const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		await page.mouse.move(p.x, p.y);
		await page.mouse.down();
		p.x -= 120;
		await page.mouse.move(p.x, p.y, { steps: 8 });
		return p;
	};
	try {
		await page.goto(BASE + '/', { waitUntil: 'networkidle' });
		await page.evaluate(skipIntro);
		await page.goto(BASE + '/', { waitUntil: 'networkidle' });
		await page.locator('.walker').waitFor({ timeout: 20000 });
		await page.locator('.splash').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
		// a slow drag is just a move
		let p = await grab();
		await page.mouse.move(p.x, p.y - 60, { steps: 10 });
		await page.mouse.up();
		await page.waitForTimeout(300);
		const plain = await said();
		if (/spinning/i.test(plain ?? '')) problems.push(`${at}: a plain drag made Kuri dizzy`);
		await page.waitForTimeout(2500);
		// a shake: quick back-and-forth swings while held
		p = await grab();
		for (let i = 0; i < 6; i++) {
			await page.mouse.move(p.x + (i % 2 ? -45 : 45), p.y, { steps: 4 });
			await page.waitForTimeout(40);
		}
		await page.mouse.up();
		await page.waitForTimeout(300);
		const dizzy = await said();
		if (!/spinning/i.test(dizzy ?? '')) problems.push(`${at}: shaking Kuri did not make it dizzy (said "${dizzy ?? ''}")`);
		for (const e of [...new Set(errors)]) problems.push(`${at}: page error: ${e}`);
		console.log(`${at}: plain drag ${plain ? `said "${plain}"` : 'quiet'}, shake said "${dizzy ?? ''}"`);
	} finally {
		await ctx.close();
	}
}

/** Every visible control and fixed menu bar that Kuri (the .walker box) overlaps right now. */
function kuriCovers() {
	const k = document.querySelector('.walker');
	if (!k) return { shown: false, covers: [] };
	const ks = getComputedStyle(k);
	const shown = ks.visibility !== 'hidden' && ks.pointerEvents !== 'none' && Number(ks.opacity) > 0.5;
	const kb = k.getBoundingClientRect();
	const covers = [];
	const sel = 'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], nav';
	for (const el of document.querySelectorAll(sel)) {
		if (el === k || k.contains(el) || el.closest('[role="dialog"], [aria-hidden="true"]')) continue;
		const cs = getComputedStyle(el);
		if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
		if (el.tagName === 'NAV' && cs.position !== 'fixed' && cs.position !== 'sticky') continue;
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) continue;
		if (kb.left < r.right && r.left < kb.right && kb.top < r.bottom && r.top < kb.bottom)
			covers.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40));
	}
	return { shown, covers };
}

/** Today: Kuri says hello in a bubble and never covers a control or the menu bar. */
async function kuriClear(browser, problems) {
	for (const [label, width, height] of [['phone', 390, 844], ['iPad', 820, 1180], ['desktop', 1280, 800]]) {
		const at = `Kuri keep-out @ Today ${label} ${width}px`;
		const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'no-preference' });
		await ctx.route('**/api/**', signedInRoute);
		const page = await ctx.newPage();
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e.message ?? e).split('\n')[0]));
		let samples = 0;
		let seen = 0;
		const look = async (when) => {
			const r = await page.evaluate(kuriCovers);
			samples++;
			if (!r.shown) return;
			seen++;
			if (r.covers.length) problems.push(`${at}: ${when}, Kuri covers ${r.covers.map((c) => `"${c}"`).join(', ')}`);
		};
		try {
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			// Kuri has not said hello yet on this device
			await page.evaluate(() => new Promise((done) => {
				const req = indexedDB.open('benkyo');
				req.onsuccess = () => {
					const tx = req.result.transaction('meta', 'readwrite');
					for (const k of ['introSeen', 'onboardingSeen']) tx.objectStore('meta').put(true, k);
					tx.objectStore('meta').delete('kuriIntroSeen');
					tx.oncomplete = () => done();
					tx.onerror = () => done();
				};
				req.onerror = () => done();
			}));
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			await page.locator('.walker').waitFor({ timeout: 20000 });
			const hello = await page.locator('.say.on').textContent({ timeout: 8000 }).catch(() => '');
			if (!/はじめまして/.test(hello ?? '')) problems.push(`${at}: Kuri's hello bubble did not show (said "${hello ?? ''}")`);
			if (await page.locator('[role="dialog"][aria-modal="true"]').count()) problems.push(`${at}: Kuri's hello opened a full-screen dialog`);
			// left alone: Kuri wanders
			for (let i = 0; i < 40; i++) {
				await look(`wandering (${i * 250} ms)`);
				await page.waitForTimeout(250);
			}
			// the page scrolls under Kuri
			for (let i = 0; i < 4; i++) {
				await page.mouse.wheel(0, 260);
				for (let j = 0; j < 4; j++) {
					await look(`while scrolling (step ${i + 1})`);
					await page.waitForTimeout(150);
				}
			}
			await page.waitForTimeout(700);
			await look('after scrolling');
			await page.evaluate(() => scrollTo(0, 0));
			await page.waitForTimeout(900);
			// put down on a button: Kuri hops off it
			const k = await page.locator('.walker').boundingBox();
			const target = await page.getByRole('button', { name: 'Start lesson' }).first().boundingBox().catch(() => null);
			if (k && target && (await page.evaluate(kuriCovers)).shown) {
				await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
				await page.mouse.down();
				await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
				await page.mouse.up();
				await page.waitForTimeout(800);
				await look('put down on Start lesson');
			}
			if (!seen) problems.push(`${at}: Kuri never showed (${samples} looks), so keep-out could not be checked`);
			for (const e of [...new Set(errors)]) problems.push(`${at}: page error: ${e}`);
			console.log(`${at}: Kuri shown in ${seen} of ${samples} looks, hello "${(hello ?? '').trim().slice(0, 30)}…"`);
		} finally {
			await ctx.close();
		}
	}
}

async function main() {
	let server;
	if (!process.env.LAYOUT_URL) server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
	const problems = [];
	// SwiftShader: WebGL2 on machines with no GPU (CI, cloud containers)
	const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
	try {
		await waitFor(BASE + '/');
		for (const [label, width, height] of WIDTHS) await walk(browser, label, width, height, problems);
		await kuriLost(browser, problems);
		await kuriShake(browser, problems);
		await kuriClear(browser, problems);
	} finally {
		await browser.close();
		server?.kill();
	}
	if (problems.length) {
		for (const p of problems) console.error(p);
		console.error(`\nRender check: ${problems.length} problem(s). See docs/AVATAR.md (Live avatar).`);
		process.exit(1);
	}
	console.log(`Render check: avatar setup at ${WIDTHS.length} widths, no GPU rebuilds, no lost contexts; Kuri rebuilds after a lost context and gets dizzy when shaken.`);
}

await main();
