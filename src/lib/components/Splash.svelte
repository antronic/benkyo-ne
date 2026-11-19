<!--
	Launch splash: the あ logo writes itself on the vermilion glass tile,
	then the whole splash lifts away into the app (zoom + blur + fade).
	Shown until `ready` and for at least MIN_MS so it never flickers.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { strokesOf } from '#lib/content/strokes.ts';

	let { ready }: { ready: boolean } = $props();
	const MIN_MS = 900;
	const strokes = strokesOf('あ')?.d ?? [];
	let minDone = $state(false);
	const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	onMount(() => {
		const t = setTimeout(() => (minDone = true), reduce ? 200 : MIN_MS);
		return () => clearTimeout(t);
	});

	function lift(_n: Element) {
		return {
			duration: reduce ? 150 : 520,
			css: (t: number) => `opacity:${t}; transform: scale(${1 + (1 - t) * 0.12}); filter: blur(${(1 - t) * 10}px);`
		};
	}
</script>

{#if !(ready && minDone)}
	<div class="splash" out:lift in:fade={{ duration: 0 }} role="status" aria-label={t('splash.loading')}>
		<div class="tile">
			<svg viewBox="0 0 109 109" aria-hidden="true">
				{#each strokes as d, i}
					<path {d} pathLength="1" style:--i={i} />
				{/each}
			</svg>
		</div>
		<div class="name">Benkyo <span class="jp">勉強ね</span></div>
	</div>
{/if}

<style>
	.splash {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-5);
		background: radial-gradient(120% 80% at 50% 30%, color-mix(in srgb, var(--accent) 22%, var(--bg)), var(--bg) 70%);
	}
	.tile {
		width: 112px;
		height: 112px;
		border-radius: 26px;
		background: linear-gradient(135deg, #ff7a5c, #e8432e 55%, #b8264f);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.45),
			0 20px 40px -12px rgb(232 67 46 / 0.6);
		display: grid;
		place-items: center;
		animation: pop 700ms var(--spring-bouncy) both;
	}
	svg {
		width: 74px;
		height: 74px;
		overflow: visible;
	}
	path {
		fill: none;
		stroke: #fff;
		stroke-width: 7;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: write 420ms ease-out forwards;
		animation-delay: calc(180ms + var(--i) * 230ms);
	}
	@keyframes write {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.7);
			opacity: 0;
		}
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.375rem;
		letter-spacing: -0.01em;
		animation: rise 600ms 300ms var(--spring) both;
	}
	.name .jp {
		color: var(--ink-2);
		font-weight: 500;
	}
	@media (prefers-reduced-motion: reduce) {
		path {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
