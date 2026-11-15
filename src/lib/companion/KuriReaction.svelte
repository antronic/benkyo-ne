<!--
	Kuri pops up in the corner for a moment after a right or wrong answer, then
	goes still and hidden again (one moment per screen). Driven by kuriReact().
-->
<script lang="ts">
	import Kuri from './Kuri.svelte';
	import { kuriBus, kuriSound, type KuriInstance } from './kuri.svelte.ts';

	let shown = $state(false);
	let mounted = $state(false);
	let instance = $state<KuriInstance | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let seen = kuriBus.seq;

	$effect(() => {
		if (kuriBus.seq === seen) return;
		seen = kuriBus.seq;
		mounted = true;
		shown = true;
		instance?.setPaused(false);
		instance?.setPose(kuriBus.kind);
		kuriSound(kuriBus.kind);
		clearTimeout(timer);
		timer = setTimeout(() => {
			shown = false;
			setTimeout(() => !shown && instance?.setPaused(true), 300);
		}, 1500);
	});
	$effect(() => () => clearTimeout(timer));
</script>

{#if mounted}
	<div class="react" class:shown aria-hidden="true">
		<Kuri bind:instance pose={kuriBus.kind} options={{ yaw: 0.35, pitch: 0.2, distance: 6.4, target: [0, 1.15, 0], fps: 30 }} />
	</div>
{/if}

<style>
	.react {
		position: fixed;
		right: calc(var(--safe-right, 0px) + 10px);
		top: calc(var(--safe-top, 0px) + 56px);
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
