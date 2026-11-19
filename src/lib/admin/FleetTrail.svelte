<!-- Breadcrumbs for a Fleet page, from the nav (nav.ts). `detail` names a detail page. -->
<script lang="ts">
	import { page } from '$app/state';
	import { Breadcrumbs } from '#lib/ui/index.ts';
	import { fleetTrail } from './nav.ts';

	let { detail }: { detail?: string | null } = $props();
	const items = $derived(fleetTrail(page.url.pathname, detail));
</script>

{#if items.length}<Breadcrumbs {items} label="Fleet breadcrumb" />{/if}
