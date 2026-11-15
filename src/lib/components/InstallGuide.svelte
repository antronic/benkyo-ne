<!--
	"Install Benkyo" sheet: step-by-step pictures for each platform, with the
	detected one first. Where the browser offers its own install dialog
	(Chrome, Edge, Android) an Install button does it in one tap. Opened from
	the Today card and Settings via install.showGuide; mounted in the layout.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Sheet from './Sheet.svelte';
	import InstallArt from './InstallArt.svelte';
	import { Button, Chip, Notice } from '#lib/ui/index.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { orderedGuides, type GuideId } from '#lib/pwa/platform.ts';
	import { GUIDE_NAME, STEPS } from '#lib/pwa/steps.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const NOTE = { inapp: 'install.note.inapp', 'ios-other': 'install.note.ios-other', samsung: 'install.note.samsung' } as const;
	const guides = orderedGuides(install.guide);
	let picked = $state<GuideId>(install.guide);
	const steps = $derived(STEPS[picked]);

	// opening again starts from this device's steps
	$effect(() => {
		if (install.showGuide) picked = install.guide;
	});

	async function installNow() {
		haptic('selection');
		if (await install.prompt()) install.showGuide = false;
	}
</script>

<Sheet open={install.showGuide} label={t('install.title')} onclose={() => (install.showGuide = false)}>
	{#snippet header()}
		<div class="head">
			<div class="stack" style:--gap="2px">
				<div class="title-2">{t('install.title')}</div>
				<div class="caption">{t('install.lead')}</div>
			</div>
			<button class="link" onclick={() => (install.showGuide = false)}>{t('common.done')}</button>
		</div>
	{/snippet}

	<div class="content">
	{#if install.installed}
		<Notice tone="success" title={t('install.installedTitle')}>{t('install.installedBody')}</Notice>
	{:else if install.justInstalled}
		<Notice tone="success" title={t('install.doneTitle')}>{t('install.doneBody')}</Notice>
	{:else if install.canPrompt}
		<div class="quick glass">
			<div class="stack" style:--gap="2px">
				<div class="headline">{t('install.quickTitle')}</div>
				<div class="caption">{t('install.quickBody')}</div>
			</div>
			<Button variant="accent" onclick={installNow}>{t('install.now')}</Button>
		</div>
	{/if}

	{#if install.note && picked === install.guide}
		<Notice tone="warning">{t(NOTE[install.note])}</Notice>
	{/if}

	<div class="chips" role="group" aria-label={t('install.pick')}>
		{#each guides as g (g)}
			<Chip selected={picked === g} onclick={() => (picked = g)}>
				{t(GUIDE_NAME[g])}{#if g === install.guide}<span class="here">· {t('install.thisDevice')}</span>{/if}
			</Chip>
		{/each}
	</div>

	{#if picked === 'firefox'}
		<Notice tone="info" title={t('install.firefox.desktopTitle')}>{t('install.firefox.desktopBody')}</Notice>
		<div class="eyebrow sub">{t('install.firefox.androidTitle')}</div>
	{/if}

	<ol class="steps">
		{#each steps as s, n (picked + n)}
			<li class="step glass">
				<InstallArt kind={s.art} label={s.artLabel ? t(s.artLabel) : ''} />
				<div class="text">
					<span class="num" aria-hidden="true">{n + 1}</span>
					<div class="stack" style:--gap="2px">
						<div class="headline">{t(s.title)}</div>
						{#if s.body}<div class="caption body">{t(s.body)}</div>{/if}
					</div>
				</div>
			</li>
		{/each}
	</ol>

	<p class="caption why">{t('install.why')}</p>
	</div>
</Sheet>

<style>
	.link {
		border: 0;
		background: none;
		color: var(--color-accent);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		min-height: 32px;
		padding: 4px 8px;
		cursor: pointer;
	}
	.content {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 4px 4px 10px;
	}
	.head .link {
		margin-left: auto;
		font-weight: 600;
	}
	.quick {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		border-radius: var(--radius-card);
	}
	.quick :global(.btn) {
		margin-left: auto;
		flex: none;
	}
	.chips {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 2px 2px 4px;
		margin: 0 -2px;
		scrollbar-width: none;
	}
	.chips :global(.chip) {
		flex: none;
	}
	.here {
		opacity: 0.75;
		font-size: var(--text-footnote);
	}
	.sub {
		margin: 4px 6px 0;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	@media (min-width: 520px) {
		.steps {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.step {
		padding: 10px;
		border-radius: var(--radius-card);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.text {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 0 4px 4px;
	}
	.num {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: 700;
		font-size: 0.8125rem;
	}
	.body {
		color: var(--color-text-2);
	}
	.why {
		margin: 2px 6px 8px;
		color: var(--color-text-2);
	}
</style>
