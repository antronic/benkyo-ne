<!--
	Fleet console navigation (src/routes/admin/+layout.svelte). Wide screens:
	a fixed glass sidebar with every Fleet page, the current one marked. Phones
	and tablets: a menu pill at the bottom that names the current page and opens
	the same list in a sheet. Built from SideNav, MenuBar, Sheet and Card.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import { Button, Card, MenuBar, Sheet, SideNav } from '#lib/ui/index.ts';
	import { FLEET_EXIT, FLEET_NAV, FLEET_SIDEBAR_QUERY, fleetSection } from './nav.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	const sidebar = new MediaQuery(FLEET_SIDEBAR_QUERY);
	const section = $derived(fleetSection(page.url.pathname));
	let open = $state(false);

	// Lets admin.css give the page column room for the sidebar (--rail).
	$effect(() => {
		document.documentElement.classList.add('fleet-shell');
		return () => document.documentElement.classList.remove('fleet-shell');
	});
	// The "More below" button (kit ScrollMore) floats above the menu pill: 48px tall, 12px above the safe area.
	$effect(() => {
		if (sidebar.current) return;
		ui.scrollClear = 48 + 12;
		return () => (ui.scrollClear = 0);
	});
	// A page change (from the sheet, a crumb or a link) closes the menu.
	$effect(() => {
		void page.url.pathname;
		open = false;
	});
</script>

{#snippet brand()}
	<p class="brand"><b>Fleet</b><span class="caption">Benkyo admin</span></p>
{/snippet}
{#snippet exit()}
	<Button variant="link" href={FLEET_EXIT}>‹ Back to Benkyo</Button>
{/snippet}

{#if sidebar.current}
	<div class="fleet-sidebar">
		<Card as="aside" strong padding="sm" class="fleet-sidebar-card">
			<SideNav items={FLEET_NAV} current={section?.href ?? null} label="Fleet" header={brand} footer={exit} />
		</Card>
	</div>
{:else}
	<MenuBar current={section?.label ?? 'Fleet'} icon={section?.icon} label="Fleet menu" expanded={open} onmenu={() => (open = true)} />
	<Sheet {open} label="Fleet menu" onclose={() => (open = false)}>
		<SideNav items={FLEET_NAV} current={section?.href ?? null} label="Fleet" header={brand} footer={exit} onnavigate={() => (open = false)} />
	</Sheet>
{/if}

<style>
	.fleet-sidebar {
		position: fixed;
		z-index: 41;
		top: 0;
		bottom: 0;
		left: 0;
		width: var(--fleet-sidebar-w);
		padding: calc(var(--safe-top) + var(--space-4)) var(--space-3) calc(var(--safe-bottom) + var(--space-4)) max(var(--space-3), var(--safe-left));
		display: flex;
	}
	.fleet-sidebar :global(.fleet-sidebar-card) {
		flex: 1;
		overflow-y: auto;
		padding-top: var(--space-4);
		padding-bottom: var(--space-4);
	}
	.brand {
		margin: 0 0 var(--space-1);
		display: flex;
		flex-direction: column;
	}
	.brand b {
		font-size: var(--text-body);
	}
</style>
