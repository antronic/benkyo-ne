<!-- Filter / suggestion chip. `selected` fills it with indigo; tone="accent" for a call to action. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = {
		selected?: boolean;
		tone?: 'default' | 'accent';
		count?: number;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		children: Snippet;
	};
	let { selected = false, tone = 'default', count, href, onclick, disabled = false, children }: Props = $props();
</script>

{#if href}
	<a class="chip {tone}" class:on={selected} {href} aria-current={selected || undefined}>
		{@render children()}{#if count !== undefined}<span class="count">{count}</span>{/if}
	</a>
{:else}
	<button type="button" class="chip {tone}" class:on={selected} aria-pressed={selected} {onclick} {disabled}>
		{@render children()}{#if count !== undefined}<span class="count">{count}</span>{/if}
	</button>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1h);
		min-height: var(--control-sm);
		padding: 0 14px;
		border: var(--hairline-w) solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: inherit;
		font: inherit;
		font-size: var(--text-subhead);
		text-decoration: none;
		cursor: pointer;
		transition: transform var(--dur-press) var(--ease-spring);
	}
	.chip:active {
		transform: scale(0.95);
	}
	.on {
		background: var(--color-info);
		border-color: transparent;
		color: var(--color-on-solid);
	}
	.accent {
		background: var(--color-accent);
		border-color: transparent;
		color: var(--color-on-accent);
		font-weight: var(--weight-semibold);
	}
	.count {
		opacity: 0.6;
		font-size: var(--text-footnote);
	}
	.chip:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
