<script lang="ts">
	import { Spring } from 'svelte/motion';
	import type { Snippet } from 'svelte';

	interface Props {
		value: number; // 0..1
		size?: number;
		width?: number;
		color?: string;
		children?: Snippet;
	}
	let { value, size = 120, width = 12, color = 'var(--accent)', children }: Props = $props();

	const v = new Spring(0, { stiffness: 0.08, damping: 0.5 });
	$effect(() => {
		v.target = Math.max(0, Math.min(1, value));
	});
	const r = $derived((size - width) / 2);
	const c = $derived(2 * Math.PI * r);
</script>

<div class="ring" style:width="{size}px" style:height="{size}px">
	<svg viewBox="0 0 {size} {size}" width={size} height={size}>
		<circle cx={size / 2} cy={size / 2} {r} class="track" stroke-width={width} />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			class="bar"
			stroke={color}
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
	}
	circle {
		fill: none;
		stroke-linecap: round;
	}
	.track {
		stroke: var(--hairline);
	}
	.bar {
		filter: drop-shadow(0 2px 6px color-mix(in srgb, currentColor 20%, transparent));
	}
	.inner {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		text-align: center;
	}
</style>
