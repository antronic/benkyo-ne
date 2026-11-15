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
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import AiSettings from '#lib/components/AiSettings.svelte';
	import { Select } from '#lib/ui/index.ts';
	import { version } from '$app/env';
	import { updater } from '#lib/pwa/update.svelte.ts';
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

<main class="page stack settings" style:--gap="10px">
	<LargeTitle title={t('nav.settings')} />

	<LanguageSettings />

	<KuriSettings />

	<h2 class="eyebrow section">{t('settings.learning')}</h2>
	<div class="glass group rise" style:--i="1">
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>{t('settings.retention')}</span>
				<span class="caption">{t('settings.retentionBody')}</span>
			</span>
			<span class="spacer"></span>
			<b>{Math.round(progress.settings.retention * 100)}%</b>
		</div>
		<div class="item slider">
			<input
				type="range"
				min="0.8"
				max="0.95"
				step="0.01"
				value={progress.settings.retention}
				oninput={(e) => progress.saveSettings({ retention: +e.currentTarget.value })}
				aria-label={t('settings.retention')}
			/>
		</div>
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>{t('settings.newPerDay')}</span>
				<span class="caption">{t('settings.newPerDayBody')}</span>
			</span>
			<span class="spacer"></span>
			<div class="stepper glass">
				<button onclick={() => progress.saveSettings({ newPerDay: Math.max(5, progress.settings.newPerDay - 5) })} aria-label={t('settings.fewer')}>−</button>
				<b>{progress.settings.newPerDay}</b>
				<button onclick={() => progress.saveSettings({ newPerDay: Math.min(40, progress.settings.newPerDay + 5) })} aria-label={t('settings.more')}>+</button>
			</div>
		</div>
		<label class="item">
			<span>{t('settings.haptics')}</span><span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.haptics} onchange={(e) => progress.saveSettings({ haptics: e.currentTarget.checked })} />
		</label>
		<label class="item">
			<span class="stack" style:--gap="0">
				<span>{t('settings.romaji')}</span>
				<span class="caption">{t('settings.romajiBody')}</span>
			</span>
			<span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.showRomaji} onchange={(e) => progress.saveSettings({ showRomaji: e.currentTarget.checked })} />
		</label>
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>{t('settings.tabbar')}</span>
				<span class="caption">{t('settings.tabbarBody')}</span>
			</span>
			<span class="spacer"></span>
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
		</div>
		<label class="item">
			<span>{t('settings.autoplay')}</span><span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.autoplayAudio} onchange={(e) => progress.saveSettings({ autoplayAudio: e.currentTarget.checked })} />
		</label>
	</div>

	<h2 class="eyebrow section">{t('sync.section')}</h2>
	<div class="glass group rise" style:--i="2">
		{#if ai.signedIn && ai.account}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>{t('sync.syncedTo', { name: ai.account.name })}</span>
					<span class="caption">{t('sync.accountBody')}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn small nowrap" onclick={syncNow} disabled={syncing}>{syncing ? t('sync.syncing') : t('sync.now')}</button>
			</div>
		{:else if oldKey}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>{t('sync.keyTitle')}</span>
					<span class="caption">{t('sync.keyBody')}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small nowrap" onclick={syncNow} disabled={syncing}>{syncing ? t('sync.syncing') : t('sync.now')}</button>
			</div>
		{:else if claimed}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>{t('sync.claimedTitle')}</span>
					<span class="caption">{t('sync.claimedBody')}</span>
				</span>
			</div>
		{:else}
			<div class="item">
				<span class="caption">{t('sync.localBody')}</span>
			</div>
		{/if}
		{#if status}<div class="item caption">{status}</div>{/if}
	</div>

	<AiSettings />

	<h2 class="eyebrow section">{t('settings.about')}</h2>
	<div class="glass group rise" style:--i="3">
		<div class="item"><span>{t('settings.engine')}</span><span class="spacer"></span><span class="caption">{engine}</span></div>
		<div class="item"><span>{t('settings.version')}</span><span class="spacer"></span><span class="caption">{fmtDateTime(Number(version) || Date.now())}{#if updater.ready} · <button class="link" onclick={() => updater.restart()}>{t('settings.updateReady')}</button>{/if}</span></div>
		<div class="item"><span>{t('settings.intro')}</span><span class="spacer"></span><button class="btn ghost small" onclick={() => (ui.showIntro = true)}>▶ {t('settings.replayIntro')}</button></div>
		<div class="item"><span>{t('settings.scheduler')}</span><span class="spacer"></span><span class="caption">FSRS-5</span></div>
		<div class="item caption">
			<span>{t('settings.strokeData')} <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">KanjiVG</a>
			{t('settings.strokeDataBy')}</span>
		</div>
		<div class="item caption">{DICT_ATTRIBUTION}</div>
		<div class="item"><button class="btn ghost block danger" onclick={reset}>{t('settings.erase')}</button></div>
	</div>
</main>

<style>
	@media (min-width: 600px) {
		.settings > :global(*) {
			max-width: 680px;
		}
	}
	.section {
		margin: 16px 6px 2px;
	}
	.group {
		padding: 4px 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		min-height: 48px;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	.slider {
		padding-top: 0;
		border-top: 0 !important;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 10px;
		padding: 2px;
	}
	.stepper button {
		border: 0;
		background: none;
		width: 34px;
		height: 30px;
		font-size: 20px;
		cursor: pointer;
	}
	.switch {
		appearance: none;
		width: 51px;
		height: 31px;
		border-radius: 16px;
		background: var(--hairline);
		position: relative;
		cursor: pointer;
		transition: background 250ms;
		flex: none;
		margin: 0;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 3px 8px rgb(0 0 0 / 0.15);
		transition: transform 450ms var(--spring-bouncy);
	}
	.switch:checked {
		background: var(--success);
	}
	.switch:checked::after {
		transform: translateX(20px);
	}
	a {
		color: var(--accent-2);
	}
	.link {
		border: 0;
		background: none;
		color: var(--accent-2);
		font: inherit;
		cursor: pointer;
		padding: 0;
	}
	.danger {
		color: var(--danger);
	}
	.nowrap {
		white-space: nowrap;
		flex: none;
	}
</style>
