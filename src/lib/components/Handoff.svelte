<!--
	The way from sign-in or sign-up to the next screen (ui.handoff). It covers the
	welcome sheet fading out, so the learner never sees a blank or half-loaded Today:
	  signup → until the beta consent, the first-run questions or the avatar step is on screen
	  signin → until the first sync has brought the account's progress in (or 8 s, or offline)
	The layout decides when it ends (+layout.svelte).
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { Spinner } from '#lib/ui/index.ts';

	let { kind }: { kind: 'signin' | 'signup' } = $props();
	const label = $derived(t(kind === 'signin' ? 'welcome.handoffSignin' : 'welcome.handoffSignup'));
</script>

<div class="handoff" role="dialog" aria-modal="true" aria-busy="true" aria-label={label} out:fade={{ duration: 250 }}>
	<div class="bg" aria-hidden="true"></div>
	<div class="body">
		<Spinner size="lg" {label} showLabel />
	</div>
</div>

<style>
	.handoff {
		position: fixed;
		inset: 0;
		z-index: 170;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--safe-top) + var(--space-4)) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
		background: var(--bg);
	}
	/* the same glow as the welcome sheet underneath, so the hand-over reads as one screen */
	.bg {
		position: fixed;
		inset: -20%;
		background:
			radial-gradient(40% 35% at 30% 25%, hsl(8 85% 62% / 0.4), transparent 70%),
			radial-gradient(45% 40% at 75% 75%, hsl(265 80% 60% / 0.32), transparent 70%);
		filter: blur(30px);
		pointer-events: none;
	}
	.body {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		font-weight: 600;
		color: var(--ink-2);
	}
	.body :global(.spinner) {
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
