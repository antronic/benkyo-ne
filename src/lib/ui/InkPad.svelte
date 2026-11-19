<!--
	A pad to write or draw on (the VIP invite card's handwriting, drawn in Fleet).
	Records each stroke with its timing (ink.ts) so InkReplay can play it back
	as it was written. bind:value for the ink. Undo takes the last stroke off.
-->
<script lang="ts">
	import Button from './Button.svelte';
	import { emptyInk, simplify, type Ink, type InkPoint } from './ink.ts';
	import { strokePath } from './ink.ts';

	let {
		value = $bindable(emptyInk()),
		label = 'Handwriting',
		placeholder = 'Write or draw here',
		undoLabel = 'Undo',
		clearLabel = 'Clear'
	}: { value?: Ink; label?: string; placeholder?: string; undoLabel?: string; clearLabel?: string } = $props();

	const W = 240;
	const H = $derived(W / value.aspect);
	let svg: SVGSVGElement;
	let current = $state<InkPoint[] | null>(null);
	let t0 = 0;
	/** time at the end of the ink so far: new strokes continue from it */
	let base = 0;

	function at(e: PointerEvent): [number, number] {
		const r = svg.getBoundingClientRect();
		return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
	}
	function down(e: PointerEvent) {
		svg.setPointerCapture(e.pointerId);
		const last = value.strokes.at(-1)?.at(-1)?.[2];
		base = last === undefined ? 0 : last + 250;
		t0 = e.timeStamp;
		current = [[...at(e), base]];
	}
	function move(e: PointerEvent) {
		if (!current) return;
		for (const ev of e.getCoalescedEvents?.() ?? [e]) current.push([...at(ev), base + Math.round(ev.timeStamp - t0)]);
	}
	function up() {
		if (!current) return;
		value = { ...value, strokes: [...value.strokes, simplify(current)] };
		current = null;
	}
</script>

<div class="ink-pad">
	<svg
		bind:this={svg}
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label={label}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	>
		{#each value.strokes as s, i (i)}<path d={strokePath(s, W, H)} />{/each}
		{#if current}<path d={strokePath(current, W, H)} />{/if}
		{#if !value.strokes.length && !current}<text x={W / 2} y={H / 2} text-anchor="middle" dominant-baseline="middle">{placeholder}</text>{/if}
	</svg>
	<div class="tools">
		<Button variant="ghost" size="sm" disabled={!value.strokes.length} onclick={() => (value = { ...value, strokes: value.strokes.slice(0, -1) })}>{undoLabel}</Button>
		<Button variant="ghost" size="sm" disabled={!value.strokes.length} onclick={() => (value = emptyInk(value.aspect))}>{clearLabel}</Button>
	</div>
</div>

<style>
	.ink-pad {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	svg {
		width: 100%;
		touch-action: none;
		cursor: crosshair;
		background: var(--color-surface-strong);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-control);
	}
	path {
		fill: none;
		stroke: var(--color-text);
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	text {
		fill: var(--color-text-3);
		font-size: 11px;
		pointer-events: none;
	}
	.tools {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
