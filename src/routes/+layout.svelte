<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Backdrop from '#lib/components/Backdrop.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import Overlays from '#lib/components/Overlays.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { startAutoSync } from '#lib/sync.ts';
	import { edgeSwipeBack, trackKeyboard } from '#lib/ios/gestures.ts';

	let { children } = $props();

	// Immersive screens hide the navigation and can be swiped back from.
	const immersive = $derived(/^\/(learn\/[^/]+|review)/.test(page.url.pathname));
	const parent = $derived(page.url.pathname.startsWith('/learn/') ? '/learn' : '/');

	async function back() {
		if (ui.backGuard && !(await ui.backGuard())) return false;
		ui.backGuard = null;
		await goto(parent);
	}

	onMount(() => {
		progress.load().then(startAutoSync);
		const vis = () => document.documentElement.classList.toggle('hidden', document.hidden);
		document.addEventListener('visibilitychange', vis);
		const stopKb = trackKeyboard();
		return () => {
			document.removeEventListener('visibilitychange', vis);
			stopKb();
		};
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

<div class="app" use:edgeSwipeBack={{ enabled: immersive, onback: back }}>
	{#if progress.ready}
		{@render children()}
	{/if}
</div>

{#if !immersive}
	<TabBar />
{/if}

<Overlays />

<style>
	.app {
		min-height: 100dvh;
	}
</style>
