<!--
	Fleet console: errors the app caught (docs/DEBUGGING.md). Grouped by message, then each
	occurrence, newest first. Search finds an error id a learner sends ("E-7F3K2Q"). Read-only.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, DataTable, FieldRow, LargeTitle, ListGroup, ListRow, Notice, SectionHeader, Segmented, Select, Skeleton, Spinner, TextField, type DataColumn } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getErrors } from '#lib/admin/client.ts';
	import type { AdminErrorGroup, AdminErrors, ErrorWindow } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminErrors | null>(null);
	let days = $state<`${ErrorWindow}`>('7');
	let q = $state('');
	let build = $state('');
	let loading = $state(true);
	/** true while "Show more" fetches the next page (the list stays; the button spins) */
	let more = $state(false);
	let error = $state<AdminError | null>(null);

	async function load(nextPage = false) {
		loading = true;
		more = nextPage;
		error = null;
		try {
			const r = await getErrors(Number(days) as ErrorWindow, q.trim(), build, nextPage ? (data?.next ?? 0) : 0);
			data = nextPage && data ? { ...r, events: [...data.events, ...r.events] } : r;
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		// /admin/errors?q=E-7F3K2Q opens straight to one error id
		q = new URL(location.href).searchParams.get('q') ?? '';
		void load();
	});

	const DAY_OPTIONS: { value: `${ErrorWindow}`; label: string }[] = [
		{ value: '1', label: 'Last day' },
		{ value: '7', label: '7 days' },
		{ value: '30', label: '30 days' }
	];
	const buildOptions = $derived([{ value: '', label: 'All builds' }, ...(data?.builds ?? []).map((b) => ({ value: b, label: buildLabel(b) }))]);

	/** Build numbers are build times (ms); show them as a time with the number. */
	function buildLabel(b: string | null) {
		if (!b) return 'unknown build';
		const n = Number(b);
		return n > 1e12 ? `${b} · ${new Date(n).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : b;
	}
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

	/** Plain names for where an error was caught (src/lib/debug/errors.svelte.ts). */
	const SOURCES: Record<string, string> = {
		kit: 'Page failed',
		screen_crash: 'Screen crashed',
		window_error: 'Script error',
		unhandled_rejection: 'Unhandled promise',
		api_error: 'Server error',
		boot_storage: 'Storage at start-up'
	};
	const source = (name: string) => SOURCES[name] ?? name;

	function showGroup(g: AdminErrorGroup) {
		q = g.message || g.name;
		void load();
	}
	function clearSearch() {
		q = '';
		build = '';
		void load();
	}

	const GROUP_COLUMNS: DataColumn[] = [
		{ key: 'error', label: 'Error', width: '46%' },
		{ key: 'count', label: 'Times', align: 'end' },
		{ key: 'accounts', label: 'Accounts', align: 'end' },
		{ key: 'last', label: 'Last seen', align: 'end' }
	];
	const EVENT_COLUMNS: DataColumn[] = [
		{ key: 'id', label: 'Error id' },
		{ key: 'error', label: 'Error', width: '40%' },
		{ key: 'account', label: 'Account' },
		{ key: 'at', label: 'When', align: 'end' }
	];
</script>

<svelte:head><title>Errors · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Errors" />

	<div class="filters">
		<Segmented options={DAY_OPTIONS} bind:value={days} label="Time window" onchange={() => load()} />
		<FieldRow as="form" stack="narrow" onsubmit={() => load()}>
			<TextField bind:value={q} grow label="Search" placeholder="Error id, message, screen or request id" enterkeyhint="search" />
			<Button type="submit" variant="ghost" busy={loading && !more}>Search</Button>
		</FieldRow>
		{#if (data?.builds.length ?? 0) > 1 || build}
			<Select options={buildOptions} bind:value={build} onchange={() => load()} label="Build" disabled={loading} />
		{/if}
	</div>

	{#if error}
		<ErrorCard {error} onretry={() => load()} />
	{:else if !data}
		<Skeleton variant="row" count={5} label="Loading errors" />
	{:else if !data.total}
		<ListGroup>
			<ListRow
				title={q || build ? 'No errors match' : 'No errors in this window'}
				subtitle={q || build
					? 'Nothing matches that search. An error id looks like E-7F3K2Q.'
					: 'Errors show up here from accounts that agreed to share beta data. Everyone else keeps them on their device, in Settings → Debugging.'}
			>
				{#snippet trailing()}{#if q || build}<Button size="sm" variant="ghost" onclick={clearSearch}>Clear</Button>{/if}{/snippet}
			</ListRow>
		</ListGroup>
	{:else}
		{#if q || build}
			<Notice title="{data.total} matching">
				{q ? `“${q}”` : ''}{q && build ? ' · ' : ''}{build ? buildLabel(build) : ''}
				{#snippet action()}<Button size="sm" variant="ghost" onclick={clearSearch}>Clear</Button>{/snippet}
			</Notice>
		{/if}

		<SectionHeader title="Most frequent" />
		<DataTable columns={GROUP_COLUMNS} rows={data.groups} key={(g) => `${g.name}\u0000${g.message}`} label="Errors grouped by message">
			{#snippet cell(g, c)}
				{#if c.key === 'error'}
					<span class="err"><b>{source(g.name)}</b> <span class="caption msg">{g.message || '(no message)'}</span></span>
					<Button size="sm" variant="ghost" onclick={() => showGroup(g)}>Show these</Button>
				{:else if c.key === 'count'}<span class="num">{g.count}</span>
				{:else if c.key === 'accounts'}<span class="num">{g.accounts}</span>
				{:else}<span class="caption">{when(g.lastAt)}</span>{/if}
			{/snippet}
		</DataTable>

		<SectionHeader title="Every occurrence" />
		<DataTable columns={EVENT_COLUMNS} rows={data.events} key={(e) => e.id} label="Error occurrences" href={(e) => `/admin/errors/${e.id}`}>
			{#snippet cell(e, c)}
				{#if c.key === 'id'}<code>{e.errorId ?? `#${e.id}`}</code>
				{:else if c.key === 'error'}
					<span class="err"><b>{source(e.name)}{e.status ? ` ${e.status}` : ''}</b> <span class="caption msg">{e.message}</span></span>
					<span class="caption">{e.route ?? ''}{e.hasNote ? ' · has a note' : ''}</span>
				{:else if c.key === 'account'}<span class="caption">{e.accountName ?? 'deleted account'} #{e.accountId}</span>
				{:else}<span class="caption">{when(e.at)}</span>{/if}
			{/snippet}
		</DataTable>
		{#if data.next !== null}
			<Button variant="ghost" onclick={() => load(true)} busy={loading && more} disabled={loading}>{loading && more ? 'Loading…' : 'Show more'}</Button>
		{:else if loading}
			<Spinner size="sm" label="Loading" />
		{/if}
	{/if}
</main>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-2) var(--space-3);
	}
	.err {
		display: block;
		overflow-wrap: anywhere;
	}
	.msg {
		display: block;
	}
	code {
		font-size: var(--text-caption);
		white-space: nowrap;
	}
</style>
