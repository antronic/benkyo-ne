<!--
	Plays handwriting back as it was written (ink.ts timing), from `delay` ms
	after it mounts or after `replay` changes. Under prefers-reduced-motion it
	shows the finished drawing straight away.
-->
<script lang="ts">
	import { inkDuration, strokePath, type Ink } from './ink.ts';

	let {
		ink,
		label = 'Handwritten note',
		delay = 0,
		/** change it to play again */
		replay = 0,
		ondone
	}: { ink: Ink; label?: string; delay?: number; replay?: number; ondone?: () => void } = $props();

	const W = 240;
	const H = $derived(W / ink.aspect);
	let now = $state(-1);

	$effect(() => {
		void replay;
		const total = inkDuration(ink);
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			now = Infinity;
			ondone?.();
			return;
		}
		now = -1;
		let raf = 0;
		let start = 0;
		const tick = (ts: number) => {
			if (!start) start = ts + delay;
			now = ts - start;
			if (now < total) raf = requestAnimationFrame(tick);
			else ondone?.();
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svg class="ink-replay" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
	{#each ink.strokes as s, i (i)}<path d={strokePath(s, W, H, now)} />{/each}
</svg>

<style>
	.ink-replay {
		width: 100%;
		display: block;
	}
	path {
		fill: none;
		stroke: var(--ink-color, var(--color-accent));
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
