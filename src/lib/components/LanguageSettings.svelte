<!--
	Interface language picker (Settings). "Automatic" follows the browser.
	When the interface is Thai and AI explanations aren't, offer to add Thai
	as the AI's second language too.
-->
<script lang="ts">
	import { i18n, t, LOCALES, matchLocale, type LocalePref } from '#lib/i18n/index.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { Button, ListGroup, ListRow, Select } from '#lib/ui/index.ts';

	const browserName = $derived(
		LOCALES.find((l) => l.code === matchLocale(typeof navigator === 'undefined' ? [] : navigator.languages))?.name ?? 'English'
	);
	const options = $derived([
		{ value: 'auto', label: t('lang.auto', { name: browserName }) },
		...LOCALES.map((l) => ({ value: l.code as string, label: l.name, lang: l.code }))
	]);

	function choose(v: string) {
		i18n.setPref(v as LocalePref);
		haptic('selection');
	}
</script>

<h2 class="eyebrow section">{t('lang.section')}</h2>
<ListGroup class="rise">
	<ListRow title={t('lang.label')} subtitle={t('lang.caption')}>
		{#snippet trailing()}<Select label={t('lang.label')} {options} value={i18n.pref as string} onchange={choose} />{/snippet}
	</ListRow>
	{#if i18n.locale === 'th' && progress.settings.secondLang !== 'th'}
		<ListRow subtitle={t('lang.aiHint')}>
			{#snippet trailing()}
				<Button variant="ghost" size="sm" onclick={() => progress.saveSettings({ secondLang: 'th' })}>{t('lang.aiHintAction')}</Button>
			{/snippet}
		</ListRow>
	{/if}
</ListGroup>

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
</style>
