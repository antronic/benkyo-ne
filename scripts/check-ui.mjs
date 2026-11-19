#!/usr/bin/env node
/**
 * UI kit lint: every control in the app comes from the kit, every kit
 * component is on /design, and async work shows the user a loading state.
 *
 *   node scripts/check-ui.mjs              check every .svelte file under src/
 *   node scripts/check-ui.mjs <files…>     check only these files (plus kit coverage)
 *   node scripts/check-ui.mjs --hook       Claude Code PostToolUse hook (reads the tool call on stdin)
 *
 * Rules (outside src/lib/ui, which is the kit itself):
 *   raw-control   no <button>, <input>, <select> or <textarea>: use Button,
 *                 IconButton, Chip, ListRow, Card, TextField, TextArea, Select,
 *                 Checkbox, Switch, Slider or FileButton from '#lib/ui/index.ts'.
 *   adhoc-class   no hand-made kit looks: class="btn", "glass", "chip" or
 *                 "switch" (use Button, Card/ListGroup, Chip, Switch).
 *   loading-state every piece of async work shows itself while it runs. Each
 *                 async function or arrow that awaits something must set a value
 *                 that the markup uses next to a loading marker (<Skeleton>,
 *                 <Spinner>, <ProgressRing>, `busy`, aria-busy): on the marker's
 *                 own line or in an {#if}/{#await} around it. Or it calls
 *                 busyToast(), or awaits a function in the same file that does
 *                 this. One spinner elsewhere in the file no longer covers it
 *                 (that let the invite and promo-link loads through, 2026-11-19).
 *                 Waits that are not loading (tick, timers, confirm sheets,
 *                 clipboard, goto) don't count.
 *   spin-box      (every .svelte and .css under src/, the kit too) no full-turn rotate
 *                 animation (rotate(1turn) / rotate(360deg)) on an element: Safari
 *                 rotates the box around a pixel-snapped pivot, so it wobbles at
 *                 fractional positions. Use <Spinner>, which turns an SVG <g>
 *                 inside a still box. `spin-ok: reason` on the line exempts it.
 * And for the kit:
 *   kit-export    every src/lib/ui/*.svelte is exported from src/lib/ui/index.ts;
 *   kit-catalog   every kit component is shown on /design (src/routes/design/+page.svelte).
 *
 * A deliberate exception carries `ui-ok: <reason>` on its line (in a
 * `<!-- -->` or `//` comment); on an async function's first line it covers the
 * whole function. `ui-ok-file: <reason>` anywhere in a file
 * exempts the whole file from raw-control and adhoc-class (the app shell:
 * the tab bar, drawing canvases).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = 'src/lib/ui';
const CATALOG = 'src/routes/design/+page.svelte';

const EXEMPT = /ui-ok\b/;
const FILE_EXEMPT = /ui-ok-file\b/;
const RAW = /<(button|input|select|textarea)\b/g;
const KIT_FOR = {
	button: 'Button, IconButton, Chip, ListRow or Card with onclick',
	input: 'TextField, Checkbox, Switch, Slider or FileButton',
	select: 'Select',
	textarea: 'TextArea'
};
const ADHOC = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})|\bclass:(btn|glass|card|chip|switch)\b/g;
const ADHOC_WORD = /(?<![\w-])(btn|glass|card|chip|switch)(?![\w-])/;
const KIT_FOR_CLASS = { btn: 'Button', glass: 'Card or ListGroup', card: 'Card', chip: 'Chip', switch: 'Switch' };
const ASYNC = /\bawait\b|\.then\(/;
const LOADING = /<(Skeleton|Spinner|ProgressRing)\b|\bbusy\b|aria-busy/;
const FULL_TURN = /\brotate\(\s*-?(1turn|360deg|6\.28\d*rad|400grad)\s*\)/;
const SPIN_OK = /spin-ok\b/;

/** Blank out <script> and <style> bodies, keeping line numbers. */
function markupOnly(text) {
	return text.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (_, a, _t, body, c) => a + body.replace(/[^\n]/g, '') + c);
}
function scripts(text) {
	const out = [];
	for (const m of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
		const startLine = text.slice(0, m.index).split('\n').length;
		out.push({ body: m[1], startLine });
	}
	return out;
}

/** Waits that are not "loading": the user already sees what happens. */
const NOT_LOADING = /\bawait\s+(?:tick\(|new Promise\b|confirmDestructive\(|actionSheet\(|navigator\.(?:clipboard|share)\b|goto\(|ui\.backGuard\(|navigation\.complete\b)/;
/** Words that tell the user something is under way: such text needs a spinner beside it. */
const WAIT_TEXT = />[^<{]*\b(?:Loading|Asking|Opening|Checking|Saving|Sending|Fetching|Preparing)\b[^<{]*…/;
const IDENT = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g;
const KEYWORDS = new Set(['if', 'else', 'each', 'await', 'then', 'catch', 'key', 'snippet', 'as', 'true', 'false', 'null', 'undefined', 'const', 'let', 'return', 'new', 'typeof', 'void', 'await']);

/** Identifiers (and their first segment) on a piece of text. */
function idents(text, into = new Set()) {
	for (const m of text.matchAll(IDENT)) {
		if (KEYWORDS.has(m[0])) continue;
		into.add(m[0]);
		into.add(m[0].split('.')[0]);
	}
	return into;
}

/** What the markup's loading markers depend on: the marker line plus every block opener around it. */
function loadingIdents(markupLines) {
	const out = new Set();
	const stack = [];
	markupLines.forEach((line) => {
		for (const m of line.matchAll(/\{([#/:])(\w+)?([^}]*)\}/g)) {
			if (m[1] === '#') stack.push(m[3]);
			else if (m[1] === '/') stack.pop();
			else if (stack.length) stack[stack.length - 1] += ' ' + m[3]; // {:else if …}
		}
		if (LOADING.test(line)) {
			idents(line, out);
			for (const opener of stack) idents(opener, out);
		}
	});
	return out;
}

/** Async functions and arrows in a script: { name, body, line } (line of the first real await). */
function asyncUnits(body, startLine) {
	const units = [];
	const re = /async\s+function\s*\*?\s*([\w$]*)\s*(?:<[^>]*>)?\s*\([^)]*\)[^{]*\{|(?:(?:const|let)\s+([\w$]+)\s*=\s*)?async\s*(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>\s*(\{|\()?/g;
	for (const m of body.matchAll(re)) {
		const name = m[1] || m[2] || '';
		// an anonymous arrow passed straight to a call: guard(async () => …)
		const callee = name ? '' : (body.slice(Math.max(0, m.index - 60), m.index).match(/([\w$]+)\(\s*(?:[^()]*,\s*)?$/)?.[1] ?? '');
		let start = m.index + m[0].length;
		let text;
		const opener = m[0].endsWith('{') ? '{' : m[0].endsWith('(') ? '(' : null;
		if (opener) {
			const close = opener === '{' ? '}' : ')';
			let depth = 1, i = start;
			for (; i < body.length && depth; i++) {
				if (body[i] === opener) depth++;
				else if (body[i] === close) depth--;
			}
			text = body.slice(start, i - 1);
		} else {
			const end = body.indexOf('\n', start);
			text = body.slice(start, end < 0 ? body.length : end);
		}
		const pre = body.slice(0, start).split('\n').length - 1;
		// ui-ok on the function's own line covers the whole function
		const declLine = body.slice(body.lastIndexOf('\n', m.index) + 1, body.indexOf('\n', m.index) < 0 ? body.length : body.indexOf('\n', m.index));
		if (EXEMPT.test(declLine)) {
			units.push({ name, callee: '', text, from: start, to: start, line: -1 });
			continue;
		}
		const ls = text.split('\n');
		const hit = ls.findIndex((l) => /\bawait\b/.test(l) && !NOT_LOADING.test(l) && !/^\s*(\/\/|\*)/.test(l) && !EXEMPT.test(l));
		units.push({ name, callee, text, from: start, to: start + text.length, line: hit < 0 ? -1 : startLine + pre + hit });
	}
	return units;
}

function loadingProblems(text, markupLines) {
	const seen = loadingIdents(markupLines);
	const units = scripts(text).flatMap((s, i) => asyncUnits(s.body, s.startLine).map((u) => ({ ...u, script: i })));
	const ok = new Set();
	const okNames = new Set();
	const shows = (u) => {
		if (u.line < 0 || /\bbusyToast\(/.test(u.text) || (u.callee && okNames.has(u.callee))) return true;
		// an arrow inside a function that already shows its state (items.map(async …) in a busy save)
		if (!u.name && [...ok].some((o) => o.script === u.script && o.from <= u.from && u.to <= o.to)) return true;
		for (const m of u.text.matchAll(/(?<![=!<>])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?:=(?![=>])|\+\+|--|\+=|-=)/g)) {
			if (seen.has(m[1]) || seen.has(m[1].split('.')[0])) return true;
		}
		for (const name of okNames) if (new RegExp(String.raw`\bawait\s+${name.replace(/\$/g, '\\$')}\(`).test(u.text)) return true;
		return false;
	};
	// a helper that shows the state covers the functions that await it
	for (let changed = true; changed; ) {
		changed = false;
		for (const u of units) if (!ok.has(u) && shows(u)) (ok.add(u), u.name && okNames.add(u.name), (changed = true));
	}
	return units
		.filter((u) => !ok.has(u))
		.map((u) => ({
			line: u.line,
			rule: 'loading-state',
			message: `async work${u.name ? ` in ${u.name}()` : ''} with no loading state: set a flag the markup shows with <Skeleton>, <Spinner> or a busy Button (on that line or in an {#if} around it), call busyToast(), or mark the line ui-ok: reason (e.g. "instant local read")`
		}));
}

/** Lint one component's text. Returns problems: { file, line, rule, message }. */
export function lintComponent(text, file = '<text>') {
	const problems = [];
	const lines = markupOnly(text).split('\n');
	const fileExempt = FILE_EXEMPT.test(text);
	if (!fileExempt) {
		lines.forEach((line, i) => {
			if (EXEMPT.test(line)) return;
			for (const m of line.matchAll(RAW)) {
				problems.push({ file, line: i + 1, rule: 'raw-control', message: `raw <${m[1]}>: use ${KIT_FOR[m[1]]} from #lib/ui` });
			}
			for (const m of line.matchAll(ADHOC)) {
				const word = m[4] ?? (m[1] ?? m[2] ?? m[3] ?? '').match(ADHOC_WORD)?.[1];
				if (word) problems.push({ file, line: i + 1, rule: 'adhoc-class', message: `class "${word}" by hand: use ${KIT_FOR_CLASS[word]} from #lib/ui` });
			}
		});
	}
	for (const p of loadingProblems(text, lines)) problems.push({ file, ...p });
	lines.forEach((line, i) => {
		if (WAIT_TEXT.test(line) && !LOADING.test(line) && !EXEMPT.test(line))
			problems.push({ file, line: i + 1, rule: 'loading-state', message: 'text says something is under way: put a <Spinner> (or Skeleton) with it so it reads as loading, not as a message' });
	});
	return problems;
}

/**
 * Spinning boxes: a full-turn rotate keyframe in any component or stylesheet.
 * Safari wobbles these (see Spinner.svelte), so every spinner is the kit Spinner.
 */
export function lintSpin(text, file = '<text>') {
	const problems = [];
	text.split('\n').forEach((line, i) => {
		if (FULL_TURN.test(line) && !SPIN_OK.test(line))
			problems.push({ file, line: i + 1, rule: 'spin-box', message: 'spinning an element wobbles in Safari: use <Spinner> from #lib/ui (or mark the line spin-ok: reason)' });
	});
	return problems;
}

/** Kit coverage: every kit component exported and shown on /design. */
export function kitCoverage(root = ROOT) {
	const problems = [];
	const dir = join(root, KIT);
	const index = readFileSync(join(dir, 'index.ts'), 'utf8');
	const catalog = readFileSync(join(root, CATALOG), 'utf8');
	for (const f of readdirSync(dir).filter((n) => n.endsWith('.svelte'))) {
		const name = basename(f, '.svelte');
		if (!new RegExp(String.raw`as ${name} \} from '\./${name}\.svelte'`).test(index))
			problems.push({ file: `${KIT}/index.ts`, line: 1, rule: 'kit-export', message: `${name} is not exported: add \`export { default as ${name} } from './${name}.svelte';\`` });
		if (!new RegExp(String.raw`<${name}\b`).test(catalog))
			problems.push({ file: CATALOG, line: 1, rule: 'kit-catalog', message: `${name} is not shown on /design: add an example so it is in the catalog` });
	}
	return problems;
}

function walk(dir, files = [], ext = /\.svelte$/) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, files, ext);
		else if (ext.test(name)) files.push(p);
	}
	return files;
}
/** Files the spin-box rule covers: every component and stylesheet under src/. */
function spinScope(path) {
	return /^src\/.*\.(svelte|css|html)$/.test(rel(path));
}
function rel(p) {
	return relative(ROOT, resolve(p));
}
/** Components the control rules cover: app code under src/, not the kit. */
function inScope(path) {
	const r = rel(path);
	return /^src\/.*\.svelte$/.test(r) && !r.startsWith(KIT + '/');
}
function lintFile(path) {
	return lintComponent(readFileSync(path, 'utf8'), rel(path));
}
function print(problems) {
	for (const p of problems) console.error(`${p.file}:${p.line}  [${p.rule}]  ${p.message}`);
}

async function main() {
	const args = process.argv.slice(2);
	if (args.includes('--hook')) {
		let input = '';
		for await (const chunk of process.stdin) input += chunk;
		let path;
		try {
			path = JSON.parse(input)?.tool_input?.file_path;
		} catch {
			return;
		}
		if (!path || !existsSync(path)) return;
		const r = rel(path);
		const problems = [];
		if (inScope(path)) problems.push(...lintFile(path));
		if (spinScope(path)) problems.push(...lintSpin(readFileSync(path, 'utf8'), r));
		if (r.startsWith(KIT + '/') || r === CATALOG) problems.push(...kitCoverage());
		if (problems.length) {
			console.error('UI kit lint: controls come from the kit, the kit is on /design, async work shows a loading state (docs/DESIGN-SYSTEM.md).');
			print(problems);
			console.error('Use the kit component, or mark a deliberate exception with `ui-ok: reason` on the line.');
			process.exit(2);
		}
		return;
	}
	const given = args.filter((a) => !a.startsWith('--'));
	const files = (given.length ? given.map((f) => resolve(f)) : walk(join(ROOT, 'src'))).filter(inScope);
	const spinFiles = (given.length ? given.map((f) => resolve(f)) : walk(join(ROOT, 'src'), [], /\.(svelte|css|html)$/)).filter(spinScope);
	const problems = [...files.flatMap(lintFile), ...spinFiles.flatMap((f) => lintSpin(readFileSync(f, 'utf8'), rel(f))), ...kitCoverage()];
	if (problems.length) {
		print(problems);
		console.error(`\n${problems.length} UI kit problem(s). See docs/DESIGN-SYSTEM.md (Kit only, Loading states).`);
		process.exit(1);
	}
	console.log(`UI kit lint: ${files.length} files, every control from the kit, every kit component on /design, loading states shown, no box spinners.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
