<!--
	Drawing pad. Two modes:
	  trace  — guide visible; each stroke is checked as soon as the pen lifts
	           (position, shape and direction). A wrong stroke is rejected and the
	           correct one is demonstrated.
	  recall — blank grid; the finished drawing is recognised by the matcher.
	Grading runs in WASM (wasm/stroke), with a JS fallback.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { familyOf, strokesOf } from '#lib/content/strokes.ts';
	import { getMatcher, type Matcher, type Pt } from '#lib/handwriting/match.ts';
	import { haptic } from '#lib/state/progress.svelte.ts';

	interface Props {
		char: string;
		mode?: 'trace' | 'recall';
		size?: number | string;
		/** called when every stroke is done (trace) or on "Check" (recall) */
		oncomplete?: (r: { correct: boolean; mistakes: number; guess?: string }) => void;
	}
	let { char, mode = 'trace', size = 280, oncomplete }: Props = $props();

	const STROKE_OK = 0.11; // mean DTW distance in 0..1 units

	const data = $derived(strokesOf(char));
	let matcher: Matcher | null = $state(null);
	let svg: SVGSVGElement;
	let strokes: Pt[][] = $state([]);
	let current: Pt[] | null = $state(null);
	let mistakes = $state(0);
	let flash = $state<'ok' | 'bad' | null>(null);
	let hintIndex = $state(-1);
	let done = $state(false);

	onMount(async () => {
		matcher = await getMatcher();
	});

	export function reset() {
		strokes = [];
		current = null;
		done = false;
		hintIndex = -1;
	}

	const toPt = (e: PointerEvent): Pt => {
		const r = svg.getBoundingClientRect();
		return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
	};

	function down(e: PointerEvent) {
		if (done) return;
		svg.setPointerCapture(e.pointerId);
		current = [toPt(e)];
		hintIndex = -1;
	}
	function move(e: PointerEvent) {
		if (!current) return;
		const evs = e.getCoalescedEvents?.() ?? [e];
		for (const ev of evs) current.push(toPt(ev));
	}
	function up() {
		if (!current) return;
		const s = current;
		current = null;
		if (s.length < 2) s.push([s[0][0] + 0.001, s[0][1] + 0.001]); // a dot
		if (mode === 'recall') {
			strokes = [...strokes, s];
			return;
		}
		checkTraceStroke(s);
	}

	function checkTraceStroke(s: Pt[]) {
		if (!matcher || !data) return;
		const i = strokes.length;
		const r = matcher.grade(char, [...strokes, s]);
		const d = r.perStroke[i];
		if (d >= 0 && d < STROKE_OK) {
			strokes = [...strokes, s];
			pulse('ok');
			haptic('selection');
			if (strokes.length === data.d.length) {
				done = true;
				setTimeout(() => oncomplete?.({ correct: mistakes < 3, mistakes }), 450);
			}
		} else {
			mistakes++;
			pulse('bad');
			haptic('error');
			hintIndex = i; // demonstrate the expected stroke
		}
	}

	function pulse(kind: 'ok' | 'bad') {
		flash = kind;
		setTimeout(() => (flash = null), 420);
	}

	export function check() {
		if (!matcher || strokes.length === 0) return;
		// compare kana with kana and kanji with kanji (口 and ロ are the same shape)
		const best = matcher.recognize(strokes, 3, familyOf(char));
		const guess = best[0]?.char;
		// Accept if it's the top match, or close to it with the right stroke count.
		const own = matcher.grade(char, strokes);
		const correct =
			guess === char || (strokes.length === data?.d.length && own.score < (best[0]?.score ?? 0) + 0.02);
		done = true;
		oncomplete?.({ correct, mistakes: correct ? 0 : 1, guess });
	}

	export function undo() {
		strokes = strokes.slice(0, -1);
	}

	const poly = (pts: Pt[]) => pts.map(([x, y]) => `${(x * 109).toFixed(1)},${(y * 109).toFixed(1)}`).join(' ');
</script>

<div class="pad" class:ok={flash === 'ok'} class:bad={flash === 'bad'} style:--size={typeof size === 'number' ? `${size}px` : size}>
	<svg
		bind:this={svg}
		viewBox="0 0 109 109"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		role="application"
		aria-label={t('a11y.drawingPad', { char })}
	>
		<g class="grid">
			<path d="M54.5 4 V105 M4 54.5 H105" />
		</g>
		{#if mode === 'trace' && data}
			<g class="guide">
				{#each data.d as d, i}
					<path {d} class:next={i === strokes.length && !done} />
				{/each}
			</g>
			{#if hintIndex >= 0}
				{#key mistakes}
					<path d={data.d[hintIndex]} class="hint" pathLength="1" />
				{/key}
			{/if}
			{#if !done && strokes.length < data.n.length}
				{@const [nx, ny] = data.n[strokes.length]}
				<circle cx={nx + 3} cy={ny - 3} r="5.5" class="start" />
				<text x={nx + 3} y={ny - 0.6} class="start-num">{strokes.length + 1}</text>
			{/if}
		{/if}
		<g class="ink">
			{#each strokes as s, i}
				{#if mode === 'trace' && data}
					<path d={data.d[i]} class="snapped" />
				{:else}
					<polyline points={poly(s)} />
				{/if}
			{/each}
			{#if current}<polyline points={poly(current)} class="live" />{/if}
		</g>
	</svg>
</div>

<style>
	.pad {
		width: var(--size);
		max-width: 100%;
		aspect-ratio: 1;
		border-radius: var(--r-l);
		background: var(--glass-strong);
		border: 0.5px solid var(--glass-edge);
		box-shadow: var(--glass-shadow);
		transition:
			box-shadow 300ms,
			transform 400ms var(--spring);
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.pad.ok {
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--success) 45%, transparent),
			var(--glass-shadow);
		transform: scale(1.01);
	}
	.pad.bad {
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--danger) 45%, transparent),
			var(--glass-shadow);
		animation: shake 420ms var(--ease-out);
	}
	svg {
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
	}
	.grid path {
		stroke: var(--hairline);
		stroke-width: 0.6;
		stroke-dasharray: 2 3;
		fill: none;
	}
	.guide path {
		fill: none;
		stroke: var(--ink-3);
		opacity: 0.25;
		stroke-width: 6;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: opacity 300ms, stroke 300ms;
	}
	.guide path.next {
		opacity: 0.6;
		stroke: var(--accent-2);
	}
	.hint {
		fill: none;
		stroke: var(--accent);
		stroke-width: 6;
		stroke-linecap: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 900ms var(--ease-out) forwards;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.start {
		fill: var(--accent-2);
		animation: pop 1.6s ease-in-out infinite;
		transform-box: fill-box;
		transform-origin: center;
	}
	.start-num {
		font-size: 7px;
		font-weight: 700;
		text-anchor: middle;
		fill: #fff;
		pointer-events: none;
	}
	.ink polyline,
	.ink path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 5.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ink .snapped {
		stroke: var(--success);
		animation: settle 300ms var(--ease-out);
	}
	@keyframes settle {
		from {
			stroke-width: 9;
			opacity: 0.6;
		}
	}
	.ink .live {
		stroke: var(--accent-2);
	}
</style>
