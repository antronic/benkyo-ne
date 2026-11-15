<!--
	Liquid Glass surface. The building block for cards, grouped lists and panels.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		strong?: boolean;
		sheen?: boolean;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		radius?: 'control' | 'card' | 'sheet';
		as?: 'div' | 'section' | 'article' | 'li';
		class?: string;
		children: Snippet;
	};
	let { strong = false, sheen = false, padding = 'md', radius = 'card', as = 'div', class: cls = '', children }: Props = $props();
</script>

<svelte:element this={as} class="glass card p-{padding} r-{radius} {cls}" class:glass-strong={strong} class:sheen>
	{@render children()}
</svelte:element>

<style>
	.card {
		display: block;
	}
	.p-none {
		padding: 0;
	}
	.p-sm {
		padding: var(--space-3);
	}
	.p-md {
		padding: var(--space-4);
	}
	.p-lg {
		padding: var(--space-6);
	}
	.r-control {
		border-radius: var(--radius-control);
	}
	.r-card {
		border-radius: var(--radius-card);
	}
	.r-sheet {
		border-radius: var(--radius-sheet);
	}
</style>
