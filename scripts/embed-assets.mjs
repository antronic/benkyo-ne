// Packs build/ into worker/.embed/assets.js for the embedded deploy
// (wrangler.embedded.jsonc). Text files are stored as strings, binaries as base64.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../build/', import.meta.url).pathname;
const TYPES = {
	html: 'text/html; charset=utf-8',
	js: 'text/javascript; charset=utf-8',
	css: 'text/css; charset=utf-8',
	json: 'application/json',
	webmanifest: 'application/manifest+json',
	svg: 'image/svg+xml',
	png: 'image/png',
	wasm: 'application/wasm',
	txt: 'text/plain; charset=utf-8'
};
const TEXT = new Set(['html', 'js', 'css', 'json', 'webmanifest', 'svg', 'txt']);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const out = {};
for (const file of walk(root)) {
	const rel = '/' + relative(root, file).split('\\').join('/');
	if (rel === '/_headers') continue; // headers are applied in worker/embedded.ts
	const ext = rel.split('.').pop().toLowerCase();
	const buf = readFileSync(file);
	const text = TEXT.has(ext);
	out[rel] = {
		type: TYPES[ext] ?? 'application/octet-stream',
		body: text ? buf.toString('utf8') : buf.toString('base64'),
		b64: !text,
		etag: `"${createHash('sha1').update(buf).digest('hex').slice(0, 16)}"`
	};
}
mkdirSync(new URL('../worker/.embed/', import.meta.url), { recursive: true });
writeFileSync(new URL('../worker/.embed/assets.js', import.meta.url), `export const ASSETS = ${JSON.stringify(out)};\n`);
console.log(`embedded ${Object.keys(out).length} files`);
