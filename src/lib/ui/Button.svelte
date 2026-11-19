<!--
	Pill button. Uses the global .btn styles in app.css, so screens that still
	write <button class="btn accent"> look identical while they migrate.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { inheritedControlSize, type ControlSize } from './size.ts';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'ghost-danger' | 'plain' | 'link';
		/** Native tooltip and a11y helpers pass through as usual. */
		/** sm 36px, md 44px, lg 50px (default; inside a FieldRow, the row's size). */
		size?: ControlSize;
		block?: boolean;
		href?: string;
		busy?: boolean;
		icon?: Snippet;
		children?: Snippet;
	};
	const inherited = inheritedControlSize();
	let { variant = 'primary', size = inherited ?? 'lg', block = false, href, busy = false, icon, children, class: cls = '', disabled, ...rest }: Props = $props();
	const classes = $derived(
		variant === 'link'
			? ['ui-link', cls].filter(Boolean).join(' ')
			: ['btn', variant === 'ghost-danger' ? 'ghost danger' : variant !== 'primary' && variant, size === 'sm' && 'small', size === 'md' && 'medium', block && 'block', cls].filter(Boolean).join(' ')
	);
</script>

{#if href && !disabled}
	<a {href} class={classes} {...rest as Record<string, unknown>}>{#if icon}{@render icon()}{/if}{@render children?.()}</a>
{:else}
	<button type="button" class={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
		{#if busy}<span class="spin" aria-hidden="true"></span>{:else if icon}{@render icon()}{/if}{@render children?.()}
	</button>
{/if}

<style>
	a {
		text-decoration: none;
	}
	/* Inline text action ("End", "Show all"): no box, link colour. */
	.ui-link {
		display: inline;
		background: none;
		border: 0;
		padding: 0;
		color: var(--color-link);
		font: inherit;
		cursor: pointer;
	}
	.ui-link.danger,
	:global(.ui-link.danger) {
		color: var(--color-danger);
	}
	.ui-link:disabled {
		opacity: 0.4;
		cursor: default;
	}
	/* .btn.danger and .btn.plain live in app.css with the other variants. */
	.spin {
		width: 1em;
		height: 1em;
		border-radius: var(--radius-round);
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
</style>
