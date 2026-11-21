<!--
	Launch prompt on iPhone and iPad outside Safari (LINE, Instagram, Chrome, …):
	only Safari can install Benkyo, and an in-app browser may drop what was
	learned, so this asks first, above the intro and sign-up (below the splash).
	"Continue here" hides it for this tab; never shown once installed. Mounted
	in the root layout.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { resumeLink } from '#lib/promo/link.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { SafariPrompt } from '#lib/ui/index.ts';

	const BROWSERS = new Set(['chrome', 'edge', 'firefox']);
	const show = $derived(install.needsSafari && !install.installed && !install.safariHidden);
</script>

{#if show}
	<div class="safari-scrim" transition:fade={{ duration: 200 }}>
		<div class="sheet" transition:fly={{ y: 40, duration: 360, easing: cubicOut }}>
			<SafariPrompt
				href={resumeLink(page.url.href)}
				app={install.appName}
				browser={BROWSERS.has(install.env.browser)}
				oncontinue={() => install.hideSafari()}
			/>
		</div>
	</div>
{/if}

<style>
	.safari-scrim {
		position: fixed;
		inset: 0;
		z-index: 170; /* above Intro and Welcome (150), below the Splash (200) */
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: var(--space-4) calc(var(--safe-right) + var(--space-4)) calc(var(--safe-bottom) + var(--space-4)) calc(var(--safe-left) + var(--space-4));
		background: rgb(0 0 0 / 0.35);
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}
	.sheet {
		width: min(420px, 100%);
	}
	@media (min-width: 600px) {
		.safari-scrim {
			align-items: center;
		}
	}
</style>
