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

<button class="apple" class:small onclick={go} disabled={disabled || leaving} type="button">
	<svg viewBox="0 0 17 20" aria-hidden="true">
		<path
			d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.8 1 7.5c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 2 2.7 3.4 2.7 1.3-.1 1.9-.9 3.5-.9s2.1.9 3.5.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.5 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"
		/>
	</svg>
	<span>{leaving ? t('apple.opening') : (label ?? t('apple.continue'))}</span>
</button>

<style>
	.apple {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 50px;
		padding: 0 18px;
		border: 0;
		border-radius: 14px;
		background: #000;
		color: #fff;
		font: inherit;
		font-size: 1.0625rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 150ms, transform 150ms;
	}
	.apple.small {
		width: auto;
		min-height: 36px;
		padding: 0 14px;
		border-radius: 10px;
		font-size: 0.9375rem;
	}
	.apple:active {
		transform: scale(0.98);
	}
	.apple:disabled {
		opacity: 0.5;
		cursor: default;
	}
	svg {
		width: 15px;
		height: 18px;
		fill: currentColor;
		margin-top: -2px;
	}
	.small svg {
		width: 13px;
		height: 15px;
	}
	@media (prefers-color-scheme: dark) {
		.apple {
			background: #fff;
			color: #000;
		}
	}
</style>
