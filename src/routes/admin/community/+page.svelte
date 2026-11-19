<!--
	Fleet console: Community (docs/COMMUNITY.md). Counts for the week, and the
	queue of reported notes and replies, oldest report first, each with its
	reports, the author's history and the actions. Remove, mute and ban ask for
	a passkey tap; everything is written to the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge, Button, Card, LargeTitle, ListGroup, ListRow, Notice, Skeleton, StatTile } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getCommunity, moderateContent, setCommunityStatus } from '#lib/admin/client.ts';
	import type { AdminCommunity, AdminContentAction, AdminReportItem, CommunityStatus } from '#lib/community/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminCommunity | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state<string | null>(null);
	let actionError = $state<{ key: string; message: string } | null>(null);
	let done = $state<string | null>(null);

	async function load() {
		error = null;
		try {
			data = await getCommunity();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	const keyOf = (it: AdminReportItem) => `${it.kind}:${it.id}`;
	const REASONS: Record<string, string> = { spam: 'Spam', harassment: 'Harassment', wrong: 'Wrong or misleading', sexual: 'Sexual content', other: 'Something else' };
	const DONE: Record<AdminContentAction, string> = { dismiss: 'Reports dismissed', hide: 'Hidden', remove: 'Removed', restore: 'Restored' };
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

	async function act(it: AdminReportItem, action: AdminContentAction) {
		const key = keyOf(it);
		busy = `${key}:${action}`;
		actionError = null;
		done = null;
		try {
			await moderateContent(it.kind, it.id, action);
			done = `${DONE[action]}: ${it.kind} by @${it.author.handle}`;
			await load();
		} catch (e) {
			actionError = { key, message: e instanceof Error ? e.message : String(e) };
		} finally {
			busy = null;
		}
	}

	async function author(it: AdminReportItem, status: CommunityStatus) {
		const key = keyOf(it);
		busy = `${key}:${status}`;
		actionError = null;
		done = null;
		try {
			await setCommunityStatus(it.author.accountId, status);
			done = status === 'active' ? `@${it.author.handle} can post again` : `@${it.author.handle} is ${status}`;
			await load();
		} catch (e) {
			actionError = { key, message: e instanceof Error ? e.message : String(e) };
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Community · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Community" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<Skeleton variant="card" count={1} label="Loading the community" />
		<Skeleton variant="row" count={3} />
	{:else}
		<div class="ui-stats">
			<StatTile label="Open reports" value={data.stats.openReports} tone={data.stats.openReports ? 'danger' : 'default'} />
			<StatTile label="Hidden now" value={data.stats.hidden} />
			<StatTile label="Notes this week" value={data.stats.posts7d} />
			<StatTile label="Replies this week" value={data.stats.replies7d} />
			<StatTile label="Handles" value={data.stats.profiles} />
		</div>

		{#if done}<Notice tone="success">{done}</Notice>{/if}

		<h2 class="eyebrow section">Reports to review</h2>
		{#if !data.queue.length}
			<ListGroup><ListRow subtitle="No open reports. When 3 people report a note or reply it is hidden until you look at it here." /></ListGroup>
		{/if}
		{#each data.queue as it (keyOf(it))}
			{@const key = keyOf(it)}
			<Card padding="md" class="report">
				<div class="row">
					<b>{it.kind === 'post' ? 'Note' : 'Reply'} by @{it.author.handle}</b>
					<span class="caption">on {it.label || it.subject}</span>
					{#if it.status !== 'published'}<Badge tone="warning">{it.status}</Badge>{/if}
					<span class="end"><Badge tone="danger">{it.openReports} {it.openReports === 1 ? 'report' : 'reports'}</Badge></span>
				</div>
				<p class="body">{it.body}</p>
				<ul class="reasons">
					{#each it.reports as r}
						<li><b>{REASONS[r.reason] ?? r.reason}</b>{#if r.detail}: {r.detail}{/if} <span class="caption">· {when(r.at)}</span></li>
					{/each}
				</ul>
				<p class="caption">
					Author: <a href="/admin/accounts/{it.author.accountId}">account #{it.author.accountId}</a> · {it.author.posts} posts and replies · {it.author.removed} removed
					{#if it.author.status !== 'active'} · <b>{it.author.status}</b>{/if}
					{#if it.author.disabled} · account closed{/if}
				</p>
				<div class="row actions">
					<Button size="sm" variant="ghost" busy={busy === `${key}:dismiss`} onclick={() => act(it, 'dismiss')}>Dismiss</Button>
					{#if it.status === 'published'}
						<Button size="sm" variant="ghost" busy={busy === `${key}:hide`} onclick={() => act(it, 'hide')}>Hide</Button>
					{:else}
						<Button size="sm" variant="ghost" busy={busy === `${key}:restore`} onclick={() => act(it, 'restore')}>Restore</Button>
					{/if}
					<Button size="sm" variant="ghost-danger" busy={busy === `${key}:remove`} onclick={() => act(it, 'remove')}>Remove</Button>
					{#if it.author.status === 'active'}
						<Button size="sm" variant="ghost" busy={busy === `${key}:muted`} onclick={() => author(it, 'muted')}>Mute author</Button>
						<Button size="sm" variant="ghost-danger" busy={busy === `${key}:banned`} onclick={() => author(it, 'banned')}>Ban author</Button>
					{:else}
						<Button size="sm" variant="ghost" busy={busy === `${key}:active`} onclick={() => author(it, 'active')}>Let them post again</Button>
					{/if}
				</div>
				{#if actionError?.key === key}<Notice tone="danger">{actionError.message}</Notice>{/if}
			</Card>
		{/each}
		<p class="caption">Dismiss puts back a note that reports hid. Remove, mute and ban ask for your passkey. Removed content is deleted after 90 days.</p>
	{/if}
</main>

<style>
	:global(.report) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.end {
		margin-left: auto;
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.reasons {
		margin: 0;
		padding-left: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
</style>
