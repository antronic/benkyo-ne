<!--
	Fleet console: Free / Plus / Pro. Edit prices and the monthly AI allowance,
	and see who has a package. Grants are made on each account's page.
	Saving asks for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
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

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title="Packages" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else}
		{#each data.plans as p (p.id)}
			<div class="glass group">
				{#if edit?.id === p.id}
					<form class="item col" onsubmit={save}>
						<label class="caption" for="name-{p.id}">Name</label>
						<input id="name-{p.id}" type="text" bind:value={edit.name} maxlength="30" required />
						<label class="caption" for="blurb-{p.id}">What’s included</label>
						<input id="blurb-{p.id}" type="text" bind:value={edit.blurb} maxlength="200" />
						{#if p.id !== 'free'}
							<span class="fields">
								<span class="stack" style:--gap="4px">
									<label class="caption" for="m-{p.id}">Per month ($)</label>
									<input id="m-{p.id}" type="number" min="0" max="1000" step="0.01" bind:value={edit.month} required />
								</span>
								<span class="stack" style:--gap="4px">
									<label class="caption" for="y-{p.id}">Per year ($)</label>
									<input id="y-{p.id}" type="number" min="0" max="1000" step="0.01" bind:value={edit.year} required />
								</span>
								<span class="stack" style:--gap="4px">
									<label class="caption" for="a-{p.id}">AI each month ($)</label>
									<input id="a-{p.id}" type="number" min="0" max="100" step="0.1" bind:value={edit.allowance} required />
								</span>
							</span>
							<label class="row check"><input type="checkbox" bind:checked={edit.available} /> <span>Offered to new people</span></label>
						{/if}
						<span class="row" style:gap="8px">
							<span class="spacer"></span>
							<button type="button" class="btn small ghost" onclick={() => (edit = null)} disabled={busy}>Cancel</button>
							<button class="btn small" disabled={busy}>Save</button>
						</span>
					</form>
				{:else}
					<div class="item col">
						<span class="row" style:gap="8px">
							<b class="plan">{p.name}</b>
							{#if !p.available}<span class="pill muted">Not offered</span>{/if}
							<span class="spacer"></span>
							<button class="link" onclick={() => open(p)} disabled={busy || edit !== null}>Edit</button>
						</span>
						<span class="caption">{p.blurb}</span>
					</div>
					<div class="item">
						<span class="stack" style:--gap="2px">
							<span>{p.priceMonthUsd ? `${usd(p.priceMonthUsd)} a month · ${usd(p.priceYearUsd)} a year` : 'No charge'}</span>
							{#if yearlySaving(p) > 0}<span class="caption">Yearly saves {yearlySaving(p)}%</span>{/if}
						</span>
					</div>
					{#if p.id !== 'free'}
						<div class="item"><span>Managed AI each month</span><span class="spacer"></span><b class="num">{usd(p.aiAllowanceUsd)}</b></div>
					{/if}
					<div class="item"><span>Accounts on it</span><span class="spacer"></span><b class="num">{p.accounts}</b></div>
				{/if}
			</div>
		{/each}

		<h2 class="eyebrow section">Granted now</h2>
		<div class="glass group">
			{#each data.grants as g (g.id)}
				<a class="item" href="/admin/accounts/{g.accountId}">
					<span class="stack" style:--gap="2px" style:min-width="0">
						<span class="ellipsis">{g.accountName ?? `#${g.accountId}`} <span class="caption">#{g.accountId}</span></span>
						<span class="caption">{g.kind === 'trial' ? 'Trial' : 'Complimentary'} · {g.endsAt ? `until ${shortDay(g.endsAt)}` : 'until ended'}{g.note ? ` · ${g.note}` : ''}</span>
					</span>
					<span class="spacer"></span>
					<span class="pill">{PLAN_NAMES[g.plan] ?? g.plan}</span>
					<span class="caption" aria-hidden="true">›</span>
				</a>
			{:else}
				<div class="item caption">Nobody has Plus or Pro yet. Grant one from an account’s page.</div>
			{/each}
		</div>
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
		gap: 8px;
	}
	.fields input {
		width: 100%;
		box-sizing: border-box;
	}
	.check {
		gap: 8px;
		align-items: center;
	}
</style>
