#!/usr/bin/env node
/**
 * Spacing lint: padding, margin and gap must come from the spacing scale in
 * src/lib/design/tokens.css (`var(--space-*)`), not hard-coded pixels.
 *
 *   node scripts/check-spacing.mjs                 check every .svelte and .css file under src/
 *   node scripts/check-spacing.mjs <files…>        check only these files
 *   node scripts/check-spacing.mjs --fix [files…]  rewrite px values to the nearest token
 *   node scripts/check-spacing.mjs --hook          Claude Code PostToolUse hook (reads the tool call on stdin)
 *
 * Allowed without a token: 0, hairlines (≤ 1px), and any line carrying a
 * `ui-ok: <reason>` comment for a deliberate exception (a bleed, a clearance
 * for a fixed bar). `--fix` snaps an off-scale value to the nearest step
 * (ties round up, so tight spots get roomier) and leaves values above the
 * scale for a person to decide.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The spacing scale. Keep in step with --space-* in src/lib/design/tokens.css (spacing.test.ts checks). */
export const SCALE = [
	[2, '--space-px'],
	[4, '--space-1'],
	[6, '--space-1h'],
	[8, '--space-2'],
	[12, '--space-3'],
	[16, '--space-4'],
	[20, '--space-5'],
	[24, '--space-6'],
	[32, '--space-8'],
	[40, '--space-10'],
	[48, '--space-12']
];

const PROP = String.raw`(?:padding|margin|gap|row-gap|column-gap|--gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?`;
/** `padding: 12px 16px;` in CSS, a <style> block or a style="" attribute. */
const DECL = new RegExp(String.raw`(^|[\s;{"'])(${PROP})(\s*:\s*)([^;{}"'\n]+)`, 'g');
/** `style:padding="12px"` and `style:--gap="8px"` directives in Svelte markup. */
const DIRECTIVE = new RegExp(String.raw`(style:)(${PROP})(=")([^"]+)(")`, 'g');
const PX = /(-?)(\d*\.?\d+)px\b/g;
const EXEMPT = /ui-ok\b/;

/** The token for a pixel value, snapped to the nearest step (ties go up). Null above the scale. */
export function tokenFor(px) {
	if (px > SCALE[SCALE.length - 1][0]) return null;
	let best = SCALE[0];
	for (const step of SCALE) {
		const d = Math.abs(step[0] - px);
		const bd = Math.abs(best[0] - px);
		if (d < bd || (d === bd && step[0] > best[0])) best = step;
	}
	return best;
}

function scanValue(value, report) {
	return value.replace(PX, (m, neg, num) => {
		const n = Number(num);
		if (n <= 1) return m; // 0 and hairlines
		const step = tokenFor(n);
		report(m, step);
		if (!step) return m;
		return neg ? `calc(-1 * var(${step[1]}))` : `var(${step[1]})`;
	});
}

/** Lint one file's text. Returns { problems, fixed }. */
export function lintText(text, file = '<text>') {
	const problems = [];
	const lines = text.split('\n');
	// Blank out <script> blocks in Svelte files so JS like `gap: 8` never matches.
	const isSvelte = file.endsWith('.svelte');
	const out = lines.map((line, i) => {
		if (EXEMPT.test(line)) return line;
		const at = (m, step) =>
			problems.push({
				file,
				line: i + 1,
				value: m,
				suggestion: step ? `var(${step[1]})${step[0] !== Math.abs(parseFloat(m)) ? ` (snaps ${Math.abs(parseFloat(m))}px to ${step[0]}px)` : ''}` : 'above the scale: use a token or mark the line ui-ok with a reason'
			});
		let next = line.replace(DECL, (all, pre, prop, colon, value) => pre + prop + colon + scanValue(value, at));
		if (isSvelte) next = next.replace(DIRECTIVE, (all, s, prop, eq, value, q) => s + prop + eq + scanValue(value, at) + q);
		return next;
	});
	return { problems, fixed: out.join('\n') };
}

function stripScripts(text) {
	// Keep line numbers: replace script bodies with blank lines.
	return text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (_, a, body, c) => a + body.replace(/[^\n]/g, '') + c);
}

function lintFile(path, fix) {
	const raw = readFileSync(path, 'utf8');
	const rel = relative(ROOT, path);
	const isSvelte = path.endsWith('.svelte');
	const text = isSvelte ? stripScripts(raw) : raw;
	const { problems, fixed } = lintText(text, rel);
	if (fix && problems.length) {
		// Re-apply on the original so <script> blocks stay untouched.
		if (isSvelte) {
			const scripts = [...raw.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);
			let k = 0;
			writeFileSync(path, fixed.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, () => scripts[k++]));
		} else writeFileSync(path, fixed);
	}
	return problems;
}

function walk(dir, files = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, files);
		else if (/\.(svelte|css)$/.test(name)) files.push(p);
	}
	return files;
}

/** Files the lint covers: UI code under src/. The token file defines the scale itself. */
function inScope(path) {
	const rel = relative(ROOT, resolve(path));
	return /^src\/.*\.(svelte|css)$/.test(rel) && rel !== 'src/lib/design/tokens.css';
}

function print(problems) {
	for (const p of problems) console.error(`${p.file}:${p.line}  ${p.value}  →  ${p.suggestion}`);
}

async function main() {
	const args = process.argv.slice(2);
	const fix = args.includes('--fix');

	if (args.includes('--hook')) {
		// Claude Code PostToolUse: exit 2 sends stderr back to the agent so it fixes the edit.
		let input = '';
		for await (const chunk of process.stdin) input += chunk;
		let path;
		try {
			path = JSON.parse(input)?.tool_input?.file_path;
		} catch {
			return;
		}
		if (!path || !existsSync(path) || !inScope(path)) return;
		const problems = lintFile(path, false);
		if (problems.length) {
			console.error('Spacing lint: use the spacing tokens from src/lib/design/tokens.css (docs/DESIGN-SYSTEM.md).');
			print(problems);
			console.error('Run `node scripts/check-spacing.mjs --fix <file>` or mark a deliberate exception with `/* ui-ok: reason */`.');
			process.exit(2);
		}
		return;
	}

	const given = args.filter((a) => !a.startsWith('--'));
	const files = (given.length ? given.map((f) => resolve(f)) : walk(join(ROOT, 'src'))).filter(inScope);
	const problems = files.flatMap((f) => lintFile(f, fix));
	if (fix) {
		const left = files.flatMap((f) => lintFile(f, false));
		console.log(`Fixed ${problems.length - left.length} value(s) in ${new Set(problems.map((p) => p.file)).size} file(s).`);
		if (left.length) {
			print(left);
			console.error(`${left.length} value(s) need a person: above the scale.`);
			process.exit(1);
		}
		return;
	}
	if (problems.length) {
		print(problems);
		console.error(`\n${problems.length} hard-coded spacing value(s). Use var(--space-*) (docs/DESIGN-SYSTEM.md), run with --fix, or mark a deliberate exception with /* ui-ok: reason */.`);
		process.exit(1);
	}
	console.log(`Spacing lint: ${files.length} files, no hard-coded spacing.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
