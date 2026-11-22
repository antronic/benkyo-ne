<!--
	Kuri pops up in the corner for a moment after a right or wrong answer, then
	goes still and hidden again (one moment per screen). Driven by kuriReact().
	It never covers a control or the menu bar (keepOut.ts): it takes the first free corner, else
	the free spot nearest the top right, else it only makes its sound.
-->
<script lang="ts">
	import Kuri from './Kuri.svelte';
	import { kuriBus, kuriSound, type KuriInstance } from './kuri.svelte.ts';
	import { readObstacles, clear, freeSpots, nearest, type Point } from './keepOut.ts';

	const S = 96;
	let box: HTMLDivElement | undefined = $state();
	let spot = $state<Point>({ x: 0, y: 0 });
	/** a free spot for this reaction, or null when every spot is taken */
	function place(): Point | null {
		const cs = getComputedStyle(document.documentElement);
		const top = (parseFloat(cs.getPropertyValue('--safe-top')) || 0) + 56;
		const right = document.documentElement.clientWidth - S - 10 - (parseFloat(cs.getPropertyValue('--safe-right')) || 0);
		const bottom = innerHeight - S - 10;
		const { hard, soft } = readObstacles([box]);
		const corners = [
			{ x: right, y: top },
			{ x: 10, y: top },
			{ x: right, y: bottom },
			{ x: 10, y: bottom }
		];
		return corners.find((p) => clear(p, S, hard)) ?? nearest(freeSpots({ left: 4, top: top - 52, right, bottom }, S, hard, soft), corners[0]);
	}

	let shown = $state(false);
	let mounted = $state(false);
	let instance = $state<KuriInstance | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let seen = kuriBus.seq;

	$effect(() => {
		if (kuriBus.seq === seen) return;
		seen = kuriBus.seq;
		mounted = true;
		kuriSound(kuriBus.kind);
		const p = place();
		if (!p) return;
		spot = p;
		shown = true;
		instance?.setPaused(false);
		instance?.setPose(kuriBus.kind);
		clearTimeout(timer);
		timer = setTimeout(() => {
			shown = false;
			setTimeout(() => !shown && instance?.setPaused(true), 300);
		}, 1500);
	});
	$effect(() => () => clearTimeout(timer));
</script>

{#if mounted}
	<div class="react" class:shown bind:this={box} style:left="{spot.x}px" style:top="{spot.y}px" aria-hidden="true">
		<Kuri bind:instance pose={kuriBus.kind} options={{ yaw: 0.35, pitch: 0.2, distance: 6.4, target: [0, 1.15, 0], fps: 30 }} />
	</div>
{/if}

<style>
	.react {
		position: fixed;
		width: 96px;
		height: 96px;
		z-index: 45;
		pointer-events: none;
		opacity: 0;
		transform: scale(0.6) translateY(-8px);
		transition:
			opacity var(--dur-fast) var(--ease-out),
			transform var(--dur-fast) var(--ease-out);
	}
	.react.shown {
		opacity: 1;
		transform: none;
		transition:
			opacity var(--dur-fast) var(--ease-out),
			transform var(--dur-toggle) var(--ease-spring-bouncy);
	}
</style>
