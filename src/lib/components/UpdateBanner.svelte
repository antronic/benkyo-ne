<!-- "New version available · Restart" banner (iOS-style glass pill). -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	async function restart() {
		// Mid-lesson: confirm first (unsaved lesson progress would be lost).
		if (ui.backGuard && !(await ui.backGuard())) return;
		haptic('success');
		updater.restart();
	}
</script>

{#if updater.ready && !updater.dismissed}
	<div class="banner glass glass-strong" role="status" transition:fly={{ y: -40, duration: 420, easing: cubicOut }}>
		<span class="dot" aria-hidden="true"></span>
		<span class="text"><b>New version available</b><span class="caption">Restart to update</span></span>
		<button class="btn small accent" onclick={restart}>Restart</button>
		<button class="close" aria-label="Later" onclick={() => (updater.dismissed = true)}>✕</button>
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
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 14px;
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
	.close {
		flex: none;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
</style>
