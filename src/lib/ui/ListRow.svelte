<!--
	One row of a ListGroup: title, optional subtitle, optional leading and
	trailing content. With href or onclick the whole row is tappable and shows
	a chevron.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title?: string;
		subtitle?: string;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		chevron?: boolean;
		tone?: 'default' | 'danger' | 'link';
		leading?: Snippet;
		trailing?: Snippet;
		children?: Snippet;
	};
	let { title, subtitle, href, onclick, chevron, tone = 'default', leading, trailing, children }: Props = $props();
	const tappable = $derived(!!href || !!onclick);
	const showChevron = $derived(chevron ?? !!href);
</script>

{#snippet body()}
	{#if leading}<span class="leading">{@render leading()}</span>{/if}
	<span class="main">
		{#if title}<span class="title">{title}</span>{/if}
		{#if subtitle}<span class="caption">{subtitle}</span>{/if}
		{@render children?.()}
	</span>
	{#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
	{#if showChevron}<span class="chev" aria-hidden="true">›</span>{/if}
{/snippet}

{#if href}
	<a class="ui-row tap {tone}" {href}>{@render body()}</a>
{:else if tappable}
	<button type="button" class="ui-row tap {tone}" {onclick}>{@render body()}</button>
{:else}
	<div class="ui-row {tone}">{@render body()}</div>
{/if}

<style>
	.ui-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		min-height: 48px;
		padding: var(--space-3) var(--space-4);
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		text-decoration: none;
		font: inherit;
	}
	:global(.ui-row + .ui-row) {
		border-top: var(--hairline-w) solid var(--color-border);
	}
	.tap {
		cursor: pointer;
		transition: background var(--dur-fast);
	}
	.tap:active {
		background: var(--color-fill);
	}
	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.leading,
	.trailing {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.trailing {
		color: var(--color-text-2);
	}
	.chev {
		color: var(--color-text-3);
		font-size: var(--text-title-3);
		line-height: 1;
	}
	.danger .title {
		color: var(--color-danger);
	}
	.link .title {
		color: var(--color-link);
	}
</style>
