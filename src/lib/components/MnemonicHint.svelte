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
	import { Button, Card } from '#lib/ui/index.ts';

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
	<Button variant="ghost" size="sm" onclick={show}>💡 {t('hint.show')}</Button>
{:else}
	<div class="hint" in:fly={{ y: 10, duration: 300 }}>
		<Card padding="sm" class="hint-card">
			<div class="pic" aria-hidden="true">
				{#if m.scene}
					<svg viewBox="0 0 109 109" width="100%" height="100%">{@html m.scene}</svg>
				{/if}
				{#if peeking}
					<div class="peek" transition:fade={{ duration: 250 }}><KanaGlyph {char} size="100%" color="var(--ink-3)" /></div>
				{/if}
				{#if !m.scene && !peeking}<span class="placeholder">💭</span>{/if}
			</div>
			<div class="stack" style:--gap="var(--space-1h)">
				<p class="story">{story(char)}</p>
				<Button variant="ghost" size="sm" onclick={peek} disabled={peeking}>👀 {t('hint.peek')}</Button>
			</div>
		</Card>
	</div>
{/if}

<style>
	.hint {
		width: 100%;
		max-width: 440px;
	}
	.hint :global(.hint-card) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border-radius: var(--r-m);
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
