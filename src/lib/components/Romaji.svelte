<!--
	Small romaji line for Japanese text. Respects Settings → "Show romaji".
	`hide` is for quiz prompts whose answer is the reading.
-->
<script lang="ts">
	import { toRomaji } from '#lib/content/romaji.ts';
	import { progress } from '#lib/state/progress.svelte.ts';

	let { text, hide = false, inline = false }: { text: string; hide?: boolean; inline?: boolean } = $props();
	const r = $derived(toRomaji(text));
</script>

{#if progress.settings.showRomaji && !hide && r && r !== text}
	<span class="rmj" class:inline lang="ja-Latn">{r}</span>
{/if}

<style>
	.rmj {
		display: block;
		font-family: var(--font);
		font-size: 0.72em;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--ink-3);
		line-height: 1.25;
		white-space: pre-line;
	}
	.inline {
		display: inline;
		margin-left: 0.4em;
	}
</style>
