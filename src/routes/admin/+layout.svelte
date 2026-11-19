<!-- Fleet console shell: navigation around every /admin page (src/lib/admin/FleetNav.svelte). -->
<script lang="ts">
	import FleetNav from '#lib/admin/FleetNav.svelte';
	import '#lib/admin/admin.css';

	let { children } = $props();
</script>

<FleetNav />
{@render children()}
