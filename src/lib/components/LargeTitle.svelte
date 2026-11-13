<!--
	iOS large title. When it scrolls under the top edge, a compact glass nav
	bar with the inline title fades in, just like UINavigationBar.
-->
<script lang="ts">
	import Romaji from './Romaji.svelte';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let { title, jp, trailing }: { title: string; jp?: boolean; trailing?: Snippet } = $props();
	let el: HTMLElement;
	let collapsed = $state(false);

	onMount(() => {
		const io = new IntersectionObserver(([e]) => (collapsed = !e.isIntersecting), {
			rootMargin: '-44px 0px 0px 0px',
			threshold: 0
		});
		io.observe(el);
		return () => io.disconnect();
	});
</script>

<div class="navbar glass" class:shown={collapsed} aria-hidden={!collapsed}>
	<span class="inline-title" class:jp>{title}</span>
	{#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
</div>

<div class="large row" bind:this={el}>
	<h1 class="large-title rise" class:jp>{title}{#if jp}<Romaji text={title} />{/if}</h1>
	<span class="spacer"></span>
	{#if trailing}{@render trailing()}{/if}
</div>

<style>
	.navbar {
		position: fixed;
		z-index: 40;
		top: 0;
		left: var(--rail, 0px);
		right: 0;
		height: calc(var(--safe-top) + 48px);
		padding: var(--safe-top) 16px 0;
		display: grid;
		place-items: center;
		border-radius: 0;
		border-width: 0 0 0.5px;
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
		transition:
			opacity 220ms,
			transform 320ms var(--spring);
	}
	.navbar.shown {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}
	.inline-title {
		font-weight: 600;
		font-size: 1.0625rem;
	}
	.trailing {
		position: absolute;
		right: 12px;
		bottom: 6px;
	}
</style>
