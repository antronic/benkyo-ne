#!/usr/bin/env node
/**
 * Storybook smoke check on the build: every story renders, in light and dark, with no error.
 *
 *   npm run build              (builds the app, then the Storybook into build/storybook/)
 *   npm run check:storybook
 *
 * Serves build/ on a local port, reads build/storybook/index.json and opens each story's
 * iframe at phone width (390) in both themes. A story fails when the page throws, logs an
 * error, shows Storybook's error screen, or renders nothing. See docs/DESIGN-SYSTEM.md#storybook.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build');
const INDEX = join(BUILD, 'storybook', 'index.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

if (!existsSync(INDEX)) {
	console.error('check:storybook: build/storybook/index.json not found; run `npm run build` first.');
	process.exit(1);
}
const stories = Object.values(JSON.parse(readFileSync(INDEX, 'utf8')).entries).filter((e) => e.type === 'story');

const server = createServer((req, res) => {
	let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
	let file = join(BUILD, path);
	if (!file.startsWith(BUILD)) return void res.writeHead(403).end();
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	if (!existsSync(file)) return void res.writeHead(404).end();
	res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
	res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/storybook`;

const browser = await chromium.launch();
const failures = [];
try {
	for (const theme of ['light', 'dark']) {
		const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
		const page = await ctx.newPage();
		let errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		for (const s of stories) {
			errors = [];
			await page.goto(`${base}/iframe.html?id=${s.id}&viewMode=story&globals=theme:${theme}`);
			await page.waitForFunction(() => document.body.classList.contains('sb-show-main') || document.body.classList.contains('sb-show-errordisplay'), null, { timeout: 15000 }).catch(() => errors.push('story never finished rendering'));
			await page.waitForTimeout(150);
			const state = await page.evaluate(() => ({
				error: document.body.classList.contains('sb-show-errordisplay') ? (document.querySelector('#error-message')?.textContent ?? 'error screen') : null,
				empty: !(document.querySelector('#storybook-root')?.childElementCount ?? 0) && !document.querySelector('[role="dialog"], dialog[open]'),
				theme: document.documentElement.dataset.theme
			}));
			if (state.error) errors.push(state.error.trim());
			if (state.empty) errors.push('rendered nothing');
			if (state.theme !== theme) errors.push(`theme is ${state.theme}, expected ${theme}`);
			if (errors.length) failures.push(`${s.title} › ${s.name} (${theme}): ${errors.join('; ')}`);
		}
		await ctx.close();
	}
} finally {
	await browser.close();
	server.close();
}

if (failures.length) {
	console.error(`Storybook check: ${failures.length} problem(s)\n` + failures.map((f) => `  ${f}`).join('\n'));
	process.exit(1);
}
console.log(`Storybook check: ${stories.length} stories render in light and dark with no errors.`);
