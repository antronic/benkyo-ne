<!--
	Settings: turn Kuri off, pick an outfit, and choose where Kuri appears.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { progress, type Settings } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import Kuri from './Kuri.svelte';
	import { play } from './sound.ts';
	import { Switch } from '#lib/ui/index.ts';

	const s = $derived(progress.settings);
	const save = (p: Partial<Settings>) => void progress.saveSettings(p);
	const STYLES = [
		{ v: 'bandana', key: 'kuri.bandana' },
		{ v: 'neckerchief', key: 'kuri.neckerchief' }
	] as const;

	async function replay() {
		await goto('/');
		ui.showKuriIntro = true;
	}
</script>

<h2 class="eyebrow section">{t('kuri.section')}</h2>
<div class="glass group rise">
	<label class="item">
		{#if s.kuri}<span class="avatar"><Kuri options={{ yaw: 0.3, distance: 2.7, target: [0, 1.7, 0.3], fps: 20 }} /></span>{/if}
		<span class="stack" style:--gap="0">
			<span>{t('kuri.show')}</span>
			<span class="caption">{t('kuri.showBody')}</span>
		</span>
		<span class="spacer"></span>
		<Switch checked={s.kuri} onchange={(v) => save({ kuri: v })} />
	</label>
	{#if s.kuri}
		<div class="item styles" role="radiogroup" aria-label={t('kuri.style')}>
			{#each STYLES as o (o.v)}
				<button
					class="style"
					role="radio"
					aria-checked={s.kuriStyle === o.v}
					onclick={() => (save({ kuriStyle: o.v }), haptic('selection'))}
				>
					<span class="preview"><Kuri variant={o.v} options={{ yaw: 0.35, distance: 6.6, target: [0, 1.15, 0], fps: 20 }} /></span>
					<span>{t(o.key)}</span>
				</button>
			{/each}
		</div>
		<label class="item">
			<span>{t('kuri.walk')}</span><span class="spacer"></span>
			<Switch checked={s.kuriWalk} onchange={(v) => save({ kuriWalk: v })} />
		</label>
		<label class="item">
			<span class="stack" style:--gap="0">
				<span>{t('kuri.react')}</span>
				<span class="caption">{t('kuri.reactBody')}</span>
			</span>
			<span class="spacer"></span>
			<Switch checked={s.kuriReact} onchange={(v) => save({ kuriReact: v })} />
		</label>
		<label class="item">
			<span class="stack" style:--gap="0">
				<span>{t('kuri.lowPoly')}</span>
				<span class="caption">{t('kuri.lowPolyBody')}</span>
			</span>
			<span class="spacer"></span>
			<Switch checked={s.kuriLowPoly} onchange={(v) => save({ kuriLowPoly: v })} />
		</label>
		<label class="item">
			<span class="stack" style:--gap="0">
				<span>{t('kuri.sound')}</span>
				<span class="caption">{t('kuri.soundBody')}</span>
			</span>
			<span class="spacer"></span>
			<Switch checked={s.kuriSound} onchange={(v) => (save({ kuriSound: v, kuriSoundChosen: true }), v && play('yip'))} />
		</label>
		<div class="item">
			<button class="btn ghost small" onclick={replay}>▶ {t('kuri.replay')}</button>
		</div>
	{/if}
</div>

<style>
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
	.avatar {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		overflow: hidden;
		background: var(--color-fill);
	}
	.styles {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.style {
		display: grid;
		gap: 4px;
		justify-items: center;
		padding: 6px 6px 10px;
		border-radius: var(--radius-control);
		border: 2px solid transparent;
		background: var(--color-fill);
		color: var(--color-text);
		font: inherit;
		font-size: var(--text-footnote);
		cursor: pointer;
		transition:
			border-color var(--dur-fast),
			transform var(--dur-press) var(--ease-spring);
	}
	.style:active {
		transform: scale(var(--press-scale));
	}
	.style[aria-checked='true'] {
		border-color: var(--color-accent);
	}
	.preview {
		width: 100%;
		height: 110px;
	}
	.btn {
		flex: none;
	}
</style>
