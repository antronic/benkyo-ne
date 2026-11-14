<!--
	Read a pack: each word is shown kana-first; tap to reveal the meaning,
	hook and example. Finishing adds the words as cards (D10).
-->
<script lang="ts">
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Romaji from '#lib/components/Romaji.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import WordCardView from '#lib/components/WordCardView.svelte';
	import { listPacks, finishPack, skipPackWord, type Pack } from '#lib/words/packs.ts';
	import { speak } from '#lib/content/kana.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 285;
	let pack = $state<Pack | null>(null);
	let i = $state(0);
	let revealed = $state(false);
	let missing = $state(false);

	onMount(async () => {
		pack = (await listPacks()).find((p) => p.id === page.params.id) ?? null;
		missing = !pack;
		if (pack && progress.settings.autoplayAudio) speak(pack.items[0].reading);
	});

	const item = $derived(pack?.items[i]);

	function reveal() {
		revealed = true;
		haptic('selection');
	}
	async function skip() {
		if (!pack || !item) return;
		const updated = await skipPackWord(pack.id, item.key);
		haptic('selection');
		toast('Skipped · it won’t come back', '↷');
		if (!updated || !updated.items.length) return goto('/words');
		pack = updated;
		if (i >= pack.items.length) {
			i = pack.items.length - 1;
			revealed = true; // last word was skipped; show Finish
			return;
		}
		revealed = false;
		if (progress.settings.autoplayAudio) speak(pack.items[i].reading);
	}

	async function next() {
		if (!pack) return;
		if (i < pack.items.length - 1) {
			i++;
			revealed = false;
			if (progress.settings.autoplayAudio) speak(pack.items[i].reading);
			return;
		}
		const n = await finishPack(pack.id);
		haptic('success');
		toast(n ? `${n} words added · they’ll appear in reviews` : 'Pack finished', '✓', 2400);
		goto('/words');
	}
</script>

<main class="reader">
	<header class="top">
		<button class="icon-btn" aria-label="Close" onclick={() => goto('/words')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
		</button>
		<div class="bar"><span style:width="{pack ? ((i + (revealed ? 1 : 0.5)) / pack.items.length) * 100 : 0}%"></span></div>
		<span class="caption">{pack ? `${i + 1}/${pack.items.length}` : ''}</span>
	</header>

	{#if !pack && !missing}
		<div class="stack" style:--gap="12px" style="margin-top:20px"><Skeleton variant="card" count={1} label="Opening pack" /><Skeleton variant="line" count={2} /></div>
	{:else if missing}
		<p class="subhead">This pack isn’t on this device anymore.</p>
	{:else if pack && item}
		{#if pack.theme}
			<div class="theme">
				<span class="eyebrow">Theme</span>
				<span class="headline">{pack.theme.en}</span>
				{#if pack.theme.second}<span class="caption">{pack.theme.second}</span>{/if}
			</div>
		{/if}
		{#key i}
			<section class="stage" in:fly={{ x: 40, duration: 380, easing: cubicOut, opacity: 0 }}>
				<div class="split">
					<div class="pane">
						<button class="word glass sheen" onclick={() => speak(item.reading)} aria-label="Listen to {item.reading}">
							<span class="jp">{item.reading}<Romaji text={item.reading} /></span>
						</button>
						<p class="caption">Read it aloud first, then reveal.</p>
					</div>
					<div class="pane">
						{#if revealed}
							<div class="glass back" in:fly={{ y: 12, duration: 300 }}>
								<WordCardView
									card={{
										front: item.reading,
										kanji: item.written.find((w) => w !== item.reading) ?? null,
										gloss: item.gloss,
										gloss2: item.gloss2,
										hook: item.hook,
										usage: null,
										example: item.example,
										kind: item.kind,
										verified: true
									}}
								/>
							</div>
							<button class="btn accent block" onclick={next}>{i < pack.items.length - 1 ? 'Next word' : 'Finish pack'}</button>
						{:else}
							<button class="btn block" onclick={reveal}>Reveal meaning</button>
						{/if}
						<button class="btn ghost small" onclick={skip}>↷ Skip this word</button>
					</div>
				</div>
			</section>
		{/key}
	{/if}
</main>

<style>
	.reader {
		min-height: 100dvh;
		max-width: 1040px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + 20px) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.bar {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: var(--hairline);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #8b5cf6, var(--accent-2));
		transition: width 500ms var(--spring);
	}
	.theme {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.stage {
		flex: 1;
		display: flex;
		align-items: center;
	}
	.word {
		width: min(78vw, 340px);
		aspect-ratio: 1.3;
		border-radius: var(--r-l);
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: clamp(2.5rem, 12vw, 4rem);
		font-weight: 600;
	}
	.back {
		width: 100%;
		max-width: 440px;
		padding: 16px;
		border-radius: var(--r-l);
	}
</style>
