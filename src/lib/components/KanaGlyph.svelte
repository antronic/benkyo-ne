<script lang="ts">
	import { strokesOf } from '#lib/content/strokes.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';

	interface Props {
		char: string;
		size?: number | string;
		/** 0..1 — opacity of the mnemonic scene under the glyph. */
		scene?: number;
		color?: string;
		weight?: number;
		/** Optional colour per stroke (e.g. kanji components). */
		colors?: (string | undefined)[];
	}
	let { char, size = 160, scene = 0, color = 'currentColor', weight = 5, colors }: Props = $props();

	const data = $derived(strokesOf(char));
	const art = $derived(scene > 0 ? mnemonicFor(char).scene : undefined);
</script>

<svg
	viewBox="0 0 109 109"
	width={size}
	height={size}
	role="img"
	aria-label={char}
	class="glyph"
>
	{#if art}
		<g style:opacity={scene} class="scene">{@html art}</g>
	{/if}
	{#if data}
		<g fill="none" stroke={color} stroke-width={weight} stroke-linecap="round" stroke-linejoin="round">
			{#each data.d as d, i}<path {d} stroke={colors?.[i]} />{/each}
		</g>
	{:else}
		<text x="54.5" y="80" font-size="72" text-anchor="middle" class="jp" fill={color}>{char}</text>
	{/if}
</svg>

<style>
	.glyph {
		display: block;
		overflow: visible;
	}
	.scene {
		transition: opacity 600ms var(--ease-out);
	}
</style>
