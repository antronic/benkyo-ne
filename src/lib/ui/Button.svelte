<!--
	Pill button. Uses the global .btn styles in app.css, so screens that still
	write <button class="btn accent"> look identical while they migrate.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'plain';
		size?: 'md' | 'sm';
		block?: boolean;
		href?: string;
		busy?: boolean;
		icon?: Snippet;
		children?: Snippet;
	};
	let { variant = 'primary', size = 'md', block = false, href, busy = false, icon, children, class: cls = '', disabled, ...rest }: Props = $props();
	const classes = $derived(['btn', variant !== 'primary' && variant, size === 'sm' && 'small', block && 'block', cls].filter(Boolean).join(' '));
</script>

{#if href && !disabled}
	<a {href} class={classes}>{#if icon}{@render icon()}{/if}{@render children?.()}</a>
{:else}
	<button type="button" class={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
		{#if busy}<span class="spin" aria-hidden="true"></span>{:else if icon}{@render icon()}{/if}{@render children?.()}
	</button>
{/if}

<style>
	a {
		text-decoration: none;
	}
	:global(.btn.danger) {
		background: var(--color-danger);
		color: var(--color-on-solid);
	}
	:global(.btn.plain) {
		background: none;
		color: var(--color-link);
		padding: 0 var(--space-2);
	}
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
