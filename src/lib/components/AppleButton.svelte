<!--
	"Continue with Apple" in Apple's style (black, or white in dark mode, with
	the Apple logo), per the Human Interface Guidelines for Sign in with Apple.
	Leaves the app for Apple's page and comes back (worker/auth/apple.ts).
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import * as api from '#lib/ai/client.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { Button } from '#lib/ui/index.ts';

	let {
		label,
		link = false,
		disabled = false,
		small = false
	}: { label?: string; link?: boolean; disabled?: boolean; small?: boolean } = $props();

	let leaving = $state(false);
	function go() {
		haptic('selection');
		try {
			leaving = true;
			api.startApple(link);
		} catch (e) {
			leaving = false;
			toast(e instanceof Error ? e.message : t('welcome.error'), '⚠️', 2800);
		}
	}
</script>

<Button class="apple-btn" size={small ? 'sm' : 'lg'} block={!small} busy={leaving} {disabled} onclick={go}>
	{#snippet icon()}
		<svg viewBox="0 0 17 20" aria-hidden="true">
			<path
				d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.8 1 7.5c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 2 2.7 3.4 2.7 1.3-.1 1.9-.9 3.5-.9s2.1.9 3.5.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.5 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"
			/>
		</svg>
	{/snippet}
	{leaving ? t('apple.opening') : (label ?? t('apple.continue'))}
</Button>

<style>
	/* Apple's Sign in with Apple style (HIG): pure black, white in dark mode,
	   a rounded rectangle rather than the kit's pill. */
	:global(.btn.apple-btn) {
		background: #000;
		color: #fff;
		border-radius: 14px;
	}
	:global(.btn.small.apple-btn) {
		border-radius: 10px;
	}
	:global(.btn.apple-btn) svg {
		width: 15px;
		height: 18px;
		fill: currentColor;
		margin-top: calc(-1 * var(--space-px));
	}
	:global(.btn.small.apple-btn) svg {
		width: 13px;
		height: 15px;
	}
	@media (prefers-color-scheme: dark) {
		:global(.btn.apple-btn) {
			background: #fff;
			color: #000;
		}
	}
</style>
