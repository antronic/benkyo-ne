<!--
	Round glass icon button. `label` is required: it is the accessible name.
	Sizes: sm 36px, md 40px, lg 50px. Beside a full-size Button (50px) use lg, so the row has one height.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & { label: string; size?: 'sm' | 'md' | 'lg'; children: Snippet };
	let { label, size = 'md', children, class: cls = '', ...rest }: Props = $props();
</script>

<button type="button" class="icon-btn {cls}" class:sm={size === 'sm'} class:lg={size === 'lg'} aria-label={label} title={label} {...rest}>
	{@render children()}
</button>

<style>
	.lg {
		width: var(--control-lg);
		height: var(--control-lg);
		font-size: 1.25em;
	}
	.sm {
		width: var(--control-sm);
		height: var(--control-sm);
	}
</style>
