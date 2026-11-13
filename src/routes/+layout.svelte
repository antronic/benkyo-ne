<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Backdrop from '#lib/components/Backdrop.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { startAutoSync } from '#lib/sync.ts';

	let { children } = $props();

	// Immersive screens hide the tab bar.
	const immersive = $derived(/^\/(learn\/[^/]+|review)/.test(page.url.pathname));

	onMount(() => {
		progress.load().then(startAutoSync);
		const vis = () => document.documentElement.classList.toggle('hidden', document.hidden);
		document.addEventListener('visibilitychange', vis);
		return () => document.removeEventListener('visibilitychange', vis);
	});

	// Page morphs with the View Transitions API (falls back to instant swap).
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<Backdrop hue={ui.hue} />

{#if progress.ready}
	{@render children()}
{/if}

{#if !immersive}
	<TabBar />
{/if}
