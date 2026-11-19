import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kitCoverage, lintComponent, lintSpin } from '../../../scripts/check-ui.mjs';

const rules = (src: string) => lintComponent(src, 'x.svelte').map((p) => `${p.line}:${p.rule}`);

describe('UI kit lint (scripts/check-ui.mjs)', () => {
	it('flags raw native controls in app markup', () => {
		const src = ['<script>let v = $state("");</script>', '<select bind:value={v}></select>', '<button>Go</button>', '<input bind:value={v} />', '<textarea></textarea>'].join('\n');
		expect(rules(src)).toEqual(['2:raw-control', '3:raw-control', '4:raw-control', '5:raw-control']);
	});

	it('flags hand-made kit looks but not look-alike class names', () => {
		const src = ['<div class="glass card">x</div>', '<a class="btn small" href="/">x</a>', '<span class:chip={on}>x</span>', '<div class="glass-edge chips btn-row">ok</div>'].join('\n');
		expect(rules(src)).toEqual(['1:adhoc-class', '2:adhoc-class', '3:adhoc-class']);
	});

	it('allows kit components, ui-ok lines and ui-ok-file', () => {
		expect(rules('<Button onclick={go}>Go</Button>\n<Select options={o} bind:value={v} label="x" />')).toEqual([]);
		expect(rules('<canvas></canvas><input type="file" hidden /> <!-- ui-ok: native picker -->')).toEqual([]);
		expect(rules('<!-- ui-ok-file: app shell -->\n<nav class="glass"><button>x</button></nav>')).toEqual([]);
	});

	it('ignores tags inside <script> and <style>', () => {
		expect(rules('<script>const html = "<button>";</script>\n<style>.glass { color: red; }</style>')).toEqual([]);
	});

	it('flags async work with no loading state', () => {
		const bare = '<script>\n\tlet rows = $state([]);\n\tonMount(async () => (rows = await load()));\n</script>\n{#each rows as r}<p>{r}</p>{/each}';
		expect(rules(bare)).toEqual(['3:loading-state']);
		const withSkeleton = bare + '\n{#if !rows.length}<Skeleton />{/if}';
		expect(rules(withSkeleton)).toEqual([]);
		const busy = '<script>\n\tasync function save() { await put(); }\n</script>\n<Button busy={saving} onclick={save}>Save</Button>';
		expect(rules(busy)).toEqual([]);
		const local = '<script>\n\tonMount(async () => (x = await meta.get("k"))); // ui-ok: instant local read\n</script>';
		expect(rules(local)).toEqual([]);
	});

	it('flags full-turn spins on an element box (they wobble in Safari)', () => {
		const spin = (src: string) => lintSpin(src, 'x.svelte').map((p) => `${p.line}:${p.rule}`);
		expect(spin('@keyframes spin {\n\tto { transform: rotate(1turn); }\n}')).toEqual(['2:spin-box']);
		expect(spin('to { transform: rotate( 360deg ) }')).toEqual(['1:spin-box']);
		expect(spin('to { transform: rotate(-1turn); } /* spin-ok: inside an svg */')).toEqual([]);
		// Small tilts and 3D turns are not spinners.
		expect(spin('50% { transform: scale(1.1) rotate(6deg); }\nto { transform: rotateY(360deg); }')).toEqual([]);
	});

	it('the Spinner turns an SVG <g> around its centre, not its own box', () => {
		const src = readFileSync(new URL('./Spinner.svelte', import.meta.url), 'utf8');
		expect(src).toMatch(/<g class="turn">/);
		expect(src).toMatch(/\.turn \{[^}]*transform-origin: 12px 12px;[^}]*animation: spinner-turn/);
		expect(src).not.toMatch(/\.(ring|spinner) \{[^}]*animation:/);
	});

	it('every kit component is exported and shown on /design', () => {
		expect(kitCoverage()).toEqual([]);
	});
});
