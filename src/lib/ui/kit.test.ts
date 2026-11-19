import { describe, expect, it } from 'vitest';
import { kitCoverage, lintComponent } from '../../../scripts/check-ui.mjs';

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

	it('every kit component is exported and shown on /design', () => {
		expect(kitCoverage()).toEqual([]);
	});
});
