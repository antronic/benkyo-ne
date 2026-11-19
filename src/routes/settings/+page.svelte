<script lang="ts">
	import { t, fmtDateTime, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { getSyncKey, keyWasClaimed, onSync, sync, type SyncResult } from '#lib/sync.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { getMatcher } from '#lib/handwriting/match.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import AiSettings from '#lib/components/AiSettings.svelte';
	import CommunitySettings from '#lib/components/CommunitySettings.svelte';
	import { Button, ListGroup, ListRow, Select, Slider, Spinner, Stepper, Switch } from '#lib/ui/index.ts';
	import { version } from '$app/env';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { DICT_ATTRIBUTION } from '#lib/dict/attribution.ts';
	import LanguageSettings from '#lib/components/LanguageSettings.svelte';
	import KuriSettings from '#lib/companion/KuriSettings.svelte';

	ui.hue = 260;
	let oldKey = $state<string | undefined>();
	let claimed = $state(false);
	let status = $state('');
	let engine = $state('…');
	let syncing = $state(false);

	const readKey = async () => {
		oldKey = await getSyncKey();
		claimed = await keyWasClaimed();
	};
	onMount(() => {
		void readKey();
		// automatic syncs can retire the key too
		const off = onSync(() => void readKey());
		void (async () => (engine = (await getMatcher()).kind === 'wasm' ? 'WebAssembly (Rust)' : t('settings.jsFallback')))();
		return off;
	});

	const ERRORS: Record<string, MessageKey> = {
		offline: 'sync.err.offline',
		network: 'sync.err.network',
		'signed-out': 'sync.err.signedOut',
		'key-claimed': 'sync.err.keyClaimed'
	};
	const describe = (r: SyncResult) =>
		'error' in r
			? ERRORS[r.error]
				? t(ERRORS[r.error])
				: t('sync.failedWith', { error: r.error })
			: r.pushed + r.pulled
				? t('sync.upToDateCounts', { sent: r.pushed, received: r.pulled })
				: t('sync.upToDate');

	async function syncNow() {
		syncing = true;
		const r = await sync();
		syncing = false;
		status = describe(r);
		if ('error' in r) {
			haptic('error');
			toast(r.error === 'offline' ? t('sync.offline') : t('sync.failed'), '⚠️');
		} else {
			haptic('success');
			toast(t('sync.synced'), '✓');
		}
	}
	async function reset() {
		const ok = await confirmDestructive(
			t('settings.eraseTitle'),
			t('settings.eraseBody'),
			t('settings.eraseConfirm')
		);
		if (ok) {
			await progress.reset();
			toast(t('settings.erased'));
		}
	}
</script>

<main class="page stack settings" style:--gap="var(--space-3)">
	<LargeTitle title={t('nav.settings')} />

	<LanguageSettings />

	<KuriSettings />

	<h2 class="eyebrow section">{t('settings.learning')}</h2>
	<ListGroup class="rise">
		<ListRow title={t('settings.retention')} subtitle={t('settings.retentionBody')}>
			{#snippet trailing()}<b class="value">{Math.round(progress.settings.retention * 100)}%</b>{/snippet}
		</ListRow>
		<div class="slider">
			<Slider
				min={0.8}
				max={0.95}
				step={0.01}
				value={progress.settings.retention}
				oninput={(v) => progress.saveSettings({ retention: v })}
				label={t('settings.retention')}
			/>
		</div>
		<ListRow title={t('settings.newPerDay')} subtitle={t('settings.newPerDayBody')}>
			{#snippet trailing()}
				<Stepper
					label={t('settings.newPerDay')}
					min={5}
					max={40}
					step={5}
					value={progress.settings.newPerDay}
					onchange={(v) => progress.saveSettings({ newPerDay: v })}
				/>
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.haptics')}>
			{#snippet trailing()}
				<Switch label={t('settings.haptics')} checked={progress.settings.haptics} onchange={(v) => progress.saveSettings({ haptics: v })} />
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.romaji')} subtitle={t('settings.romajiBody')}>
			{#snippet trailing()}
				<Switch label={t('settings.romaji')} checked={progress.settings.showRomaji} onchange={(v) => progress.saveSettings({ showRomaji: v })} />
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.tabbar')} subtitle={t('settings.tabbarBody')}>
			{#snippet trailing()}
				<Select
					label={t('settings.tabbar')}
					value={progress.settings.navPosition}
					options={[
						{ value: 'auto', label: t('settings.tabAuto') },
						{ value: 'bottom', label: t('settings.tabBottom') },
						{ value: 'side', label: t('settings.tabSide') }
					]}
					onchange={(v) => progress.saveSettings({ navPosition: v })}
				/>
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.autoplay')}>
			{#snippet trailing()}
				<Switch label={t('settings.autoplay')} checked={progress.settings.autoplayAudio} onchange={(v) => progress.saveSettings({ autoplayAudio: v })} />
			{/snippet}
		</ListRow>
	</ListGroup>

	<h2 class="eyebrow section">{t('sync.section')}</h2>
	<ListGroup class="rise">
		{#if ai.signedIn && ai.account}
			<ListRow title={t('sync.syncedTo', { name: ai.account.name })} subtitle={t('sync.accountBody')}>
				{#snippet trailing()}
					<Button size="sm" onclick={syncNow} busy={syncing}>{syncing ? t('sync.syncing') : t('sync.now')}</Button>
				{/snippet}
			</ListRow>
		{:else if oldKey}
			<ListRow title={t('sync.keyTitle')} subtitle={t('sync.keyBody')}>
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={syncNow} busy={syncing}>{syncing ? t('sync.syncing') : t('sync.now')}</Button>
				{/snippet}
			</ListRow>
		{:else if claimed}
			<ListRow title={t('sync.claimedTitle')} subtitle={t('sync.claimedBody')} />
		{:else}
			<ListRow subtitle={t('sync.localBody')} />
		{/if}
		{#if status}<ListRow subtitle={status} />{/if}
	</ListGroup>

	<AiSettings />

	<CommunitySettings />

	<h2 class="eyebrow section">{t('install.section')}</h2>
	<ListGroup class="rise">
		{#if install.installed}
			<ListRow title={t('install.installedTitle')} subtitle={t('install.installedBody')}>
				{#snippet trailing()}<span class="ok" aria-hidden="true">✓</span>{/snippet}
			</ListRow>
		{:else}
			<ListRow title={t('install.settingsTitle')} subtitle={install.justInstalled ? t('install.doneBody') : t('install.settingsBody')}>
				{#snippet trailing()}
					{#if install.canPrompt}
						<Button variant="accent" size="sm" onclick={() => install.prompt()}>{t('install.now')}</Button>
					{:else}
						<Button variant="ghost" size="sm" onclick={() => (install.showGuide = true)}>{t('install.showMe')}</Button>
					{/if}
				{/snippet}
			</ListRow>
			{#if install.canPrompt}
				<ListRow>
					<span><Button variant="link" onclick={() => (install.showGuide = true)}>{t('install.howTo')}</Button></span>
				</ListRow>
			{/if}
		{/if}
	</ListGroup>

	<h2 class="eyebrow section">{t('settings.about')}</h2>
	<ListGroup class="rise">
		<ListRow title={t('settings.engine')}>
			{#snippet trailing()}
				{#if engine === '…'}<Spinner size="sm" label={t('common.loading')} />{:else}<span class="caption">{engine}</span>{/if}
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.version')}>
			{#snippet trailing()}
				<span class="caption">{fmtDateTime(Number(version) || Date.now())}{#if updater.ready} · <Button variant="link" onclick={() => updater.restart()}>{t('settings.updateReady')}</Button>{/if}</span>
			{/snippet}
		</ListRow>
		<ListRow title={t('settings.intro')}>
			{#snippet trailing()}<Button variant="ghost" size="sm" onclick={() => (ui.showIntro = true)}>▶ {t('settings.replayIntro')}</Button>{/snippet}
		</ListRow>
		<ListRow title={t('settings.scheduler')}>
			{#snippet trailing()}<span class="caption">FSRS-5</span>{/snippet}
		</ListRow>
		<ListRow>
			<span class="caption">{t('settings.strokeData')} <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">KanjiVG</a>
			{t('settings.strokeDataBy')}</span>
		</ListRow>
		<ListRow subtitle={DICT_ATTRIBUTION} />
		<ListRow>
			<Button variant="ghost-danger" block onclick={reset}>{t('settings.erase')}</Button>
		</ListRow>
	</ListGroup>
</main>

<style>
	.settings {
		--page-max: 680px;
	}
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.ok {
		color: var(--color-success);
		font-weight: 700;
	}
	.value {
		color: var(--color-text);
	}
	.slider {
		display: flex;
		padding: 0 var(--space-4) var(--space-3);
	}
	.slider + :global(.ui-row) {
		border-top: var(--hairline-w) solid var(--color-border);
	}
	a {
		color: var(--accent-2);
	}
</style>
