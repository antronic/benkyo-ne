<!-- Fleet console: every admin action, newest first. Read-only. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, LargeTitle, ListGroup, ListRow, Select, Skeleton, Spinner } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { AdminError, getAudit } from '#lib/admin/client.ts';
	import type { AdminAuditEntry } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let rows = $state<AdminAuditEntry[]>([]);
	let actions = $state<string[]>([]);
	let next = $state<number | null>(null);
	let action = $state('');
	let loading = $state(true);
	/** true while "Show more" fetches the next page (the list stays; the button spins) */
	let more = $state(false);
	let error = $state<AdminError | null>(null);

	async function load(nextPage = false) {
		loading = true;
		more = nextPage;
		error = null;
		try {
			const r = await getAudit(nextPage ? (next ?? 0) : 0, action);
			rows = nextPage ? [...rows, ...r.entries] : r.entries;
			next = r.next;
			actions = r.actions;
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		} finally {
			loading = false;
		}
	}
	onMount(() => load());

	/** Plain-English names for the actions the console writes. */
	const LABELS: Record<string, string> = {
		'account.disable': 'Disabled an account',
		'account.enable': 'Enabled an account',
		'account.cap': 'Changed a spend cap',
		'account.revoke_sessions': 'Signed an account out everywhere',
		'account.delete': 'Deleted an account',
		'signup.mode': 'Switched sign-ups',
		'session.lifetime': 'Changed the session lifetime',
		'invite.create': 'Created an invite',
		'invite.revoke': 'Revoked an invite',
		'package.update': 'Changed a package',
		'package.grant': 'Granted a package',
		'package.end': 'Ended a package early'
	};
	const label = (a: string) => LABELS[a] ?? a;
	const actionOptions = $derived([{ value: '', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: label(a) }))]);
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

	/** Short one-line summary of the detail object. */
	function summary(d: unknown): string {
		if (d === null || d === undefined) return '';
		if (typeof d !== 'object') return String(d);
		const o = d as Record<string, unknown>;
		if ('from' in o && 'to' in o) return `${fmt(o.from)} → ${fmt(o.to)}`;
		return Object.entries(o)
			.filter(([, v]) => v !== null && v !== undefined)
			.map(([k, v]) => `${k}: ${fmt(v)}`)
			.join(' · ');
	}
	function fmt(v: unknown): string {
		if (v === null || v === undefined) return 'default';
		if (typeof v === 'number' && v > 1e12) return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
		return typeof v === 'object' ? JSON.stringify(v) : String(v);
	}
</script>

<svelte:head><title>Audit log · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<LargeTitle title="Audit log" />

	{#if actions.length > 1}
		<div class="filter">
			<Select options={actionOptions} bind:value={action} onchange={() => load()} label="Show one kind of action" disabled={loading} />
			{#if loading && !more && rows.length}<Spinner label="Loading" size="sm" />{/if}
		</div>
	{/if}

	{#if error}
		<ErrorCard {error} onretry={() => load()} />
	{:else if loading && !rows.length}
		<Skeleton variant="row" count={4} label="Loading the audit log" />
	{:else if !rows.length}
		<ListGroup><ListRow subtitle="Nothing logged yet. Every change you make in the console shows up here." /></ListGroup>
	{:else}
		<ListGroup>
			<ol>
				{#each rows as r (r.id)}
					<li class="item col">
						<span class="row" style:gap="var(--space-2)">
							<b>{label(r.action)}</b><span class="spacer"></span><span class="caption">{when(r.at)}</span>
						</span>
						{#if r.targetId !== null}
							<span class="caption">
								<a href="/admin/accounts/{r.targetId}">{r.targetName ?? 'deleted account'} #{r.targetId}</a>
							</span>
						{/if}
						{#if summary(r.detail)}<span class="caption detail">{summary(r.detail)}</span>{/if}
						<span class="caption">by {r.actorName ?? `#${r.actorId}`}{r.actorEmail ? ` (${r.actorEmail})` : ''}</span>
					</li>
				{/each}
			</ol>
		</ListGroup>
		{#if next !== null}
			<Button variant="ghost" onclick={() => load(true)} busy={loading && more} disabled={loading}>{loading && more ? 'Loading…' : 'Show more'}</Button>
		{/if}
	{/if}
</main>

<style>
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.detail {
		overflow-wrap: anywhere;
	}
	.filter {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		align-self: flex-start;
	}
</style>
