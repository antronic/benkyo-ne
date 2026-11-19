<!--
	Liquid Glass surface. The building block for cards, grouped lists and panels.
	With `href` it is a link and with `onclick` a button: a tappable card (lesson
	tiles, kana tiles, answer options) that presses down like iOS.
	Style a screen-specific card by passing `class` and targeting it with
	`:global(.name)` under a local wrapper, or with CSS custom properties.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLElement> & {
		strong?: boolean;
		sheen?: boolean;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		radius?: 'control' | 'card' | 'large' | 'sheet';
		as?: 'div' | 'section' | 'article' | 'li' | 'ol' | 'ul' | 'nav' | 'header' | 'aside' | 'form' | 'label';
		href?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		selected?: boolean;
		el?: HTMLElement;
		class?: string;
		children: Snippet;
	};
	let {
		strong = false,
		sheen = false,
		padding = 'md',
		radius = 'card',
		as = 'div',
		href,
		onclick,
		disabled = false,
		selected = false,
		el = $bindable(),
		class: cls = '',
		children,
		...rest
	}: Props = $props();
	const classes = $derived(`glass card p-${padding} r-${radius} ${cls}`);
</script>

{#if href}
	<a bind:this={el} {href} class="{classes} tap" class:glass-strong={strong} class:sheen class:selected aria-disabled={disabled || undefined} {...rest}>{@render children()}</a>
{:else if onclick}
	<button bind:this={el} type="button" class="{classes} tap" class:glass-strong={strong} class:sheen class:selected {onclick} {disabled} aria-pressed={selected || undefined} {...rest as Record<string, unknown>}>{@render children()}</button>
{:else}
	<svelte:element this={as} bind:this={el} class={classes} class:glass-strong={strong} class:sheen class:selected {...rest}>
		{@render children()}
	</svelte:element>
{/if}

<style>
	/*
		Layout defaults (display, width, padding) have zero specificity so a
		screen's own `:global(.its-class)` rule always wins over them. Radius and
		the selected ring keep normal specificity: they must beat `.glass`.
	*/
	:global(:where(.card)) {
		display: block;
		color: inherit;
	}
	:global(:where(.card.tap)) {
		font: inherit;
		text-align: inherit;
		text-decoration: none;
		width: 100%;
		cursor: pointer;
		transition: transform var(--dur-press) var(--ease-spring);
	}
	.tap:active:not(:disabled) {
		transform: scale(0.97);
	}
	.tap:disabled,
	.tap[aria-disabled='true'] {
		cursor: default;
		opacity: 0.5;
	}
	.selected {
		box-shadow: 0 0 0 2px var(--color-accent), var(--shadow-surface);
	}
	:global(:where(.card.p-none)) {
		padding: 0;
	}
	:global(:where(.card.p-sm)) {
		padding: var(--space-3);
	}
	:global(:where(.card.p-md)) {
		padding: var(--space-4);
	}
	:global(:where(.card.p-lg)) {
		padding: var(--space-5);
	}
	.r-control {
		border-radius: var(--radius-control);
	}
	.r-card {
		border-radius: var(--radius-card);
	}
	.r-large {
		border-radius: var(--r-l);
	}
	.r-sheet {
		border-radius: var(--radius-sheet);
	}
</style>
