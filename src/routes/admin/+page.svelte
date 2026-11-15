<!--
	Fleet console: overview. Admin only, behind Cloudflare Access
	(worker/admin/routes.ts). Online only; nothing here is cached.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, overview } from '#lib/admin/client.ts';
	import type { AdminOverview } from '#lib/admin/contract.ts';

	ui.hue = 200;
	let data = $state<AdminOverview | null>(null);
	let error = $state<AdminError | null>(null);
	let loading = $state(true);

	async function load() {
		loading = true;
		error = null;
		try {
			data = await overview();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(load);

	const usd = (n: number) => `$${n.toFixed(n < 100 ? 2 : 0)}`;
	const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>Fleet · Benkyo</title></svelte:head>

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title="Fleet" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<div class="tiles" aria-busy="true">
			{#each [0, 1, 2, 3] as i (i)}<div class="glass tile placeholder"></div>{/each}
		</div>
	{:else}
		<h2 class="eyebrow section">Accounts</h2>
		<div class="tiles rise" style:--i="1">
			<div class="glass tile"><span class="caption">Total</span><b class="num">{data.accounts.total}</b></div>
			<div class="glass tile"><span class="caption">Active, 7 days</span><b class="num">{data.accounts.active7d}</b></div>
			<div class="glass tile">
				<span class="caption">New, 7 days</span><b class="num">{data.accounts.new7d}</b>
				<span class="caption">{data.accounts.new24h} in the last 24 h</span>
			</div>
			<div class="glass tile"><span class="caption">Disabled</span><b class="num">{data.accounts.disabled}</b></div>
		</div>
		<div class="glass group">
			<a class="item nav" href="/admin/accounts"><span>All accounts</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
		</div>

		<h2 class="eyebrow section">AI this month</h2>
		<div class="tiles rise" style:--i="2">
			<div class="glass tile"><span class="caption">Spend</span><b class="num">{usd(data.ai.monthUsd)}</b></div>
			<div class="glass tile"><span class="caption">Calls</span><b class="num">{data.ai.monthCalls}</b></div>
			<div class="glass tile" class:warn={data.ai.failed24h > 0}>
				<span class="caption">Failed, 24 h</span><b class="num">{data.ai.failed24h}</b>
			</div>
		</div>

		<h2 class="eyebrow section">Platform</h2>
		<div class="glass group rise" style:--i="3">
			<div class="item">
				<span>Sign-ups</span><span class="spacer"></span>
				<span class="pill" class:closed={data.signupMode !== 'open'}>{data.signupMode === 'open' ? 'Open' : data.signupMode === 'invite' ? 'Invite only' : 'Closed'}</span>
			</div>
			<a class="item nav" href="/admin/settings"><span>Sign-ups, invites and sessions</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
			<div class="item"><span>Devices on a sync key</span><span class="spacer"></span><b>{data.syncDevices}</b></div>
		</div>

		<p class="caption foot">
			Updated {time(data.at)} ·
			<button class="link" onclick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
		</p>
	{/if}
</main>

<style>
	@media (min-width: 600px) {
		.fleet > :global(*) {
			max-width: 820px;
		}
	}
	.section {
		margin: 16px 6px 2px;
	}
	.group {
		padding: 4px 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		min-height: 48px;
	}
	a.nav {
		color: inherit;
		text-decoration: none;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border-radius: var(--r-m);
		min-height: 88px;
	}
	.placeholder {
		opacity: 0.5;
	}
	.tile.warn .num {
		color: var(--danger);
	}
	.num {
		font-size: 28px;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}
	.pill {
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 13px;
		background: color-mix(in srgb, var(--success) 22%, transparent);
	}
	.pill.closed {
		background: color-mix(in srgb, var(--danger) 22%, transparent);
	}
	.foot {
		text-align: center;
		margin-top: 12px;
	}
	.link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}
</style>
