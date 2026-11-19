<!--
	Fleet console: overview. Admin only, behind Cloudflare Access
	(worker/admin/routes.ts). Online only; nothing here is cached.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Card, Columns, LargeTitle, ListGroup, ListRow, SectionHeader, Skeleton } from '#lib/ui/index.ts';
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
		<Skeleton variant="tile" count={4} label="Loading the fleet overview" />
	{:else}
		<Columns min="380px">
			<section>
				<SectionHeader title="Accounts" />
				<div class="tiles rise" style:--i="1">
					<Card class="tile"><span class="caption">Total</span><b class="num">{data.accounts.total}</b></Card>
					<Card class="tile"><span class="caption">Active, 7 days</span><b class="num">{data.accounts.active7d}</b></Card>
					<Card class="tile">
						<span class="caption">New, 7 days</span><b class="num">{data.accounts.new7d}</b>
						<span class="caption">{data.accounts.new24h} in 24 h</span>
					</Card>
					<Card class="tile"><span class="caption">Disabled</span><b class="num">{data.accounts.disabled}</b></Card>
				</div>
				<ListGroup>
					<ListRow title="All accounts" href="/admin/accounts" />
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="AI this month" />
				<div class="tiles rise" style:--i="2">
					<Card class="tile"><span class="caption">Spend</span><b class="num">{usd(data.ai.monthUsd)}</b></Card>
					<Card class="tile"><span class="caption">Calls</span><b class="num">{data.ai.monthCalls}</b></Card>
					<Card class={data.ai.failed24h > 0 ? 'tile warn' : 'tile'}>
						<span class="caption">Failed, 24 h</span><b class="num">{data.ai.failed24h}</b>
					</Card>
				</div>
				<ListGroup>
					<ListRow title="Usage and spend" href="/admin/usage" />
				</ListGroup>
			</section>
		</Columns>

		<SectionHeader title="Platform" />
		<div class="rise" style:--i="3">
			<ListGroup>
				<ListRow title="Sign-ups">
					{#snippet trailing()}
						<span class="pill" class:off={data!.signupMode !== 'open'}>{data!.signupMode === 'open' ? 'Open' : data!.signupMode === 'invite' ? 'Invite only' : 'Closed'}</span>
					{/snippet}
				</ListRow>
				<ListRow title="Sign-ups, invites and sessions" href="/admin/settings" />
				<ListRow title="Devices on a sync key">
					{#snippet trailing()}<b class="num">{data!.syncDevices}</b>{/snippet}
				</ListRow>
				<ListRow title="AI providers and models" href="/admin/ai" />
				<ListRow title="Packages" href="/admin/packages" />
				<ListRow title="Promo codes" href="/admin/promos" />
				<ListRow title="System and health" href="/admin/system" />
				<ListRow title="Audit log" href="/admin/audit" />
			</ListGroup>
		</div>

		<p class="caption foot">
			Updated {time(data.at)} ·
			<Button variant="link" onclick={load} busy={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
		</p>
	{/if}
</main>
