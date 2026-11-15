<!-- Grouped list on a glass surface. Put <ListRow>s inside; rows get hairline separators. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, class: cls = '' }: { children: Snippet; class?: string } = $props();
</script>

<div class="glass list {cls}">
	{@render children()}
</div>

<style>
	.list {
		padding: var(--space-1) 0;
		border-radius: var(--radius-card);
		overflow: hidden;
	}
</style>
