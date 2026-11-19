<!--
	Fleet console: Free / Plus / Pro. Edit prices and the monthly AI allowance,
	and see who has a package. Grants are made on each account's page.
	Saving asks for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, LargeTitle, ListGroup, ListRow, SectionHeader, Skeleton, Switch, TextField } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, getPackages, updatePackage } from '#lib/admin/client.ts';
	import type { AdminPackages, AdminPlan, AdminPlanPatch } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminPackages | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);
	/** the package being edited, as form strings */
	let edit = $state<{ id: AdminPlan['id']; name: string; month: string; year: string; allowance: string; blurb: string; available: boolean } | null>(null);

	async function load() {
		error = null;
		try {
			data = await getPackages();
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	function open(p: AdminPlan) {
		edit = {
			id: p.id,
			name: p.name,
			month: String(p.priceMonthUsd),
			year: String(p.priceYearUsd),
			allowance: String(p.aiAllowanceUsd),
			blurb: p.blurb,
			available: p.available
		};
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!edit) return;
		const patch: AdminPlanPatch = { name: edit.name, blurb: edit.blurb };
		if (edit.id !== 'free') {
			patch.priceMonthUsd = Number(edit.month);
			patch.priceYearUsd = Number(edit.year);
			patch.aiAllowanceUsd = Number(edit.allowance);
			patch.available = edit.available;
		}
		busy = true;
		try {
			data = await updatePackage(edit.id, patch);
			edit = null;
			toast('Package saved', '✓');
		} catch (err) {
			toast(err instanceof AdminError ? err.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			busy = false;
		}
	}

	const usd = (n: number) => (n === 0 ? '$0' : `$${n % 1 ? n.toFixed(2) : n}`);
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	const PLAN_NAMES = $derived(Object.fromEntries((data?.plans ?? []).map((p) => [p.id, p.name])) as Record<string, string>);
	/** Price after a year of monthly payments, compared with the yearly price. */
	const yearlySaving = (p: AdminPlan) => (p.priceMonthUsd > 0 ? Math.round((1 - p.priceYearUsd / (p.priceMonthUsd * 12)) * 100) : 0);
</script>

<svelte:head><title>Packages · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<LargeTitle title="Packages" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<Skeleton variant="card" count={3} label="Loading packages" />
	{:else}
		{#each data.plans as p (p.id)}
			<ListGroup>
				{#if edit?.id === p.id}
					<form class="item col" onsubmit={save}>
						<TextField label="Name" bind:value={edit.name} maxlength={30} required />
						<TextField label="What’s included" bind:value={edit.blurb} maxlength={200} />
						{#if p.id !== 'free'}
							<span class="fields">
								<TextField label="Per month ($)" type="number" min="0" max="1000" step="0.01" bind:value={edit.month} required />
								<TextField label="Per year ($)" type="number" min="0" max="1000" step="0.01" bind:value={edit.year} required />
								<TextField label="AI each month ($)" type="number" min="0" max="100" step="0.1" bind:value={edit.allowance} required />
							</span>
							<span class="row check">
								<span>Offered to new people</span><span class="spacer"></span>
								<Switch bind:checked={edit.available} label="Offered to new people" />
							</span>
						{/if}
						<span class="row" style:gap="var(--space-2)">
							<span class="spacer"></span>
							<Button size="sm" variant="ghost" onclick={() => (edit = null)} disabled={busy}>Cancel</Button>
							<Button size="sm" type="submit" {busy}>Save</Button>
						</span>
					</form>
				{:else}
					<div class="item col">
						<span class="row" style:gap="var(--space-2)">
							<b class="plan">{p.name}</b>
							{#if !p.available}<span class="pill muted">Not offered</span>{/if}
							<span class="spacer"></span>
							<Button variant="link" onclick={() => open(p)} disabled={busy || edit !== null}>Edit</Button>
						</span>
						<span class="caption">{p.blurb}</span>
					</div>
					<ListRow
						title={p.priceMonthUsd ? `${usd(p.priceMonthUsd)} a month · ${usd(p.priceYearUsd)} a year` : 'No charge'}
						subtitle={yearlySaving(p) > 0 ? `Yearly saves ${yearlySaving(p)}%` : undefined}
					/>
					{#if p.id !== 'free'}
						<ListRow title="Managed AI each month">
							{#snippet trailing()}<b class="num">{usd(p.aiAllowanceUsd)}</b>{/snippet}
						</ListRow>
					{/if}
					<ListRow title="Accounts on it">
						{#snippet trailing()}<b class="num">{p.accounts}</b>{/snippet}
					</ListRow>
				{/if}
			</ListGroup>
		{/each}

		<SectionHeader title="Granted now" />
		<ListGroup>
			{#each data.grants as g (g.id)}
				<ListRow href="/admin/accounts/{g.accountId}">
					<span class="ellipsis">{g.accountName ?? `#${g.accountId}`} <span class="caption">#{g.accountId}</span></span>
					<span class="caption">{g.kind === 'trial' ? 'Trial' : 'Complimentary'} · {g.endsAt ? `until ${shortDay(g.endsAt)}` : 'until ended'}{g.note ? ` · ${g.note}` : ''}</span>
					{#snippet trailing()}<span class="pill">{PLAN_NAMES[g.plan] ?? g.plan}</span>{/snippet}
				</ListRow>
			{:else}
				<ListRow subtitle="Nobody has Plus or Pro yet. Grant one from an account’s page." />
			{/each}
		</ListGroup>
		<p class="caption foot">
			Packages aren’t enforced in the app yet: there’s no checkout, and managed AI comes later. Changes ask for your passkey and go in the audit log.
		</p>
	{/if}
</main>

<style>
	.plan {
		font-size: 20px;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: var(--space-2);
	}
	.check {
		gap: var(--space-2);
		align-items: center;
	}
</style>
