<!--
	A short line from Kuri (or anyone with an avatar), as a speech bubble.
	Draft for the Writing helper, kanji drills and the weekly report
	(docs/EVERYDAY.md). `avatar` is a snippet; it defaults to Kuri's face emoji.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { avatar, children, label = 'Kuri says' }: { avatar?: Snippet; children: Snippet; label?: string } = $props();
</script>

<div class="say" role="note" aria-label={label}>
	<span class="avatar" aria-hidden="true">{#if avatar}{@render avatar()}{:else}🐕{/if}</span>
	<div class="bubble">{@render children()}</div>
</div>

<style>
	.say {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		min-width: 0;
	}
	.avatar {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-round);
		display: grid;
		place-items: center;
		font-size: 22px;
		background: color-mix(in srgb, var(--color-warning) 25%, var(--color-surface-strong));
	}
	.bubble {
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-card) var(--radius-card) var(--radius-card) var(--radius-xs);
		background: var(--color-surface-strong);
		box-shadow: var(--shadow-surface);
		font-size: var(--text-subhead);
		line-height: var(--leading-snug);
	}
</style>
