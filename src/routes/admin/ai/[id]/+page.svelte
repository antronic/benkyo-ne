<!--
	Fleet console: every model one AI provider lists, straight from its API
	(cached for an hour; Refresh asks again). Prices come from the provider's
	list or Benkyo's built-in table.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { Badge, Button, ListGroup, ListRow, Segmented, StatTile, TextField } from '#lib/ui/index.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getProviderModels, getProviders } from '#lib/admin/client.ts';
	import type { AdminModels, AdminProvider } from '#lib/admin/contract.ts';
	import { contextLabel, priceLabel } from '#lib/admin/models.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	const id = $derived(Number(page.params.id));
	let provider = $state<AdminProvider | null>(null);
	let data = $state<AdminModels | null>(null);
	let error = $state<AdminError | null>(null);
	let loading = $state(false);
	let q = $state('');
	let filter = $state<'all' | 'vision' | 'priced' | 'packaged'>('all');
	const PAGE = 100;
	let shown = $state(PAGE);

	async function load(refresh = false) {
		loading = true;
		error = null;
		try {
			const [ps, ms] = await Promise.all([getProviders(), getProviderModels(id, refresh)]);
			provider = ps.providers.find((p) => p.id === id) ?? null;
			data = ms;
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(() => load());

	const list = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return (data?.models ?? []).filter(
			(m) =>
				(!needle || m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle)) &&
				(filter === 'all' ||
					(filter === 'vision' && m.vision) ||
					(filter === 'priced' && m.inputPerM !== null) ||
					(filter === 'packaged' && m.inPackages.length > 0))
		);
	});
	const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>{provider?.label ?? 'Models'} · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-2)">
	<FleetTrail detail={provider?.label} />
	<LargeTitle title={provider?.label ?? 'Models'} />

	{#if error}
		<ErrorCard {error} onretry={() => load(true)} />
	{:else if !data}
		<ListGroup><ListRow subtitle="Asking the provider for its models…" /></ListGroup>
	{:else}
		<div class="ui-stats">
			<StatTile label="Models listed" value={data.models.length} />
			<StatTile label="Read images" value={data.models.filter((m) => m.vision).length} />
			<StatTile label="With a price" value={data.models.filter((m) => m.inputPerM !== null).length} />
			<StatTile label="In a package" value={data.models.filter((m) => m.inPackages.length).length} />
		</div>

		<div class="stack" style:--gap="var(--space-2)" style:margin-top="var(--space-2)">
			<TextField id="model-search" type="search" bind:value={q} placeholder="Search models" aria-label="Search models" oninput={() => (shown = PAGE)} />
			<Segmented
				label="Show"
				bind:value={filter}
				onchange={() => (shown = PAGE)}
				options={[
					{ value: 'all', label: 'All' },
					{ value: 'vision', label: 'Images' },
					{ value: 'priced', label: 'Priced' },
					{ value: 'packaged', label: 'In packages' }
				]}
			/>
		</div>

		<ListGroup>
			{#each list.slice(0, shown) as m (m.id)}
				<ListRow title={m.label} subtitle={[contextLabel(m.contextTokens), priceLabel(m)].filter(Boolean).join(' · ')}>
					{#if m.label !== m.id}<span class="model-id">{m.id}</span>{/if}
					{#if m.vision || m.inPackages.length}
						<span class="chips" style:margin-top="var(--space-1)">
							{#if m.vision}<Badge>Images</Badge>{/if}
							{#each m.inPackages as name (name)}<Badge tone="success">{name}</Badge>{/each}
						</span>
					{/if}
				</ListRow>
			{:else}
				<ListRow subtitle={data.models.length ? 'No model matches.' : 'The provider listed no models for this key.'} />
			{/each}
			{#if list.length > shown}
				<ListRow tone="link" title="Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}" onclick={() => (shown += PAGE)} />
			{/if}
		</ListGroup>

		<p class="caption foot">
			From {provider?.label ?? 'the provider'}’s API at {time(data.fetchedAt)}, kept for an hour.
			Add models to a package on <a href="/admin/packages">Packages</a>.
		</p>
		<span class="row" style:justify-content="center"><Button variant="ghost" size="sm" onclick={() => load(true)} busy={loading}>Ask again</Button></span>
	{/if}
</main>
