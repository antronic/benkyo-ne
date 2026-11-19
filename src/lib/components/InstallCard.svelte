<!--
	Today: "Put Benkyo on your Home Screen". Shown in the browser only (never
	when running installed), until it's dismissed or the app is installed.
	Where the browser has its own install dialog, Install does it in one tap;
	otherwise it opens the step-by-step guide for this device.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { GUIDE_NAME } from '#lib/pwa/steps.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { Button, Card, IconButton } from '#lib/ui/index.ts';

	let { i = 2 }: { i?: number } = $props();

	const show = $derived(!install.installed && !install.cardHidden && !install.justInstalled);

	let prompting = $state(false);
	async function go() {
		haptic('selection');
		if (!install.canPrompt) {
			install.showGuide = true;
			return;
		}
		prompting = true;
		try {
			await install.prompt();
		} finally {
			prompting = false;
		}
	}
</script>

{#if show}
	<Card as="section" sheen padding="lg" radius="large" class="install-card rise" style="--i: {i}" aria-label={t('install.cardTitle')}>
		<div class="icon" aria-hidden="true">
			<img src="/icons/icon.svg" alt="" width="44" height="44" />
			<span class="plus">+</span>
		</div>
		<div class="stack" style:--gap="var(--space-px)">
			<div class="eyebrow">{t('install.cardEyebrow', { device: t(GUIDE_NAME[install.guide]) })}</div>
			<div class="headline">{t('install.cardTitle')}</div>
			<div class="caption">{t('install.cardBody')}</div>
			<div class="row actions" style:--gap="var(--space-2)">
				<Button variant="accent" size="sm" busy={prompting} onclick={go}>{install.canPrompt ? t('install.now') : t('install.showMe')}</Button>
				{#if install.canPrompt}
					<Button variant="plain" size="sm" onclick={() => (install.showGuide = true)}>{t('install.howTo')}</Button>
				{/if}
			</div>
		</div>
		<IconButton size="sm" class="install-close" onclick={() => install.hideCard()} label={t('install.hide')}>✕</IconButton>
	</Card>
{/if}

<style>
	:global(.install-card) {
		display: flex;
		gap: var(--space-4);
		align-items: flex-start;
		position: relative;
	}
	.icon {
		position: relative;
		flex: none;
	}
	.icon img {
		display: block;
		border-radius: 11px;
		box-shadow: 0 6px 16px -6px rgb(232 67 46 / 0.55);
	}
	.plus {
		position: absolute;
		right: -6px;
		bottom: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 15px;
		line-height: 1;
		background: var(--color-surface-strong);
		color: var(--color-accent);
		box-shadow: var(--shadow-raised);
	}
	:global(.install-card) > .stack {
		padding-right: var(--space-5);
	}
	.caption {
		color: var(--color-text-2);
	}
	.actions {
		margin-top: var(--space-2);
		align-items: center;
	}
	:global(.install-card) > :global(.install-close) {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		border: 0;
		background: none;
		color: var(--color-text-3);
	}
</style>
