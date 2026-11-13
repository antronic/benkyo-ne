// Packs build/ into worker/.embed/assets.js for the embedded deploy
// (wrangler.embedded.jsonc). Text files are stored as strings, binaries as base64.
//
// The Worker script has a 3 MB (gzipped) limit, so the dictionary's numbered per-piece chunks
// (@johnmorrisdotca/jisho data r012.data.js, e123.data.js…, ~60 MB) are left out: they 404 in
// this deploy mode and src/lib/dict falls back to the common-words table ("not available
// offline / unverified"). App code, the common words and the dictionary manifests are kept.
// SvelteKit names chunks by hash only, so pieces are found through Vite's client manifest.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('../build/', import.meta.url).pathname;
const viteManifestPath = new URL('../.svelte-kit/output/client/.vite/manifest.json', import.meta.url).pathname;
const LIMIT_GZ = 2.8 * 1024 * 1024;
const DICT_PIECE = /@johnmorrisdotca\/jisho\/dist\/data\/.*\/[a-z]+\d+\.data\.js$/;

if (!existsSync(viteManifestPath)) {
	console.error(`embed-assets: ${viteManifestPath} not found; run \`npm run build\` first.`);
	process.exit(1);
}
const viteManifest = JSON.parse(readFileSync(viteManifestPath, 'utf8'));
const skip = new Set(
	Object.entries(viteManifest)
		.filter(([src]) => DICT_PIECE.test(src))
		.map(([, chunk]) => `/${chunk.file}`)
);
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
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
let skipped = 0;
let skippedBytes = 0;
for (const file of walk(root)) {
	const rel = '/' + relative(root, file).split('\\').join('/');
	if (rel === '/_headers') continue; // headers are applied in worker/embedded.ts
	if (skip.has(rel)) {
		skipped++;
		skippedBytes += statSync(file).size;
		continue;
	}
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
const script = `export const ASSETS = ${JSON.stringify(out)};\n`;
const gz = gzipSync(script, { level: 9 }).length;
console.log(`skipped ${skipped} dictionary piece chunks (${mb(skippedBytes)}); served from the network only in the normal deploy`);
console.log(`embedded ${Object.keys(out).length} files: ${mb(Buffer.byteLength(script))} raw, ${mb(gz)} gzipped (limit ${mb(LIMIT_GZ)})`);
if (gz > LIMIT_GZ) {
	console.error(`embed-assets: FAILED: ${mb(gz)} gzipped is over the ${mb(LIMIT_GZ)} budget for the 3 MB Worker limit.`);
	process.exit(1);
}
mkdirSync(new URL('../worker/.embed/', import.meta.url), { recursive: true });
writeFileSync(new URL('../worker/.embed/assets.js', import.meta.url), script);
