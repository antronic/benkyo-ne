<script lang="ts">
	import { onMount } from 'svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { createSyncKey, getSyncKey, setSyncKey, sync, type SyncResult } from '#lib/sync.ts';
	import { getMatcher } from '#lib/handwriting/match.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import AiSettings from '#lib/components/AiSettings.svelte';
	import { Select } from '#lib/ui/index.ts';
	import { version } from '$app/env';
	import { updater } from '#lib/pwa/update.svelte.ts';
	import { DICT_ATTRIBUTION } from '#lib/dict/attribution.ts';

	ui.hue = 260;
	let key = $state<string | undefined>();
	let keyInput = $state('');
	let status = $state('');
	let engine = $state('…');
	let showKey = $state(false);

	onMount(async () => {
		key = await getSyncKey();
		engine = (await getMatcher()).kind === 'wasm' ? 'WebAssembly (Rust)' : 'JavaScript fallback';
	});

	const describe = (r: SyncResult) =>
		'error' in r ? `Sync failed: ${r.error}` : `Synced: ${r.pushed} sent, ${r.pulled} received`;

	function report(r: SyncResult) {
		status = describe(r);
		if ('error' in r) {
			haptic('error');
			toast(r.error === 'offline' ? 'You’re offline' : 'Sync failed', '⚠️');
		} else {
			haptic('success');
			toast('Synced', '✓');
		}
	}
	async function enable() {
		key = await createSyncKey();
		report(await sync());
	}
	async function copyKey() {
		if (!key) return;
		try {
			await navigator.clipboard.writeText(key);
			haptic('success');
			toast('Sync key copied', '📋');
		} catch {
			showKey = true;
		}
	}
	async function link() {
		if (!keyInput.trim()) return;
		await setSyncKey(keyInput);
		key = keyInput.trim();
		keyInput = '';
		report(await sync());
	}
	async function reset() {
		const ok = await confirmDestructive(
			'Erase all progress?',
			'Cards, history and settings on this device will be deleted. Synced copies are kept.',
			'Erase Progress'
		);
		if (ok) {
			await progress.reset();
			toast('Progress erased');
		}
	}
</script>

<main class="page stack settings" style:--gap="10px">
	<LargeTitle title="Settings" />

	<h2 class="eyebrow section">Learning</h2>
	<div class="glass group rise" style:--i="1">
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>Target retention</span>
				<span class="caption">Higher means more reviews but fewer forgotten cards.</span>
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
				aria-label="Target retention"
			/>
		</div>
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>New kana per day</span>
				<span class="caption">Each new card adds future reviews.</span>
			</span>
			<span class="spacer"></span>
			<div class="stepper glass">
				<button onclick={() => progress.saveSettings({ newPerDay: Math.max(5, progress.settings.newPerDay - 5) })} aria-label="Fewer">−</button>
				<b>{progress.settings.newPerDay}</b>
				<button onclick={() => progress.saveSettings({ newPerDay: Math.min(40, progress.settings.newPerDay + 5) })} aria-label="More">+</button>
			</div>
		</div>
		<label class="item">
			<span>Haptics</span><span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.haptics} onchange={(e) => progress.saveSettings({ haptics: e.currentTarget.checked })} />
		</label>
		<label class="item">
			<span class="stack" style:--gap="0">
				<span>Show romaji</span>
				<span class="caption">Small romaji under Japanese text. Hidden on questions where it would give the answer away.</span>
			</span>
			<span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.showRomaji} onchange={(e) => progress.saveSettings({ showRomaji: e.currentTarget.checked })} />
		</label>
		<div class="item">
			<span class="stack" style:--gap="0">
				<span>Tab bar position</span>
				<span class="caption">Auto puts it beside the status bar when your screen has one on the side (iOS 27, folded iPhone Duo).</span>
			</span>
			<span class="spacer"></span>
			<Select
				label="Tab bar position"
				value={progress.settings.navPosition}
				options={[
					{ value: 'auto', label: 'Auto' },
					{ value: 'bottom', label: 'Bottom' },
					{ value: 'side', label: 'Side' }
				]}
				onchange={(v) => progress.saveSettings({ navPosition: v })}
			/>
		</div>
		<label class="item">
			<span>Play audio automatically</span><span class="spacer"></span>
			<input type="checkbox" class="switch" checked={progress.settings.autoplayAudio} onchange={(e) => progress.saveSettings({ autoplayAudio: e.currentTarget.checked })} />
		</label>
	</div>

	<h2 class="eyebrow section">Sync</h2>
	<div class="glass group rise" style:--i="2">
		{#if key}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>Sync key</span>
					<code class="caption">{showKey ? key : '••••••••••••••••'}</code>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={() => (showKey = !showKey)}>{showKey ? 'Hide' : 'Show'}</button>
				<button class="btn ghost small" onclick={copyKey}>Copy</button>
			</div>
			<div class="item">
				<span class="caption">To sync another device, enter this key on it. Keep the key private.</span>
				<span class="spacer"></span>
				<button class="btn small" onclick={async () => report(await sync())}>Sync now</button>
			</div>
		{:else}
			<div class="item">
				<span class="caption">Your progress lives on this device. Turn on sync to back it up and use it on more than one device. No account needed.</span>
			</div>
			<div class="item"><button class="btn block" onclick={enable}>Turn on sync</button></div>
			<div class="item row">
				<input type="text" placeholder="…or paste a key from another device" bind:value={keyInput} />
				<button class="btn ghost small" onclick={link}>Link</button>
			</div>
		{/if}
		{#if status}<div class="item caption">{status}</div>{/if}
	</div>

	<AiSettings />

	<h2 class="eyebrow section">About</h2>
	<div class="glass group rise" style:--i="3">
		<div class="item"><span>Handwriting engine</span><span class="spacer"></span><span class="caption">{engine}</span></div>
		<div class="item"><span>Version</span><span class="spacer"></span><span class="caption">{new Date(Number(version) || Date.now()).toLocaleString()}{#if updater.ready} · <button class="link" onclick={() => updater.restart()}>update ready, restart</button>{/if}</span></div>
		<div class="item"><span>Introduction</span><span class="spacer"></span><button class="btn ghost small" onclick={() => (ui.showIntro = true)}>▶ Replay introduction</button></div>
		<div class="item"><span>Scheduler</span><span class="spacer"></span><span class="caption">FSRS-5</span></div>
		<div class="item caption">
			<span>Stroke order data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">KanjiVG</a>
			by Ulrich Apel, CC BY-SA 3.0.</span>
		</div>
		<div class="item caption">{DICT_ATTRIBUTION}</div>
		<div class="item"><button class="btn ghost block danger" onclick={reset}>Erase progress on this device</button></div>
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
	code {
		font-family: ui-monospace, monospace;
		word-break: break-all;
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
</style>
