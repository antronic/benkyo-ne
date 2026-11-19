<!--
	Interface language picker (Settings). "Automatic" follows the browser.
	When the interface is Thai and AI explanations aren't, offer to add Thai
	as the AI's second language too.
-->
<script lang="ts">
	import { i18n, t, LOCALES, matchLocale, type LocalePref } from '#lib/i18n/index.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const browserName = $derived(
		LOCALES.find((l) => l.code === matchLocale(typeof navigator === 'undefined' ? [] : navigator.languages))?.name ?? 'English'
	);

	function choose(v: string) {
		i18n.setPref(v as LocalePref);
		haptic('selection');
	}
</script>

<h2 class="eyebrow section">{t('lang.section')}</h2>
<div class="glass group rise">
	<div class="item">
		<span class="stack" style:--gap="0">
			<span>{t('lang.label')}</span>
			<span class="caption">{t('lang.caption')}</span>
		</span>
		<span class="spacer"></span>
		<select class="pick" aria-label={t('lang.label')} value={i18n.pref} onchange={(e) => choose(e.currentTarget.value)}>
			<option value="auto">{t('lang.auto', { name: browserName })}</option>
			{#each LOCALES as l (l.code)}
				<option value={l.code} lang={l.code}>{l.name}</option>
			{/each}
		</select>
	</div>
	{#if i18n.locale === 'th' && progress.settings.secondLang !== 'th'}
		<div class="item">
			<span class="caption">{t('lang.aiHint')}</span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={() => progress.saveSettings({ secondLang: 'th' })}>{t('lang.aiHintAction')}</button>
		</div>
	{/if}
</div>

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.group {
		padding: var(--space-1) 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		min-height: 48px;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	.pick {
		font: inherit;
		font-size: 1rem;
		height: 44px;
		padding: 0 var(--space-3);
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: var(--ink);
	}
	.btn {
		flex: none;
	}
</style>
