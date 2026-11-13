<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { GRID, speak, type Kana, type Script } from '#lib/content/kana.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';
	import { strokesOf } from '#lib/content/strokes.ts';
	import { retrievability } from '#lib/srs/fsrs.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import StrokeAnimator from '#lib/components/StrokeAnimator.svelte';
	import TracePad from '#lib/components/TracePad.svelte';

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
		selected = k;
		practice = false;
		speak(k.char);
	}
</script>

<main class="page stack" style:--gap="14px">
	<h1 class="large-title rise">Kana</h1>

	<div class="segmented glass rise" style:--i="1" style:--pos={script === 'hiragana' ? 0 : 1}>
		<span class="thumb"></span>
		<button class:on={script === 'hiragana'} onclick={() => (script = 'hiragana')}>
			<span class="jp">ひらがな</span> Hiragana
		</button>
		<button class:on={script === 'katakana'} onclick={() => (script = 'katakana')}>
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
</main>

{#if selected}
	{@const k = selected}
	<button class="scrim" aria-label="Close" onclick={() => (selected = null)} transition:fade={{ duration: 200 }}></button>
	<div class="sheet glass glass-strong" transition:fly={{ y: 500, duration: 520, easing: cubicOut, opacity: 1 }} role="dialog" aria-modal="true" aria-label="{k.char} details">
		<div class="grabber"></div>
		<div class="row head">
			<div class="stack" style:--gap="0">
				<div class="title-2">{k.romaji}</div>
				<div class="caption">{k.script} · {strokesOf(k.char)?.d.length ?? '?'} strokes</div>
			</div>
			<span class="spacer"></span>
			<button class="icon-btn" aria-label="Listen" onclick={() => speak(k.char)}>🔊</button>
			<button class="icon-btn" aria-label="Close" onclick={() => (selected = null)}>✕</button>
		</div>

		<div class="sheet-canvas">
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
	</div>
{/if}

<style>
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
		padding: 9px;
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
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: transform 380ms var(--spring);
	}
	.cell.learned {
		background: color-mix(in srgb, var(--success) calc(var(--m) * 38%), var(--glass));
	}
	.cell:active {
		transform: scale(0.9);
	}
	.ch {
		font-size: clamp(22px, 7vw, 34px);
		line-height: 1.1;
	}
	.ro {
		font-size: 11px;
		color: var(--ink-2);
		font-weight: 600;
	}
	.scrim {
		position: fixed;
		inset: 0;
		border: 0;
		background: rgb(0 0 0 / 0.28);
		z-index: 60;
	}
	.sheet {
		position: fixed;
		z-index: 61;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0 auto;
		max-width: 560px;
		padding: 8px 18px calc(var(--safe-bottom) + 18px);
		border-radius: 34px 34px 0 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 92dvh;
		overflow: auto;
	}
	.grabber {
		width: 38px;
		height: 5px;
		border-radius: 3px;
		background: var(--ink-3);
		margin: 0 auto 4px;
	}
	.head {
		--gap: 8px;
	}
	.sheet-canvas {
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
