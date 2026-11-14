<!--
	Progress ring as a glass orb filling with liquid.
	  - outer arc + liquid level follow `value` (spring-animated)
	  - colour follows progress: vermilion → orange → gold → matcha
	  - two drifting waves, a gradient body, rising glitter sparkles
	  - Reduce Motion: still liquid, no sparkles
-->
<script lang="ts">
	import { Spring } from 'svelte/motion';
	import type { Snippet } from 'svelte';

	interface Props {
		value: number; // 0..1
		size?: number;
		width?: number;
		/** fixed colour; omit for the progress-based colour */
		color?: string;
		children?: Snippet;
	}
	let { value, size = 120, width = 12, color, children }: Props = $props();

	const uid = `pr${Math.random().toString(36).slice(2, 8)}`;
	const v = new Spring(0, { stiffness: 0.06, damping: 0.45 });
	$effect(() => {
		v.target = Math.max(0, Math.min(1, value || 0));
	});

	const r = $derived((size - width) / 2);
	const c = $derived(2 * Math.PI * r);
	const inner = $derived(r - width / 2 - 3); // liquid radius inside the arc

	/** Hue path through the colour stops (vermilion 8° → orange 28° → gold 45° → matcha 140°). */
	function hueAt(t: number) {
		const stops = [
			[0, 8],
			[0.4, 28],
			[0.7, 45],
			[1, 140]
		];
		for (let i = 1; i < stops.length; i++) {
			if (t <= stops[i][0]) {
				const [a, ha] = stops[i - 1];
				const [b, hb] = stops[i];
				return ha + ((t - a) / (b - a)) * (hb - ha);
			}
		}
		return 140;
	}
	const hue = $derived(hueAt(v.current));
	const main = $derived(color ?? `hsl(${hue} 82% 55%)`);
	const light = $derived(color ?? `hsl(${hue + 12} 95% 70%)`);
	const deep = $derived(color ?? `hsl(${hue - 8} 75% 42%)`);

	// liquid surface y within the orb (top = full)
	const level = $derived(size / 2 + inner - 2 * inner * v.current);
	const amp = $derived(Math.max(2, inner * 0.09 * (v.current > 0.02 && v.current < 0.98 ? 1 : 0.3)));

	/** A seamless wave twice the orb width, translated horizontally by CSS. */
	function wave(y: number, a: number, phase: number) {
		const w = size * 2;
		const seg = size / 2;
		let d = `M ${-size} ${y}`;
		for (let x = -size, k = 0; x < w; x += seg, k++) {
			const up = (k % 2 === 0) !== (phase > 0);
			d += ` q ${seg / 2} ${up ? -a : a} ${seg} 0`;
		}
		return `${d} V ${size} H ${-size} Z`;
	}

	// deterministic sparkle layout
	const sparkles = Array.from({ length: 9 }, (_, i) => ({
		x: 0.22 + ((i * 37) % 60) / 100,
		y: 0.55 + ((i * 23) % 40) / 100,
		s: 0.8 + ((i * 13) % 10) / 10,
		d: (i * 0.37) % 2.4
	}));
</script>

<div class="ring" style:width="{size}px" style:height="{size}px" style:--glow={main}>
	<svg viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
		<defs>
			<clipPath id="{uid}-clip"><circle cx={size / 2} cy={size / 2} r={inner} /></clipPath>
			<linearGradient id="{uid}-liquid" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={light} stop-opacity="0.95" />
				<stop offset="1" stop-color={deep} stop-opacity="0.95" />
			</linearGradient>
			<linearGradient id="{uid}-arc" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color={light} />
				<stop offset="1" stop-color={deep} />
			</linearGradient>
			<radialGradient id="{uid}-glass" cx="0.35" cy="0.25" r="0.75">
				<stop offset="0" stop-color="#fff" stop-opacity="0.35" />
				<stop offset="0.5" stop-color="#fff" stop-opacity="0.04" />
				<stop offset="1" stop-color="#fff" stop-opacity="0" />
			</radialGradient>
		</defs>

		<!-- orb body -->
		<circle cx={size / 2} cy={size / 2} r={inner} class="orb" />

		<!-- liquid -->
		<g clip-path="url(#{uid}-clip)">
			<g class="wave back" style:--seg="{size}px"><path d={wave(level + 2, amp * 0.8, 1)} fill={main} opacity="0.45" /></g>
			<g class="wave front" style:--seg="{size}px"><path d={wave(level, amp, 0)} fill="url(#{uid}-liquid)" /></g>
			{#if v.current > 0.04}
				<g class="glitter">
					{#each sparkles as s, i}
						{@const sy = Math.max(level + 4, size / 2 - inner + s.y * 2 * inner)}
						<g transform="translate({size / 2 - inner + s.x * 2 * inner} {sy}) scale({s.s})" style:--d="{s.d}s" class="spark">
							<path d={i % 3 === 0 ? 'M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z' : 'M0 -1.4 A1.4 1.4 0 1 0 0.01 -1.4'} fill="#fff" />
						</g>
					{/each}
				</g>
			{/if}
		</g>

		<!-- glass highlight over the liquid -->
		<circle cx={size / 2} cy={size / 2} r={inner} fill="url(#{uid}-glass)" />

		<!-- progress arc -->
		<circle cx={size / 2} cy={size / 2} {r} class="track" stroke-width={width} />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			class="bar"
			stroke="url(#{uid}-arc)"
			stroke-width={width}
			stroke-dasharray={c}
			stroke-dashoffset={c * (1 - v.current)}
			transform="rotate(-90 {size / 2} {size / 2})"
		/>
	</svg>
	<div class="inner">{@render children?.()}</div>
</div>

<style>
	.ring {
		position: relative;
		flex: none;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.orb {
		fill: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	circle.track,
	circle.bar {
		fill: none;
		stroke-linecap: round;
	}
	.track {
		stroke: var(--hairline);
	}
	.bar {
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--glow) 55%, transparent));
		transition: filter 600ms;
	}
	.wave {
		animation: drift 3.2s linear infinite;
	}
	.wave.back {
		animation-duration: 4.6s;
		animation-direction: reverse;
	}
	@keyframes drift {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(calc(var(--seg, 50%) * -1));
		}
	}
	.spark {
		animation: twinkle 2.4s ease-in-out infinite;
		animation-delay: var(--d);
		transform-box: fill-box;
		transform-origin: center;
	}
	.spark path {
		animation: rise 2.4s ease-in-out infinite;
		animation-delay: var(--d);
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0;
		}
		40%,
		60% {
			opacity: 0.9;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(4px);
		}
		to {
			transform: translateY(-6px);
		}
	}
	.inner {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		text-align: center;
		text-shadow: 0 1px 6px color-mix(in srgb, var(--bg) 70%, transparent);
	}
	@media (prefers-reduced-motion: reduce) {
		.wave,
		.spark,
		.spark path {
			animation: none;
		}
		.glitter {
			display: none;
		}
	}
</style>
