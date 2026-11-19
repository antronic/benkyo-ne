<!--
	Wide-screen layout: puts its children side by side when there is room
	(each at least `min` wide) and stacks them on phones. Each child is a
	column; wrap a SectionHeader and its list in a <section> to keep them
	together. Used by Fleet to fill a desktop screen.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { min = '340px', children, class: cls = '' }: { min?: string; children: Snippet; class?: string } = $props();
</script>

<div class="ui-columns {cls}" style:--col-min={min}>{@render children()}</div>

<style>
	.ui-columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(var(--col-min), 100%), 1fr));
		gap: var(--space-5) var(--space-6);
		align-items: start;
		min-width: 0;
	}
	.ui-columns > :global(*) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	/* A child with class="span-all" takes the whole row. */
	.ui-columns > :global(.span-all) {
		grid-column: 1 / -1;
	}
</style>
