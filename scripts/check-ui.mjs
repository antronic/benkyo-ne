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
 *   loading-state a component whose script awaits something must show it in the
 *                 markup: <Skeleton>, <Spinner>, <ProgressRing>, a `busy` Button
 *                 or aria-busy.
 * And for the kit:
 *   kit-export    every src/lib/ui/*.svelte is exported from src/lib/ui/index.ts;
 *   kit-catalog   every kit component is shown on /design (src/routes/design/+page.svelte).
 *
 * A deliberate exception carries `ui-ok: <reason>` on its line (in a
 * `<!-- -->` or `//` comment). `ui-ok-file: <reason>` anywhere in a file
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
const ADHOC = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})|\bclass:(btn|glass|chip|switch)\b/g;
const ADHOC_WORD = /(?<![\w-])(btn|glass|chip|switch)(?![\w-])/;
const KIT_FOR_CLASS = { btn: 'Button', glass: 'Card or ListGroup', chip: 'Chip', switch: 'Switch' };
const ASYNC = /\bawait\b|\.then\(/;
const LOADING = /<(Skeleton|Spinner|ProgressRing)\b|\bbusy\b|aria-busy/;

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
	const markup = lines.join('\n');
	if (!LOADING.test(markup)) {
		for (const s of scripts(text)) {
			const sl = s.body.split('\n');
			const hit = sl.findIndex((l) => ASYNC.test(l) && !EXEMPT.test(l) && !/^\s*(\/\/|\*)/.test(l));
			if (hit >= 0) {
				problems.push({
					file,
					line: s.startLine + hit,
					rule: 'loading-state',
					message: 'async work with no loading state: show <Skeleton>, <Spinner> or a busy Button while it runs (or mark the line ui-ok: reason, e.g. "instant local read")'
				});
				break;
			}
		}
	}
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

function walk(dir, files = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, files);
		else if (name.endsWith('.svelte')) files.push(p);
	}
	return files;
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
	const problems = [...files.flatMap(lintFile), ...kitCoverage()];
	if (problems.length) {
		print(problems);
		console.error(`\n${problems.length} UI kit problem(s). See docs/DESIGN-SYSTEM.md (Kit only, Loading states).`);
		process.exit(1);
	}
	console.log(`UI kit lint: ${files.length} files, every control from the kit, every kit component on /design, loading states shown.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
