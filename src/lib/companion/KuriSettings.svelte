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
	import { Button, Card, ListGroup, ListRow, Switch } from '#lib/ui/index.ts';

	const s = $derived(progress.settings);
	const save = (p: Partial<Settings>) => void progress.saveSettings(p);
	const STYLES = [
		{ v: 'bandana', key: 'kuri.bandana' },
		{ v: 'neckerchief', key: 'kuri.neckerchief' }
	] as const;

	async function replay() {
		await goto('/'); // ui-ok: client-side navigation, the next screen renders at once
		ui.showKuriIntro = true;
	}
</script>

<h2 class="eyebrow section">{t('kuri.section')}</h2>
{#snippet avatar()}<span class="avatar"><Kuri options={{ yaw: 0.3, distance: 2.7, target: [0, 1.7, 0.3], fps: 20 }} /></span>{/snippet}

<div class="kuri">
	<ListGroup class="rise">
		<ListRow title={t('kuri.show')} subtitle={t('kuri.showBody')} leading={s.kuri ? avatar : undefined}>
			{#snippet trailing()}<Switch label={t('kuri.show')} checked={s.kuri} onchange={(v) => save({ kuri: v })} />{/snippet}
		</ListRow>
		{#if s.kuri}
			<ListRow>
				<div class="styles" role="radiogroup" aria-label={t('kuri.style')}>
					{#each STYLES as o (o.v)}
						<Card
							padding="none"
							radius="control"
							class={s.kuriStyle === o.v ? 'style on' : 'style'}
							role="radio"
							aria-checked={s.kuriStyle === o.v}
							onclick={() => (save({ kuriStyle: o.v }), haptic('selection'))}
						>
							<span class="preview"><Kuri variant={o.v} options={{ yaw: 0.35, distance: 6.6, target: [0, 1.15, 0], fps: 20 }} /></span>
							<span>{t(o.key)}</span>
						</Card>
					{/each}
				</div>
			</ListRow>
			<ListRow title={t('kuri.walk')}>
				{#snippet trailing()}<Switch label={t('kuri.walk')} checked={s.kuriWalk} onchange={(v) => save({ kuriWalk: v })} />{/snippet}
			</ListRow>
			<ListRow title={t('kuri.react')} subtitle={t('kuri.reactBody')}>
				{#snippet trailing()}<Switch label={t('kuri.react')} checked={s.kuriReact} onchange={(v) => save({ kuriReact: v })} />{/snippet}
			</ListRow>
			<ListRow title={t('kuri.lowPoly')} subtitle={t('kuri.lowPolyBody')}>
				{#snippet trailing()}<Switch label={t('kuri.lowPoly')} checked={s.kuriLowPoly} onchange={(v) => save({ kuriLowPoly: v })} />{/snippet}
			</ListRow>
			<ListRow title={t('kuri.sound')} subtitle={t('kuri.soundBody')}>
				{#snippet trailing()}
					<Switch label={t('kuri.sound')} checked={s.kuriSound} onchange={(v) => (save({ kuriSound: v, kuriSoundChosen: true }), v && play('yip'))} />
				{/snippet}
			</ListRow>
			<ListRow>
				<span><Button variant="ghost" size="sm" onclick={replay}>▶ {t('kuri.replay')}</Button></span>
			</ListRow>
		{/if}
	</ListGroup>
</div>

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.avatar {
		display: block;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		overflow: hidden;
		background: var(--color-fill);
	}
	.styles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.kuri .styles :global(.style) {
		display: grid;
		gap: var(--space-1);
		justify-items: center;
		padding: var(--space-1h) var(--space-1h) var(--space-3);
		border: 2px solid transparent;
		background: var(--color-fill);
		font-size: var(--text-footnote);
	}
	.kuri .styles :global(.style.on) {
		border-color: var(--color-accent);
	}
	.preview {
		width: 100%;
		height: 110px;
	}
</style>
