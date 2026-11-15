<!-- Eyebrow heading above a group, like an iOS grouped table section header. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, level = 2, trailing }: { title: string; level?: 2 | 3; trailing?: Snippet } = $props();
</script>

<div class="head">
	<svelte:element this={`h${level}`} class="eyebrow">{title}</svelte:element>
	{#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	h2,
	h3 {
		margin: 0;
	}
	.trailing {
		margin-left: auto;
		font-size: var(--text-footnote);
	}
</style>
