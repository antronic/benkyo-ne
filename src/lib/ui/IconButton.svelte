<!-- Round glass icon button. `label` is required: it is the accessible name. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & { label: string; size?: 'sm' | 'md'; children: Snippet };
	let { label, size = 'md', children, class: cls = '', ...rest }: Props = $props();
</script>

<button type="button" class="icon-btn {cls}" class:sm={size === 'sm'} aria-label={label} title={label} {...rest}>
	{@render children()}
</button>

<style>
	.sm {
		width: var(--control-sm);
		height: var(--control-sm);
	}
</style>
