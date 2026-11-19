<!-- Fleet console: accounts list with search and paging. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, listAccounts } from '#lib/admin/client.ts';
	import type { AdminAccountRow } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let rows = $state<AdminAccountRow[]>([]);
	let next = $state<number | null>(null);
	let q = $state('');
	let loading = $state(true);
	let error = $state<AdminError | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function load(more = false) {
		loading = true;
		error = null;
		try {
			const r = await listAccounts(q, more ? (next ?? 0) : 0);
			rows = more ? [...rows, ...r.accounts] : r.accounts;
			next = r.next;
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(() => load());

	function search() {
		clearTimeout(timer);
		timer = setTimeout(() => load(), 250);
	}

	const ago = (t: number | null) => {
		if (!t) return 'never';
		const m = Math.round((Date.now() - t) / 60000);
		if (m < 60) return `${Math.max(1, m)} min ago`;
		const h = Math.round(m / 60);
		if (h < 48) return `${h} h ago`;
		return `${Math.round(h / 24)} days ago`;
	};
	const usd = (n: number) => `$${n.toFixed(2)}`;
</script>

<svelte:head><title>Accounts · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<LargeTitle title="Accounts" />

	<input type="search" placeholder="Search by name or #id" bind:value={q} oninput={search} aria-label="Search accounts" />

	{#if error}
		<ErrorCard {error} onretry={() => load()} />
	{:else if loading && !rows.length}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else if !rows.length}
		<div class="glass group"><div class="item caption">No accounts match.</div></div>
	{:else}
		<div class="glass group">
			{#each rows as a (a.id)}
				<a class="item" href="/admin/accounts/{a.id}">
					<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
						<b class="name">{a.name} <span class="caption">#{a.id}</span></b>
						<span class="caption">
							Seen {ago(a.lastSeenAt)} · {usd(a.monthUsd)} of {usd(a.capUsd)} this month
						</span>
					</span>
					<span class="spacer"></span>
					{#if a.plan !== 'free'}<span class="pill">{a.plan === 'pro' ? 'Pro' : 'Plus'}</span>{/if}
					{#if a.isAdmin}<span class="pill muted">Admin</span>{/if}
					{#if a.disabled}<span class="pill off">Disabled</span>{:else if !a.consented}<span class="pill muted">No consent</span>{/if}
					<span class="caption" aria-hidden="true">›</span>
				</a>
			{/each}
		</div>
		{#if next !== null}
			<button class="btn ghost" onclick={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Show more'}</button>
		{/if}
	{/if}
</main>

<style>
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
