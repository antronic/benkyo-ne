<!-- ✨ AI hub: make word-card packs, make lesson packs, ask the tutor. -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	ui.hue = 265;
	const ACTIONS = [
		{ href: '/words/new?mode=scenario', icon: '🃏', title: 'ai.packTitle', desc: 'ai.packDesc' },
		{ href: '/ai/lesson', icon: '📚', title: 'ai.lessonTitle', desc: 'ai.lessonDesc' },
		{ href: '/ai/ask', icon: '💬', title: 'ai.askTitle', desc: 'ai.askDesc' }
	] as const;
</script>

<main class="page stack" style:--gap="14px">
	<LargeTitle title={t('nav.ai')} />
	{#if ai.checked && !ai.available}
		<a class="glass warn" href="/settings#ai">✨ {ai.reason || t('ai.setup')} <b>{t('ai.openSettings')}</b></a>
	{/if}
	<div class="actions">
		{#each ACTIONS as a, i}
			<a class="action glass sheen rise" style:--i={i} href={a.href} class:disabled={!ai.available}>
				<span class="icon" aria-hidden="true">{a.icon}</span>
				<span class="stack" style:--gap="4px">
					<span class="title-2">{t(a.title)}</span>
					<span class="subhead">{t(a.desc)}</span>
				</span>
				<span class="go" aria-hidden="true">›</span>
			</a>
		{/each}
	</div>
	{#if ai.usage}
		<p class="caption">{t('ai.usage', { spent: '$' + ai.usage.spentUsd.toFixed(3), cap: '$' + ai.usage.capUsd.toFixed(2), n: ai.usage.calls })}</p>
	{/if}
</main>

<style>
	.warn {
		display: block;
		padding: 14px 16px;
		border-radius: var(--r-m);
		color: inherit;
		text-decoration: none;
		background: color-mix(in srgb, var(--warn) 18%, var(--glass));
	}
	.actions {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 600px) {
		.actions {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.action {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px;
		border-radius: var(--r-l);
		text-decoration: none;
		color: inherit;
		min-height: 110px;
		transition: transform 450ms var(--spring);
	}
	.action:active {
		transform: scale(0.97);
	}
	.action.disabled {
		opacity: 0.55;
	}
	.icon {
		font-size: 34px;
		flex: none;
	}
	.go {
		margin-left: auto;
		font-size: 30px;
		color: var(--ink-3);
	}
</style>
