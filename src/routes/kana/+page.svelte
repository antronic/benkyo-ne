<!--
	Kana chart.
	  compact (folded): tap → draggable bottom sheet
	  regular (unfolded iPhone Duo): chart | persistent detail pane, like an
	  iPadOS list/detail split. The selection survives fold/unfold.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { scriptName, story } from '#lib/i18n/content.ts';
	import { fade } from 'svelte/transition';
	import { GRID, speak, type Kana, type Script } from '#lib/content/kana.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';
	import { strokesOf } from '#lib/content/strokes.ts';
	import { retrievability } from '#lib/srs/fsrs.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { regular } from '#lib/ios/device.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import StrokeAnimator from '#lib/components/StrokeAnimator.svelte';
	import TracePad from '#lib/components/TracePad.svelte';
	import NoteCard from '#lib/components/NoteCard.svelte';
	import { notes } from '#lib/state/notes.svelte.ts';
	import { Button, Card, IconButton, LargeTitle, Segmented, Sheet } from '#lib/ui/index.ts';

	ui.hue = 150;
	let script = $state<Script>('hiragana');
	let selected = $state<Kana | null>(null);
	let practice = $state(false);
	let animKey = $state(0);

	function recall(k: Kana): number | null {
		const c = progress.cards[`kana:${k.char}`];
		if (!c?.lastReview) return null;
		return retrievability((Date.now() - c.lastReview) / 864e5, Math.max(c.stability, 0.01));
	}

	function open(k: Kana) {
		haptic('selection');
		selected = k;
		practice = false;
		animKey++;
		if (progress.settings.autoplayAudio) speak(k.char);
	}

	const scriptOptions = $derived<{ value: Script; label: string }[]>([
		{ value: 'hiragana', label: `ひらがな ${scriptName('Hiragana')}` },
		{ value: 'katakana', label: `カタカナ ${scriptName('Katakana')}` }
	]);

	function setScript(s: Script) {
		if (s === script) return;
		haptic('selection');
		script = s;
	}
</script>

{#snippet detail(k: Kana)}
	<div class="row head">
		<div class="stack" style:--gap="0">
			<div class="title-2">{k.romaji}</div>
			<div class="caption">{scriptName(k.script)} · {t('kana.strokes', { n: strokesOf(k.char)?.d.length ?? '?' })}</div>
		</div>
		<span class="spacer"></span>
		<IconButton label={t('common.listen')} onclick={() => speak(k.char)}>🔊</IconButton>
		{#if !regular.current}
			<IconButton label={t('common.close')} onclick={() => (selected = null)}>✕</IconButton>
		{/if}
	</div>
	<div class="detail-canvas">
		{#if practice}
			{#key animKey}
				<TracePad char={k.char} mode="trace" size="100%" oncomplete={() => setTimeout(() => animKey++, 600)} />
			{/key}
		{:else}
			{#key k.char + animKey}
				<StrokeAnimator char={k.char} size="100%" scene={mnemonicFor(k.char).scene ? 1 : 0} />
			{/key}
		{/if}
	</div>
	<p class="story">{story(k.char)}</p>
	<div class="row">
		<Button variant="ghost" block onclick={() => { practice = false; animKey++; }}>↻ {t('kana.watch')}</Button>
		<Button variant="accent" block onclick={() => { practice = true; animKey++; }}>✍️ {t('kana.practise')}</Button>
	</div>
	{#key k.char}
		<NoteCard value={notes.text(`kana:${k.char}`)} loading={!notes.ready} onsave={(b) => notes.save(`kana:${k.char}`, k.char, b)} />
	{/key}
{/snippet}

<main class="page">
	<div class="layout" class:has-detail={regular.current}>
		<div class="stack" style:--gap="var(--space-4)">
			<LargeTitle title={t('nav.kana')} />

			<div class="rise" style:--i="1">
				<Segmented options={scriptOptions} value={script} label={t('nav.kana')} onchange={setScript} />
			</div>

			<p class="caption rise" style:--i="2">{t('kana.intro')}</p>

			{#key script}
				<div class="grid" in:fade={{ duration: 250 }}>
					{#each GRID[script] as r, ri}
						{#each r.cells as k, ci}
							{#if k}
								{@const p = recall(k)}
								<Card
									padding="none"
									class="cell rise {p !== null ? 'learned' : ''}"
									style="--i: {ri + ci * 0.3}; --m: {p ?? 0}"
									selected={regular.current && selected?.char === k.char}
									aria-label="{k.char}, {k.romaji}"
									onclick={() => open(k)}
								>
									<span class="jp ch">{k.char}</span>
									<span class="ro">{k.romaji}</span>
								</Card>
							{:else}
								<span></span>
							{/if}
						{/each}
					{/each}
				</div>
			{/key}
		</div>

		{#if regular.current}
			<Card as="aside" sheen padding="lg" radius="large" class="side" aria-label={t('kana.detail')}>
				{#if selected}
					{@render detail(selected)}
				{:else}
					<div class="empty">
						<span class="jp big">あ</span>
						<p class="subhead">{t('kana.pick')}</p>
					</div>
				{/if}
			</Card>
		{/if}
	</div>
</main>

{#if !regular.current}
	<Sheet open={!!selected} label={t('kana.details', { char: selected?.char ?? '' })} onclose={() => (selected = null)}>
		{#if selected}{@render detail(selected)}{/if}
	</Sheet>
{/if}

<style>
	.layout {
		display: block;
	}
	@media (min-width: 600px) {
		.layout.has-detail {
			display: grid;
			grid-template-columns: minmax(0, 1.35fr) minmax(240px, 1fr);
			gap: var(--space-6);
			align-items: start;
		}
	}
	@media (horizontal-viewport-segments: 2) {
		.layout.has-detail {
			grid-template-columns: env(viewport-segment-width 0 0) env(viewport-segment-width 1 0);
			gap: calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0));
		}
	}
	.layout :global(.side) {
		position: sticky;
		top: calc(var(--safe-top) + 60px);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-height: calc(100dvh - var(--safe-top) - 80px);
		overflow: auto;
	}
	.empty {
		display: grid;
		place-items: center;
		text-align: center;
		min-height: 320px;
	}
	.empty .big {
		font-size: 96px;
		opacity: 0.15;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: var(--space-2);
	}
	.grid :global(.cell) {
		aspect-ratio: 1;
		min-height: 44px;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition:
			transform 380ms var(--spring),
			box-shadow 250ms;
	}
	.grid :global(.cell.learned) {
		background: color-mix(in srgb, var(--success) calc(var(--m) * 38%), var(--glass));
	}
	.grid :global(.cell.selected) {
		box-shadow:
			0 0 0 2.5px var(--accent),
			var(--glass-shadow);
	}
	.grid :global(.cell:active) {
		transform: scale(0.9);
	}
	.ch {
		font-size: clamp(22px, 7vw, 34px);
		line-height: 1.1;
	}
	@media (min-width: 600px) {
		.ch {
			font-size: clamp(22px, 3.2vw, 34px);
		}
	}
	.ro {
		font-size: 11px;
		color: var(--ink-2);
		font-weight: 600;
	}
	.head {
		--gap: var(--space-2);
	}
	.detail-canvas {
		width: min(100%, 340px);
		aspect-ratio: 1;
		margin: 0 auto;
	}
	.story {
		margin: 0;
		text-align: center;
		font-size: 1.0625rem;
	}
</style>
