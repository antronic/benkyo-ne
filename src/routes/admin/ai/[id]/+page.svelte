<!--
	Fleet console: every model one AI provider lists, straight from its API
	(cached for an hour; Refresh asks again). Prices come from the provider's
	list or Benkyo's built-in table.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getProviderModels, getProviders } from '#lib/admin/client.ts';
	import type { AdminModels, AdminProvider } from '#lib/admin/contract.ts';
	import { contextLabel, priceLabel } from '#lib/admin/models.ts';
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

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title={provider?.label ?? 'Models'} />

	{#if error}
		<ErrorCard {error} onretry={() => load(true)} />
	{:else if !data}
		<div class="glass group" aria-busy="true"><div class="item caption">Asking the provider for its models…</div></div>
	{:else}
		<div class="tiles">
			<div class="glass tile"><span class="caption">Models listed</span><b class="num">{data.models.length}</b></div>
			<div class="glass tile"><span class="caption">Read images</span><b class="num">{data.models.filter((m) => m.vision).length}</b></div>
			<div class="glass tile"><span class="caption">With a price</span><b class="num">{data.models.filter((m) => m.inputPerM !== null).length}</b></div>
			<div class="glass tile"><span class="caption">In a package</span><b class="num">{data.models.filter((m) => m.inPackages.length).length}</b></div>
		</div>

		<div class="row" style:gap="8px" style:flex-wrap="wrap" style:margin-top="8px">
			<input type="search" bind:value={q} placeholder="Search models" aria-label="Search models" style:flex="1" style:min-width="180px" oninput={() => (shown = PAGE)} />
			<div class="segmented" role="group" aria-label="Show">
				{#each [['all', 'All'], ['vision', 'Images'], ['priced', 'Priced'], ['packaged', 'In packages']] as [k, l] (k)}
					<button aria-pressed={filter === k} onclick={() => ((filter = k as typeof filter), (shown = PAGE))}>{l}</button>
				{/each}
			</div>
		</div>

		<div class="glass group">
			{#each list.slice(0, shown) as m (m.id)}
				<div class="item">
					<span class="stack" style:--gap="2px" style:min-width="0" style:flex="1">
						<span class="row" style:gap="6px" style:flex-wrap="wrap">
							<b class="ellipsis">{m.label}</b>
							{#if m.vision}<span class="pill muted">Images</span>{/if}
							{#each m.inPackages as name (name)}<span class="pill">{name}</span>{/each}
						</span>
						{#if m.label !== m.id}<span class="model-id">{m.id}</span>{/if}
						<span class="caption">{[contextLabel(m.contextTokens), priceLabel(m)].filter(Boolean).join(' · ')}</span>
					</span>
				</div>
			{:else}
				<div class="item caption">{data.models.length ? 'No model matches.' : 'The provider listed no models for this key.'}</div>
			{/each}
			{#if list.length > shown}
				<button class="item link" onclick={() => (shown += PAGE)}>Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}</button>
			{/if}
		</div>

		<p class="caption foot">
			From {provider?.label ?? 'the provider'}’s API at {time(data.fetchedAt)}, kept for an hour ·
			<button class="link" onclick={() => load(true)} disabled={loading}>{loading ? 'Asking…' : 'Refresh'}</button>
			· Add models to a package on <a href="/admin/packages">Packages</a>.
		</p>
	{/if}
</main>
