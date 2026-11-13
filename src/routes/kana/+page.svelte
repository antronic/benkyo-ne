<!--
	Kana chart.
	  compact (folded): tap → draggable bottom sheet
	  regular (unfolded iPhone Duo): chart | persistent detail pane, like an
	  iPadOS list/detail split. The selection survives fold/unfold.
-->
<script lang="ts">
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
	import Sheet from '#lib/components/Sheet.svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';

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
			<div class="caption">{k.script} · {strokesOf(k.char)?.d.length ?? '?'} strokes</div>
		</div>
		<span class="spacer"></span>
		<button class="icon-btn" aria-label="Listen" onclick={() => speak(k.char)}>🔊</button>
		{#if !regular.current}
			<button class="icon-btn" aria-label="Close" onclick={() => (selected = null)}>✕</button>
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
	<p class="story">{mnemonicFor(k.char).story}</p>
	<div class="row">
		<button class="btn ghost block" onclick={() => { practice = false; animKey++; }}>↻ Watch</button>
		<button class="btn accent block" onclick={() => { practice = true; animKey++; }}>✍️ Practise</button>
	</div>
{/snippet}

<main class="page">
	<div class="layout" class:has-detail={regular.current}>
		<div class="stack" style:--gap="14px">
			<LargeTitle title="Kana" />

			<div class="segmented glass rise" style:--i="1" style:--pos={script === 'hiragana' ? 0 : 1} role="tablist">
				<span class="thumb"></span>
				<button role="tab" aria-selected={script === 'hiragana'} class:on={script === 'hiragana'} onclick={() => setScript('hiragana')}>
					<span class="jp">ひらがな</span> Hiragana
				</button>
				<button role="tab" aria-selected={script === 'katakana'} class:on={script === 'katakana'} onclick={() => setScript('katakana')}>
					<span class="jp">カタカナ</span> Katakana
				</button>
			</div>

			<p class="caption rise" style:--i="2">Tap any character to see its strokes. The tint shows how likely you are to recall it right now.</p>

			{#key script}
				<div class="grid" in:fade={{ duration: 250 }}>
					{#each GRID[script] as r, ri}
						{#each r.cells as k, ci}
							{#if k}
								{@const p = recall(k)}
								<button
									class="cell glass rise"
									style:--i={ri + ci * 0.3}
									style:--m={p ?? 0}
									class:learned={p !== null}
									class:selected={regular.current && selected?.char === k.char}
									aria-label="{k.char}, {k.romaji}"
									onclick={() => open(k)}
								>
									<span class="jp ch">{k.char}</span>
									<span class="ro">{k.romaji}</span>
								</button>
							{:else}
								<span></span>
							{/if}
						{/each}
					{/each}
				</div>
			{/key}
		</div>

		{#if regular.current}
			<aside class="side glass sheen" aria-label="Character detail">
				{#if selected}
					{@render detail(selected)}
				{:else}
					<div class="empty">
						<span class="jp big">あ</span>
						<p class="subhead">Pick a character to watch its stroke order and practise writing it.</p>
					</div>
				{/if}
			</aside>
		{/if}
	</div>
</main>

{#if !regular.current}
	<Sheet open={!!selected} label="{selected?.char ?? ''} details" onclose={() => (selected = null)}>
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
			gap: 24px;
			align-items: start;
		}
	}
	@media (horizontal-viewport-segments: 2) {
		.layout.has-detail {
			grid-template-columns: env(viewport-segment-width 0 0) env(viewport-segment-width 1 0);
			gap: calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0));
		}
	}
	.side {
		position: sticky;
		top: calc(var(--safe-top) + 60px);
		padding: 18px;
		border-radius: var(--r-l);
		display: flex;
		flex-direction: column;
		gap: 12px;
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
	.segmented {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 4px;
		border-radius: 14px;
	}
	.segmented .thumb {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc(50% - 4px);
		border-radius: 10px;
		background: var(--glass-strong);
		box-shadow: 0 3px 10px rgb(0 0 0 / 0.12);
		transform: translateX(calc(var(--pos) * 100%));
		transition: transform 500ms var(--spring-bouncy);
	}
	.segmented button {
		position: relative;
		border: 0;
		background: none;
		min-height: 36px;
		padding: 8px;
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--ink-2);
		cursor: pointer;
		transition: color 200ms;
	}
	.segmented button.on {
		color: var(--ink);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}
	.cell {
		aspect-ratio: 1;
		min-height: 44px;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition:
			transform 380ms var(--spring),
			box-shadow 250ms;
	}
	.cell.learned {
		background: color-mix(in srgb, var(--success) calc(var(--m) * 38%), var(--glass));
	}
	.cell.selected {
		box-shadow:
			0 0 0 2.5px var(--accent),
			var(--glass-shadow);
	}
	.cell:active {
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
		--gap: 8px;
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
