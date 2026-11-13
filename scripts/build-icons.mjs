// Renders static/icons/*.svg to the PNG sizes PWAs and iOS need.
// Uses the globally installed Playwright (run with NODE_PATH=$(npm root -g)).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, size, out] of [
	['icon.svg', 180, 'icon-180.png'],
	['icon.svg', 192, 'icon-192.png'],
	['icon.svg', 512, 'icon-512.png'],
	['maskable.svg', 512, 'maskable-512.png']
]) {
	const svg = readFileSync(new URL(`../static/icons/${src}`, import.meta.url), 'utf8');
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`
	);
	await page.screenshot({ path: new URL(`../static/icons/${out}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
console.log('icons written');
