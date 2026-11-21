<!--
	"Install Benkyo" sheet: step-by-step pictures for each platform, with the
	detected one first. Where the browser offers its own install dialog
	(Chrome, Edge, Android) an Install button does it in one tap. Opened from
	the Today card and Settings via install.showGuide; mounted in the layout.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Sheet from '#lib/ui/Sheet.svelte';
	import InstallArt from './InstallArt.svelte';
	import { page } from '$app/state';
	import { resumeLink } from '#lib/promo/link.ts';
	import { Button, Card, Chip, Notice, SafariPrompt } from '#lib/ui/index.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { orderedGuides, type GuideId } from '#lib/pwa/platform.ts';
	import { GUIDE_NAME, stepsFor } from '#lib/pwa/steps.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const NOTE = { inapp: 'install.note.inapp', 'ios-other': 'install.note.ios-other', samsung: 'install.note.samsung' } as const;
	const guides = orderedGuides(install.guide);
	let picked = $state<GuideId>(install.guide);
	const steps = $derived(stepsFor(picked, install.oldSafari));

	// opening again starts from this device's steps
	$effect(() => {
		if (install.showGuide) picked = install.guide;
	});

	let prompting = $state(false);
	async function installNow() {
		haptic('selection');
		prompting = true;
		try {
			if (await install.prompt()) install.showGuide = false;
		} finally {
			prompting = false;
		}
	}
</script>

<!-- its own layer: opened from the sign-in screen (z 150), it must come up above it -->
<div class="install-layer">
<Sheet open={install.showGuide} label={t('install.title')} onclose={() => (install.showGuide = false)}>
	{#snippet header()}
		<div class="head">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="title-2">{t('install.title')}</div>
				<div class="caption">{t('install.lead')}</div>
			</div>
			<Button variant="plain" size="sm" onclick={() => (install.showGuide = false)}>{t('common.done')}</Button>
		</div>
	{/snippet}

	<div class="content">
	{#if install.installed}
		<Notice tone="success" title={t('install.installedTitle')}>{t('install.installedBody')}</Notice>
	{:else if install.justInstalled}
		<Notice tone="success" title={t('install.doneTitle')}>{t('install.doneBody')}</Notice>
	{:else if install.canPrompt}
		<Card padding="md" class="install-quick">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="headline">{t('install.quickTitle')}</div>
				<div class="caption">{t('install.quickBody')}</div>
			</div>
			<Button variant="accent" busy={prompting} onclick={installNow}>{t('install.now')}</Button>
		</Card>
	{/if}

	{#if install.needsSafari && !install.installed && picked === install.guide}
		<!-- iPhone/iPad outside Safari: only Safari can install, so move there first -->
		<SafariPrompt href={resumeLink(page.url.href)} app={install.appName} browser={['chrome', 'edge', 'firefox'].includes(install.env.browser)} />
	{:else if install.note && picked === install.guide}
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
			<Card as="li" padding="sm" class="install-step">
				<InstallArt kind={s.art} label={s.artLabel ? t(s.artLabel) : ''} />
				<div class="text">
					<span class="num" aria-hidden="true">{n + 1}</span>
					<div class="stack" style:--gap="var(--space-px)">
						<div class="headline">{t(s.title)}</div>
						{#if s.body}<div class="caption body">{t(s.body)}</div>{/if}
					</div>
				</div>
			</Card>
		{/each}
	</ol>

	<p class="caption why">{t('install.why')}</p>
	</div>
</Sheet>
</div>

<style>
	.install-layer {
		position: relative;
		z-index: 160;
	}
	.content {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-1) var(--space-3);
	}
	.head :global(.btn) {
		margin-left: auto;
		flex: none;
	}
	.content :global(.install-quick) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.content :global(.install-quick .btn) {
		margin-left: auto;
		flex: none;
	}
	.chips {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		padding: var(--space-px) var(--space-px) var(--space-1);
		margin: 0 calc(-1 * var(--space-px));
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
		margin: var(--space-1) var(--space-1h) 0;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}
	@media (min-width: 520px) {
		.steps {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.steps :global(.install-step) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.text {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: 0 var(--space-1) var(--space-1);
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
		margin: var(--space-px) var(--space-1h) var(--space-2);
		color: var(--color-text-2);
	}
</style>
