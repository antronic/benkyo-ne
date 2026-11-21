<!--
	A word's politeness on its card (docs/EVERYDAY.md "Word politeness"):
	the level as a step bar, what it means, and who you can say it to.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { WRITE_TO } from '#lib/ai/contract.ts';
	import { POLITE_STEPS, politeFits, politeStep, type Fit, type Politeness } from '#lib/words/politeness.ts';
	import { Badge, StepBar } from '#lib/ui/index.ts';

	let { level }: { level: Politeness } = $props();
	const fits = $derived(politeFits(level));
	const mark: Record<Fit, string> = { yes: '✓', careful: '～', no: '✕' };
	const tone = { yes: 'success', careful: 'warning', no: 'neutral' } as const;
</script>

<section class="wp" aria-label={t('polite.title')}>
	<div class="head">
		<h3 class="eyebrow">{t('polite.title')}</h3>
		<span class="level">{t(`polite.level.${level}`)}</span>
	</div>
	<StepBar
		steps={POLITE_STEPS.map((s) => t(`polite.step.${s}`))}
		value={politeStep(level)}
		tones={['warning', 'success', 'info', 'violet']}
		label={t('polite.title')}
		anyLabel={t('polite.any')}
	/>
	<p class="caption why">{t(`polite.why.${level}`)}</p>
	<h4 class="eyebrow">{t('polite.with')}</h4>
	<ul class="who">
		{#each WRITE_TO as p (p)}
			<li aria-label="{t(`write.to.${p}`)}: {t(`polite.fit.${fits[p]}`)}">
				<Badge tone={tone[fits[p]]}><span aria-hidden="true">{mark[fits[p]]}</span>{t(`write.to.${p}`)}</Badge>
			</li>
		{/each}
	</ul>
</section>

<style>
	.wp {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.level {
		font-weight: var(--weight-semibold);
	}
	.why {
		color: var(--color-text-2);
		margin: 0;
	}
	h3,
	h4 {
		margin: 0;
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1h);
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
