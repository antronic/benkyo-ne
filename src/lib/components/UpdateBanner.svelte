<!-- "New version available · Restart" banner (iOS-style glass pill). -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { Button, Card, IconButton } from '#lib/ui/index.ts';

	let restarting = $state(false);
	async function restart() {
		// Mid-lesson: confirm first (unsaved lesson progress would be lost).
		if (ui.backGuard && !(await ui.backGuard())) return;
		haptic('success');
		// The reload takes a moment: show it on the button until the page goes.
		restarting = true;
		updater.restart();
		// If the page hasn't gone after a while, give the buttons back.
		setTimeout(() => (restarting = false), 8000);
	}
</script>

{#if updater.ready && !updater.dismissed}
	<div class="banner" role="status" transition:fly={{ y: -40, duration: 420, easing: cubicOut }}>
		<Card strong padding="none" class="update-pill">
			<span class="dot" aria-hidden="true"></span>
			<span class="text"><b>{t('update.title')}</b><span class="caption">{t('update.body')}</span></span>
			<Button variant="accent" size="sm" busy={restarting} onclick={restart}>{t('update.restart')}</Button>
			<IconButton size="sm" label={t('update.later')} class="update-close" disabled={restarting} onclick={() => (updater.dismissed = true)}>✕</IconButton>
		</Card>
	</div>
{/if}

<style>
	.banner {
		position: fixed;
		z-index: 80;
		top: calc(var(--safe-top) + 10px);
		left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		translate: -50% 0;
		width: min(420px, calc(100% - 24px - var(--safe-left) - var(--safe-right)));
	}
	.banner :global(.update-pill) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border-radius: 999px;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		font-size: 0.9375rem;
	}
	.banner :global(.update-close) {
		flex: none;
		border: 0;
		background: none;
		color: var(--ink-2);
	}
</style>
