<!--
	Fleet console: one error the app caught (docs/DEBUGGING.md): what failed, where, the steps
	before it (breadcrumbs), the stack, the device and the learner's note. Read-only.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button, Card, LargeTitle, ListGroup, ListRow, SectionHeader, Skeleton } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, getErrorDetail } from '#lib/admin/client.ts';
	import type { AdminErrorDetail } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	const id = $derived(Number(page.params.id));
	let d = $state<AdminErrorDetail | null>(null);
	let error = $state<AdminError | null>(null);

	async function load() {
		error = null;
		try {
			d = await getErrorDetail(id);
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(() => void load());

	const title = $derived(d ? (d.event.errorId ?? `Error #${d.event.id}`) : 'Error');
	const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	function buildLabel(b: string | null) {
		if (!b) return 'unknown';
		const n = Number(b);
		return n > 1e12 ? `${b} (${when(n)})` : b;
	}
	const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
	const KINDS: Record<string, string> = { nav: 'Screen', api: 'API', console: 'Console', error: 'Error', note: 'Note' };

	/** A few device facts worth reading first; the rest stays in the raw list. */
	const DEVICE_KEYS = ['userAgent', 'uaPlatform', 'platform', 'displayMode', 'viewport', 'screen', 'pixelRatio', 'languages', 'timeZone', 'online', 'serviceWorker', 'colorScheme', 'storage'];

	async function copy() {
		if (!d) return;
		const e = d.event;
		const text = [
			`Error: ${e.errorId ?? `#${e.id}`}`,
			`When: ${new Date(e.at).toISOString()}`,
			`Build: ${e.build ?? 'unknown'}`,
			`Screen: ${e.route ?? ''}`,
			`Message: ${e.name}: ${e.message}`,
			e.status ? `Status: ${e.status}` : '',
			e.requestId ? `Request: ${e.requestId}` : '',
			`Account: #${e.accountId}`,
			'',
			d.stack ?? '',
			'',
			...d.breadcrumbs.map((c) => `${new Date(c.at).toISOString().slice(11, 23)} ${c.kind} ${c.text}`)
		]
			.filter((l, i, a) => l || a[i - 1])
			.join('\n');
		try {
			await navigator.clipboard.writeText(text);
			toast('Copied the details', '✓');
		} catch {
			toast('Couldn’t copy. Select the text instead.', '⚠️');
		}
	}
</script>

<svelte:head><title>{title} · Errors · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail detail={d ? title : null} />
	<LargeTitle {title} />

	{#if error}
		<ErrorCard {error} onretry={() => load()} />
	{:else if !d}
		<Skeleton variant="card" label="Loading the error" />
		<Skeleton variant="row" count={4} label="Loading the error" />
	{:else}
		{@const e = d.event}
		<Card padding="lg">
			<div class="what">
				<b class="msg">{e.message || '(no message)'}</b>
				<span class="caption">{e.name}{d.type ? ` · ${d.type}` : ''}{e.status ? ` · HTTP ${e.status}` : ''}</span>
				<div class="row actions" style:--gap="var(--space-2)">
					<Button size="sm" variant="ghost" onclick={copy}>Copy details</Button>
					<Button size="sm" variant="ghost" href="/admin/accounts/{e.accountId}">Open account</Button>
				</div>
			</div>
		</Card>

		<ListGroup>
			<ListRow title="When">{#snippet trailing()}<span class="caption">{when(e.at)}</span>{/snippet}</ListRow>
			<ListRow title="Screen">{#snippet trailing()}<span class="caption val">{e.route ?? '—'}</span>{/snippet}</ListRow>
			<ListRow title="Build">{#snippet trailing()}<span class="caption val">{buildLabel(e.build)}</span>{/snippet}</ListRow>
			<ListRow title="Account">{#snippet trailing()}<span class="caption val">{e.accountName ?? 'deleted account'} #{e.accountId}</span>{/snippet}</ListRow>
			{#if e.requestId}
				<ListRow title="Request id" subtitle="Search Workers Logs for it to see the server side">
					{#snippet trailing()}<code>{e.requestId}</code>{/snippet}
				</ListRow>
			{/if}
			{#if e.country}<ListRow title="Country">{#snippet trailing()}<span class="caption">{e.country}</span>{/snippet}</ListRow>{/if}
		</ListGroup>

		{#if d.notes.length}
			<SectionHeader title="The learner’s note" />
			<ListGroup>
				{#each d.notes as n (n.at)}<ListRow title={n.note} subtitle={when(n.at)} />{/each}
			</ListGroup>
		{/if}

		<SectionHeader title="Steps before it" />
		{#if d.breadcrumbs.length}
			<ListGroup>
				{#each d.breadcrumbs as c, i (i)}
					<ListRow>
						<span class="crumb"><span class="caption t">{clock(c.at)}</span> <b>{KINDS[c.kind] ?? c.kind}</b> <span class="txt">{c.text}</span></span>
					</ListRow>
				{/each}
			</ListGroup>
		{:else}
			<ListGroup><ListRow subtitle="No steps recorded. Builds before error ids didn’t send them." /></ListGroup>
		{/if}

		<SectionHeader title="Stack" />
		{#if d.stack}
			<Card padding="md"><pre>{d.stack}</pre></Card>
		{:else}
			<ListGroup><ListRow subtitle="No stack for this error." /></ListGroup>
		{/if}

		{#if Object.keys(d.extra).length}
			<SectionHeader title="More from the app" />
			<ListGroup>
				{#each Object.entries(d.extra) as [k, v] (k)}
					<ListRow title={k}>{#snippet trailing()}<span class="caption val">{fmt(v)}</span>{/snippet}</ListRow>
				{/each}
			</ListGroup>
		{/if}

		<SectionHeader title="Device" />
		{#if d.device}
			<ListGroup>
				{#each DEVICE_KEYS.filter((k) => d!.device![k] !== undefined) as k (k)}
					<ListRow title={k}>{#snippet trailing()}<span class="caption val">{fmt(d!.device![k])}</span>{/snippet}</ListRow>
				{/each}
			</ListGroup>
		{:else}
			<ListGroup><ListRow subtitle="The app sent no device snapshot for this launch." /></ListGroup>
		{/if}
	{/if}
</main>

<style>
	.what {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.msg {
		font-size: 1.0625rem;
		overflow-wrap: anywhere;
	}
	.actions {
		margin-top: var(--space-2);
		flex-wrap: wrap;
	}
	.val {
		overflow-wrap: anywhere;
		text-align: end;
		max-width: 60vw;
	}
	.crumb {
		display: block;
		overflow-wrap: anywhere;
	}
	.t {
		font-variant-numeric: tabular-nums;
	}
	pre {
		margin: 0;
		font-size: var(--text-caption);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	code {
		font-size: var(--text-caption);
	}
</style>
