<!--
	Fleet console: packages. Free / Plus / Pro plus any made here. Edit prices
	and the monthly AI allowance, choose the AI models each one includes (from
	the providers on /admin/ai), and see who has a package. Grants are made on
	each account's page. Saving asks for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, createPackage, deletePackage, getAllModels, getPackages, setPackageModels, updatePackage } from '#lib/admin/client.ts';
	import type { AdminFeature, AdminModels, AdminPackages, AdminPlan, AdminPlanModel, AdminPlanPatch } from '#lib/admin/contract.ts';
	import { FEATURE_NAMES, FEATURE_SHORT, priceLabel } from '#lib/admin/models.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminPackages | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);
	/** the package being edited, as form strings */
	let edit = $state<{ id: AdminPlan['id']; name: string; month: string; year: string; allowance: string; blurb: string; available: boolean } | null>(null);

	/** the package whose models are being chosen */
	let picking = $state<{ id: string; models: AdminPlanModel[] } | null>(null);
	let catalog = $state<AdminModels | null>(null);
	let catalogError = $state<string | null>(null);
	let mq = $state('');
	/** the new-package form */
	let making = $state<{ name: string; blurb: string; month: string; year: string; allowance: string } | null>(null);
	const FEATURES: AdminFeature[] = ['fill', 'propose', 'vision'];

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

	async function run<T>(fn: () => Promise<T>, done: string): Promise<T | null> {
		busy = true;
		try {
			const r = await fn();
			toast(done, '✓');
			return r;
		} catch (err) {
			toast(err instanceof AdminError ? err.message : 'Passkey confirmation cancelled', '⚠️', 3200);
			return null;
		} finally {
			busy = false;
		}
	}

	async function pick(p: AdminPlan) {
		picking = { id: p.id, models: p.models.map((m) => ({ ...m, features: [...m.features] })) };
		mq = '';
		if (!catalog) await loadCatalog(false);
	}
	async function loadCatalog(refresh: boolean) {
		catalogError = null;
		try {
			catalog = await getAllModels(refresh);
		} catch (e) {
			catalogError = e instanceof AdminError ? e.message : String(e);
		}
	}
	const catalogLabel = (id: number) => catalog?.providers.find((p) => p.id === id)?.label ?? providerLabels.get(id) ?? null;
	const isPicked = (providerId: number, model: string) => !!picking?.models.some((m) => m.providerId === providerId && m.model === model);
	function addModel(m: AdminModels['models'][number], providerLabel: string | null) {
		if (!picking || isPicked(m.providerId, m.id)) return;
		const free = FEATURES.filter((f) => !picking!.models.some((x) => x.features.includes(f)) && (f !== 'vision' || m.vision));
		picking.models.push({ providerId: m.providerId, providerLabel, model: m.id, label: m.label, features: picking.models.length ? [] : free, inputPerM: m.inputPerM, outputPerM: m.outputPerM });
	}
	function dropModel(i: number) {
		picking?.models.splice(i, 1);
	}
	/** Each feature belongs to one model: giving it to this one takes it from the others. */
	function toggleFeature(i: number, f: AdminFeature) {
		if (!picking) return;
		const m = picking.models[i];
		if (m.features.includes(f)) m.features = m.features.filter((x) => x !== f);
		else {
			for (const o of picking.models) o.features = o.features.filter((x) => x !== f);
			m.features = FEATURES.filter((x) => x === f || m.features.includes(x));
		}
	}
	async function saveModels() {
		if (!picking) return;
		const { id, models } = picking;
		const r = await run(() => setPackageModels(id, { models: models.map((m) => ({ providerId: m.providerId, model: m.model, features: m.features })) }), 'Models saved');
		if (r) {
			data = r;
			picking = null;
		}
	}
	const unassigned = $derived(picking ? FEATURES.filter((f) => !picking!.models.some((m) => m.features.includes(f))) : []);
	const providerLabels = $derived.by(() => {
		const out = new Map<number, string>();
		for (const p of data?.plans ?? []) for (const m of p.models) if (m.providerLabel) out.set(m.providerId, m.providerLabel);
		return out;
	});
	const results = $derived.by(() => {
		const needle = mq.trim().toLowerCase();
		const all = catalog?.models ?? [];
		return (needle ? all.filter((m) => m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle)) : all).slice(0, 40);
	});

	async function make(e: SubmitEvent) {
		e.preventDefault();
		if (!making) return;
		const r = await run(
			() =>
				createPackage({
					name: making!.name,
					blurb: making!.blurb,
					priceMonthUsd: Number(making!.month),
					priceYearUsd: Number(making!.year),
					aiAllowanceUsd: Number(making!.allowance)
				}),
			'Package made. Choose its models, then offer it.'
		);
		if (r) {
			data = r;
			making = null;
			const made = r.plans.find((p) => p.id === r.created);
			if (made) pick(made);
		}
	}

	async function remove(p: AdminPlan) {
		if (!(await confirmDestructive(`Delete ${p.name}?`, 'It’s gone for good. Packages someone has had can only be turned off.', 'Delete'))) return;
		const r = await run(() => deletePackage(p.id), 'Package deleted');
		if (r) {
			data = r;
			edit = null;
		}
	}

	/** What's left of a month's price after the AI allowance, before payment fees. */
	const keeps = (p: AdminPlan) => Math.round((p.priceMonthUsd - p.aiAllowanceUsd) * 100) / 100;

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
							{#if !p.builtin}<button type="button" class="link danger" onclick={() => remove(p)} disabled={busy}>Delete package</button>{/if}
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
						<div class="item">
							<span class="stack" style:--gap="2px">
								<span>Managed AI each month</span>
								{#if p.priceMonthUsd > 0}<span class="caption">Keeps {usd(keeps(p))} a month after AI, before payment fees</span>{/if}
							</span>
							<span class="spacer"></span><b class="num">{usd(p.aiAllowanceUsd)}</b>
						</div>
					{/if}
					<div class="item"><span>Accounts on it</span><span class="spacer"></span><b class="num">{p.accounts}</b></div>
				{/if}
				{#if p.id !== 'free'}
					{#if picking?.id === p.id}
						{@render picker()}
					{:else}
						<div class="item col">
							<span class="row" style:gap="8px">
								<span class="eyebrow">AI models</span>
								<span class="spacer"></span>
								<button class="link" onclick={() => pick(p)} disabled={busy || picking !== null}>{p.models.length ? 'Change' : 'Choose models'}</button>
							</span>
							{#each p.models as m (m.providerId + m.model)}
								<span class="row" style:gap="8px" style:align-items="flex-start">
									<span class="stack" style:--gap="2px" style:min-width="0" style:flex="1">
										<span class="ellipsis">{m.label} <span class="caption">· {m.providerLabel ?? 'removed provider'}</span></span>
										<span class="caption">{priceLabel(m)}</span>
									</span>
									<span class="chips">{#each m.features as f (f)}<span class="pill muted">{FEATURE_SHORT[f]}</span>{/each}</span>
								</span>
							{:else}
								<span class="caption">No models yet. Pick some from your <a href="/admin/ai">AI providers</a>.</span>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/each}

		{#if making}
			<form class="glass group" onsubmit={make}>
				<div class="item col">
					<b>New package</b>
					<label class="caption" for="new-name">Name</label>
					<input id="new-name" type="text" bind:value={making.name} maxlength="30" required placeholder="Exam Sprint" />
					<label class="caption" for="new-blurb">What’s included</label>
					<input id="new-blurb" type="text" bind:value={making.blurb} maxlength="200" />
					<span class="fields">
						<span class="stack" style:--gap="4px">
							<label class="caption" for="new-m">Per month ($)</label>
							<input id="new-m" type="number" min="0" max="1000" step="0.01" bind:value={making.month} required />
						</span>
						<span class="stack" style:--gap="4px">
							<label class="caption" for="new-y">Per year ($)</label>
							<input id="new-y" type="number" min="0" max="1000" step="0.01" bind:value={making.year} required />
						</span>
						<span class="stack" style:--gap="4px">
							<label class="caption" for="new-a">AI each month ($)</label>
							<input id="new-a" type="number" min="0" max="100" step="0.1" bind:value={making.allowance} required />
						</span>
					</span>
					<span class="caption">It starts hidden from new people. Choose its models, then turn on “Offered”.</span>
					<span class="row" style:gap="8px">
						<span class="spacer"></span>
						<button type="button" class="btn small ghost" onclick={() => (making = null)} disabled={busy}>Cancel</button>
						<button class="btn small" disabled={busy}>Make package</button>
					</span>
				</div>
			</form>
		{:else}
			<div class="glass group">
				<button class="item link" onclick={() => (making = { name: '', blurb: '', month: '4.99', year: '39', allowance: '1.5' })} disabled={busy || edit !== null}>
					＋ New package
				</button>
			</div>
		{/if}

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

{#snippet picker()}
	{@const pk = picking!}
	<div class="item col picker">
		<span class="row" style:gap="8px">
			<span class="eyebrow">AI models</span>
			<span class="spacer"></span>
			<span class="caption">{pk.models.length} chosen</span>
		</span>
		{#each pk.models as m, i (m.providerId + m.model)}
			<span class="row chosen" style:gap="8px">
				<span class="stack" style:--gap="4px" style:min-width="0" style:flex="1">
					<span class="ellipsis">{m.label} <span class="caption">· {m.providerLabel ?? providerLabels.get(m.providerId) ?? ''}</span></span>
					<span class="caption">{priceLabel(m)}</span>
					<span class="chips" role="group" aria-label="Used for">
						{#each FEATURES as f (f)}
							<button type="button" class="chip" aria-pressed={m.features.includes(f)} title={FEATURE_NAMES[f]} onclick={() => toggleFeature(i, f)}>{FEATURE_SHORT[f]}</button>
						{/each}
					</span>
				</span>
				<button type="button" class="link danger" onclick={() => dropModel(i)} aria-label="Take {m.label} out">Remove</button>
			</span>
		{:else}
			<span class="caption">Nothing chosen yet. Add models from the list below.</span>
		{/each}
		{#if pk.models.length && unassigned.length}
			<span class="caption warn-text">No model does {unassigned.map((f) => FEATURE_NAMES[f].toLowerCase()).join(', ')} yet.</span>
		{/if}

		<span class="row" style:gap="8px" style:margin-top="6px">
			<input type="search" bind:value={mq} placeholder="Search every provider’s models" aria-label="Search models" style:flex="1" />
			<button type="button" class="link" onclick={() => loadCatalog(true)} disabled={busy}>Refresh</button>
		</span>
		{#if catalogError}
			<span class="caption warn-text">{catalogError}</span>
		{:else if !catalog}
			<span class="caption">Asking your providers for their models…</span>
		{:else}
			{#each catalog.errors as e (e.providerId)}<span class="caption warn-text">{e.label}: {e.message}</span>{/each}
			{#if !catalog.models.length && !catalog.errors.length}
				<span class="caption">No turned-on providers. <a href="/admin/ai">Add one</a> first.</span>
			{/if}
			<div class="results">
				{#each results as m (m.providerId + m.id)}
					{@const label = catalogLabel(m.providerId)}
					<span class="row" style:gap="8px">
						<span class="stack" style:--gap="2px" style:min-width="0" style:flex="1">
							<span class="ellipsis">{m.label} <span class="caption">· {label}</span></span>
							<span class="caption">{priceLabel(m)}{m.vision ? ' · reads images' : ''}</span>
						</span>
						{#if isPicked(m.providerId, m.id)}
							<span class="caption">Added</span>
						{:else}
							<button type="button" class="link" onclick={() => addModel(m, label)} disabled={pk.models.length >= 20}>Add</button>
						{/if}
					</span>
				{/each}
			</div>
			{#if catalog.models.length > results.length}<span class="caption">Showing {results.length} of {catalog.models.length}. Search to find others.</span>{/if}
		{/if}
		<span class="row" style:gap="8px" style:margin-top="6px">
			<span class="spacer"></span>
			<button type="button" class="btn small ghost" onclick={() => (picking = null)} disabled={busy}>Cancel</button>
			<button type="button" class="btn small" onclick={saveModels} disabled={busy}>Save models</button>
		</span>
	</div>
{/snippet}

<style>
	.picker .chosen {
		padding: 8px 0;
		border-bottom: 0.5px solid var(--hairline);
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 360px;
		overflow-y: auto;
		padding: 4px 0;
	}
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
