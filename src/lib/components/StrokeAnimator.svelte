<!--
	Animated stroke order. Each stroke is drawn with stroke-dashoffset, its
	duration proportional to its length, with a brush "tip" dot travelling at
	the leading edge and numbered start points.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { strokesOf } from '#lib/content/strokes.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';

	interface Props {
		char: string;
		size?: number | string;
		/** length units per second */
		speed?: number;
		loop?: boolean;
		autoplay?: boolean;
		numbers?: boolean;
		/** faint preview of the strokes still to come */
		ghost?: boolean;
		scene?: number;
		/** Optional ink colour per stroke (e.g. kanji components). */
		colors?: (string | undefined)[];
		ondone?: () => void;
	}
	let {
		char,
		size = 220,
		speed = 90,
		loop = false,
		autoplay = true,
		numbers = true,
		ghost = true,
		scene = 0,
		colors,
		ondone
	}: Props = $props();

	const data = $derived(strokesOf(char));
	const art = $derived(scene > 0 ? mnemonicFor(char).scene : undefined);

	let paths: SVGPathElement[] = $state([]);
	let lengths: number[] = $state([]);
	let progress: number[] = $state([]); // 0..1 per stroke
	let tip = $state<{ x: number; y: number } | null>(null);
	let active = $state(-1);
	let raf = 0;
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	export function play() {
		cancelAnimationFrame(raf);
		if (!data) return;
		lengths = paths.map((p) => p.getTotalLength());
		if (reduced) {
			progress = lengths.map(() => 1);
			ondone?.();
			return;
		}
		progress = lengths.map(() => 0);
		const GAP = 220;
		const durs = lengths.map((l) => Math.max(260, (l / speed) * 1000));
		const starts: number[] = [];
		let acc = 250;
		for (const d of durs) {
			starts.push(acc);
			acc += d + GAP;
		}
		const total = acc;
		const t0 = performance.now();
		const ease = (t: number) => 1 - Math.pow(1 - t, 2.2); // brush decelerates at stroke end

		const frame = (now: number) => {
			const t = now - t0;
			tip = null;
			active = -1;
			progress = durs.map((d, i) => {
				const local = (t - starts[i]) / d;
				if (local <= 0) return 0;
				if (local >= 1) return 1;
				active = i;
				const e = ease(local);
				const pt = paths[i].getPointAtLength(e * lengths[i]);
				tip = { x: pt.x, y: pt.y };
				return e;
			});
			if (t < total) raf = requestAnimationFrame(frame);
			else {
				ondone?.();
				if (loop) setTimeout(play, 900);
			}
		};
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		if (autoplay) requestAnimationFrame(play);
		return () => cancelAnimationFrame(raf);
	});

	// restart when the character changes
	let lastChar = '';
	$effect(() => {
		if (char !== lastChar && paths.length) {
			lastChar = char;
			if (autoplay) requestAnimationFrame(play);
		}
	});
</script>

<svg viewBox="0 0 109 109" width={size} height={size} class="anim" role="img" aria-label="Stroke order for {char}">
	<!-- writing guide: 田 grid -->
	<g class="grid">
		<rect x="1" y="1" width="107" height="107" rx="10" />
		<path d="M54.5 4 V105 M4 54.5 H105" />
	</g>
	{#if art}
		<g class="art" style:opacity={scene}>{@html art}</g>
	{/if}
	{#if data}
		<g class="ghost" class:hidden={!ghost}>
			{#each data.d as d}<path {d} />{/each}
		</g>
		<g class="ink">
			{#each data.d as d, i}
				<path
					bind:this={paths[i]}
					{d}
					class:active={active === i}
					style:stroke={active === i ? undefined : colors?.[i]}
					style:opacity={(progress[i] ?? 0) > 0 ? 1 : 0}
					stroke-dasharray={lengths[i] ?? 400}
					stroke-dashoffset={(lengths[i] ?? 400) * (1 - (progress[i] ?? 0))}
				/>
			{/each}
		</g>
		{#if tip}
			<circle cx={tip.x} cy={tip.y} r="4.6" class="tip" />
		{/if}
		{#if numbers}
			{#each data.n as [x, y], i}
				<text {x} {y} class="num" class:shown={(progress[i] ?? 0) > 0}>{i + 1}</text>
			{/each}
		{/if}
	{/if}
</svg>

<style>
	.anim {
		display: block;
		overflow: visible;
		touch-action: manipulation;
	}
	.art {
		transition: opacity 900ms var(--ease-out);
	}
	.grid rect {
		fill: none;
		stroke: var(--hairline);
		stroke-width: 0.8;
	}
	.grid path {
		stroke: var(--hairline);
		stroke-width: 0.6;
		stroke-dasharray: 2 3;
		fill: none;
	}
	.ghost {
		transition: opacity 600ms;
	}
	.ghost.hidden {
		opacity: 0;
	}
	.ghost path {
		fill: none;
		stroke: var(--ink-3);
		opacity: 0.35;
		stroke-width: 5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ink path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 5.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: stroke 300ms;
	}
	.ink path.active {
		stroke: var(--accent);
	}
	.tip {
		fill: var(--accent);
		filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 70%, transparent));
	}
	.num {
		font-size: 7px;
		font-family: var(--font);
		font-weight: 700;
		fill: var(--accent-2);
		opacity: 0;
		transition: opacity 300ms;
	}
	.num.shown {
		opacity: 1;
	}
</style>
