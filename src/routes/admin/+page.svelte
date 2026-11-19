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
	import '#lib/admin/admin.css';

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

<main class="page stack fleet" style:--gap="var(--space-3)">
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
		<div class="glass group">
			<a class="item nav" href="/admin/usage"><span>Usage and spend</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
		</div>

		<h2 class="eyebrow section">Platform</h2>
		<div class="glass group rise" style:--i="3">
			<div class="item">
				<span>Sign-ups</span><span class="spacer"></span>
				<span class="pill" class:off={data.signupMode !== 'open'}>{data.signupMode === 'open' ? 'Open' : data.signupMode === 'invite' ? 'Invite only' : 'Closed'}</span>
			</div>
			<a class="item nav" href="/admin/settings"><span>Sign-ups, invites and sessions</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
			<div class="item"><span>Devices on a sync key</span><span class="spacer"></span><b>{data.syncDevices}</b></div>
			<a class="item nav" href="/admin/packages"><span>Packages</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
			<a class="item nav" href="/admin/system"><span>System and health</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
			<a class="item nav" href="/admin/audit"><span>Audit log</span><span class="spacer"></span><span class="caption" aria-hidden="true">›</span></a>
		</div>

		<p class="caption foot">
			Updated {time(data.at)} ·
			<button class="link" onclick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
		</p>
	{/if}
</main>

<style>
	.placeholder {
		opacity: 0.5;
	}
</style>
