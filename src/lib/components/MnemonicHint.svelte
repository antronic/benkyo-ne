<!--
	Memory hint for drawing from memory: the mnemonic picture (without the
	character), the story, and a short "peek" at the faint character.
	Using it is reported via `onuse` so the answer is graded Hard.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { story } from '#lib/i18n/content.ts';
	import { fly, fade } from 'svelte/transition';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';
	import KanaGlyph from './KanaGlyph.svelte';

	let { char, onuse }: { char: string; onuse?: () => void } = $props();
	let open = $state(false);
	let peeking = $state(false);
	let peekTimer: ReturnType<typeof setTimeout>;
	const m = $derived(mnemonicFor(char));

	function show() {
		open = true;
		onuse?.();
	}
	function peek() {
		peeking = true;
		onuse?.();
		clearTimeout(peekTimer);
		peekTimer = setTimeout(() => (peeking = false), 2000);
	}
</script>

{#if !open}
	<button class="btn ghost small" onclick={show}>💡 {t('hint.show')}</button>
{:else}
	<div class="hint glass" in:fly={{ y: 10, duration: 300 }}>
		<div class="pic" aria-hidden="true">
			{#if m.scene}
				<svg viewBox="0 0 109 109" width="100%" height="100%">{@html m.scene}</svg>
			{/if}
			{#if peeking}
				<div class="peek" transition:fade={{ duration: 250 }}><KanaGlyph {char} size="100%" color="var(--ink-3)" /></div>
			{/if}
			{#if !m.scene && !peeking}<span class="placeholder">💭</span>{/if}
		</div>
		<div class="stack" style:--gap="6px">
			<p class="story">{story(char)}</p>
			<button class="btn ghost small" onclick={peek} disabled={peeking}>👀 {t('hint.peek')}</button>
		</div>
	</div>
{/if}

<style>
	.hint {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--r-m);
		width: 100%;
		max-width: 440px;
		text-align: left;
	}
	.pic {
		position: relative;
		flex: none;
		width: 96px;
		height: 96px;
		border-radius: 14px;
		background: var(--glass-strong);
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.peek {
		position: absolute;
		inset: 8px;
	}
	.placeholder {
		font-size: 32px;
		opacity: 0.5;
	}
	.story {
		margin: 0;
		font-size: 0.9375rem;
	}
</style>
