import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STROKES } from '#lib/content/strokes.ts';
import { createJsMatcher, createWasmMatcher, type Pt } from './match.ts';

/** Turn a template back into "hand-drawn" strokes with a little jitter. */
function draw(char: string, { scale = 1, dx = 0, dy = 0, jitter = 0.01, seed = 1 } = {}): Pt[][] {
	let s = seed;
	const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * jitter;
	return STROKES[char].p.map((flat) => {
		const pts: Pt[] = [];
		for (let i = 0; i < flat.length; i += 2) pts.push([flat[i] * scale + dx + rnd(), flat[i + 1] * scale + dy + rnd()]);
		return pts;
	});
}

const wasmBytes = readFileSync(new URL('../../../static/wasm/stroke.wasm', import.meta.url));

for (const [name, make] of [
	['js', async () => createJsMatcher()],
	['wasm', () => createWasmMatcher(wasmBytes)]
] as const) {
	describe(`${name} matcher`, () => {
		it('recognises characters drawn at a different size/position', async () => {
			const m = await make();
			for (const ch of ['あ', 'き', 'ぬ', 'め', 'シ', 'ツ', 'ソ', 'ン']) {
				const best = m.recognize(draw(ch, { scale: 0.6, dx: 0.2, dy: 0.1 }), 3);
				expect(best[0].char, `drawing ${ch}`).toBe(ch);
			}
		});

		it('penalises reversed stroke direction (ソ vs ン style errors)', async () => {
			const m = await make();
			const good = m.grade('ン', draw('ン'));
			const reversed = m.grade('ン', draw('ン').map((s) => [...s].reverse()));
			expect(reversed.score).toBeGreaterThan(good.score * 3);
		});

		it('rejects a short stroke traced backwards', async () => {
			const m = await make();
			const strokes = draw('あ');
			strokes[0] = [...strokes[0]].reverse();
			const r = m.grade('あ', strokes);
			expect(r.perStroke[0]).toBeGreaterThan(0.25);
			expect(r.perStroke[1]).toBeLessThan(0.05);
		});

		it('grades a trace and reports per-stroke distances', async () => {
			const m = await make();
			const r = m.grade('か', draw('か'));
			expect(r.perStroke).toHaveLength(3);
			expect(r.score).toBeLessThan(0.05);
		});
	});
}

it('wasm and js agree', async () => {
	const js = createJsMatcher();
	const wasm = await createWasmMatcher(wasmBytes);
	const strokes = draw('ね', { jitter: 0.03 });
	expect(wasm.recognize(strokes, 1)[0].char).toBe(js.recognize(strokes, 1)[0].char);
	expect(wasm.grade('ね', strokes).score).toBeCloseTo(js.grade('ね', strokes).score, 4);
});
