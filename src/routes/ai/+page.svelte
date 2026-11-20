<!-- ✨ AI hub: make word-card packs, make lesson packs, ask the tutor. -->
<script lang="ts">
	import { formatCredits } from '#lib/ai/credits.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { Card, LargeTitle } from '#lib/ui/index.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	ui.hue = 265;
	const ACTIONS = [
		{ href: '/words/new?mode=scenario', icon: '🃏', title: 'ai.packTitle', desc: 'ai.packDesc' },
		{ href: '/ai/lesson', icon: '📚', title: 'ai.lessonTitle', desc: 'ai.lessonDesc' },
		{ href: '/ai/ask', icon: '💬', title: 'ai.askTitle', desc: 'ai.askDesc' }
	] as const;
</script>

<main class="page stack" style:--gap="var(--space-4)">
	<LargeTitle title={t('nav.ai')} />
	{#if ai.checked && !ai.available}
		<Card class="warn" href="/settings#ai">✨ {ai.reason || t('ai.setup')} <b>{t('ai.openSettings')}</b></Card>
	{/if}
	<div class="actions">
		{#each ACTIONS as a, i}
			<Card sheen padding="lg" radius="large" class="action rise{ai.available ? '' : ' disabled'}" style="--i: {i}" href={a.href}>
				<span class="icon" aria-hidden="true">{a.icon}</span>
				<span class="stack" style:--gap="var(--space-1)">
					<span class="title-2">{t(a.title)}</span>
					<span class="subhead">{t(a.desc)}</span>
				</span>
				<span class="go" aria-hidden="true">›</span>
			</Card>
		{/each}
	</div>
	{#if ai.onPackage && ai.managed?.plan}
		<p class="caption">
			{t('ai.usagePackage', { name: ai.managed.plan.name, spent: formatCredits(ai.managed.spentCredits), cap: t('managed.credits', { n: formatCredits(ai.managed.allowanceCredits) }), n: ai.managed.calls })}
		</p>
	{:else if ai.usage}
		<p class="caption">{t('ai.usage', { spent: '$' + ai.usage.spentUsd.toFixed(3), cap: '$' + ai.usage.capUsd.toFixed(2), n: ai.usage.calls })}</p>
	{/if}
</main>

<style>
	main :global(.warn) {
		border-radius: var(--r-m);
		background: color-mix(in srgb, var(--warn) 18%, var(--glass));
	}
	.actions {
		display: grid;
		gap: var(--space-3);
	}
	/* three across only when each card stays wide enough for its text (not unfolded portrait) */
	@media (min-width: 900px) {
		.actions {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.actions :global(.action) {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-height: 110px;
	}
	.actions :global(.action.disabled) {
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
