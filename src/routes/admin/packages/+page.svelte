<!--
	Fleet console: packages. Free / Plus / Pro plus any made here. Edit prices
	and the monthly AI credits, choose the AI models each one includes (from
	the providers on /admin/ai), set what each model costs in credits (per 1,
	1K or 1M tokens), and see who has a package. Grants are made on each
	account's page. Saving asks for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import { Columns } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { Badge, Button, Card, Chip, ListGroup, ListRow, SectionHeader, Segmented, Spinner, Switch, TextField } from '#lib/ui/index.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, createPackage, deletePackage, getAllModels, getPackages, setCreditRate, setPackageModels, updatePackage } from '#lib/admin/client.ts';
	import type { AdminCreditRate, AdminFeature, AdminModels, AdminPackages, AdminPlan, AdminPlanModel, AdminPlanPatch } from '#lib/admin/contract.ts';
	import { formatCredits, rateLabel, unitLabel, usdPerCredit, type CreditUnit } from '#lib/ai/credits.ts';
	import { FEATURE_NAMES, FEATURE_SHORT, priceLabel } from '#lib/admin/models.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminPackages | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);
	/** the package being edited, as form strings */
	let edit = $state<{ id: AdminPlan['id']; name: string; month: string; year: string; credits: string; blurb: string; available: boolean } | null>(null);

	/** the package whose models are being chosen */
	let picking = $state<{ id: string; models: AdminPlanModel[] } | null>(null);
	let catalog = $state<AdminModels | null>(null);
	let catalogError = $state<string | null>(null);
	let mq = $state('');
	/** the new-package form */
	let making = $state<{ name: string; blurb: string; month: string; year: string; credits: string } | null>(null);
	/** the model whose credit rate is being edited, as form strings */
	let rating = $state<{ key: string; providerId: number; model: string; unit: string; input: string | number | null; output: string | number | null } | null>(null);
	const FEATURES: AdminFeature[] = ['fill', 'propose', 'vision', 'translate'];

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
			credits: String(p.aiCredits),
			blurb: p.blurb,
			available: p.available
		};
	}

	async function save() {
		if (!edit) return;
		const patch: AdminPlanPatch = { name: edit.name, blurb: edit.blurb };
		if (edit.id !== 'free') {
			patch.priceMonthUsd = Number(edit.month);
			patch.priceYearUsd = Number(edit.year);
			patch.aiCredits = Number(edit.credits);
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
	let catalogLoading = $state(false);
	async function loadCatalog(refresh: boolean) {
		catalogError = null;
		catalogLoading = true;
		try {
			catalog = await getAllModels(refresh);
		} catch (e) {
			catalogError = e instanceof AdminError ? e.message : String(e);
		} finally {
			catalogLoading = false;
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
	const matches = $derived.by(() => {
		const needle = mq.trim().toLowerCase();
		const all = catalog?.models ?? [];
		return needle ? all.filter((m) => m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle)) : all;
	});
	const results = $derived(matches.slice(0, 40));

	async function make() {
		if (!making) return;
		const r = await run(
			() =>
				createPackage({
					name: making!.name,
					blurb: making!.blurb,
					priceMonthUsd: Number(making!.month),
					priceYearUsd: Number(making!.year),
					aiCredits: Number(making!.credits)
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

	const rateKey = (r: { providerId: number; model: string }) => `${r.providerId}/${r.model}`;
	const rates = $derived(new Map((data?.rates ?? []).map((r) => [rateKey(r), r])));
	const UNITS: { value: string; label: string }[] = [
		{ value: '1', label: 'Per token' },
		{ value: '1000', label: 'Per 1K' },
		{ value: '1000000', label: 'Per 1M' }
	];
	/** "No rate: costs its price at 1,000 credits per $1". */
	const defaultRate = () => `No rate: its price at ${formatCredits(data?.creditsPerUsd ?? 1000)} credits per $1`;
	const rateText = (r: Pick<AdminCreditRate, 'rate'> | undefined) => (r?.rate ? rateLabel(r.rate) : defaultRate());

	function openRate(r: AdminCreditRate) {
		rateError = null;
		const per = data?.creditsPerUsd ?? 1000;
		// a new rate starts at what the model costs now, per 1M tokens
		ratingUnit = r.rate ? String(r.rate.unit) : '1000000';
		rating = r.rate
			? { key: rateKey(r), providerId: r.providerId, model: r.model, unit: String(r.rate.unit), input: String(r.rate.inputCredits), output: String(r.rate.outputCredits) }
			: { key: rateKey(r), providerId: r.providerId, model: r.model, unit: '1000000', input: String(+((r.inputPerM ?? 0) * per).toFixed(4)), output: String(+((r.outputPerM ?? 0) * per).toFixed(4)) };
	}
	/**
	 * A number field's bound value is a number once typed in (Svelte binds
	 * type="number" as a number), and null or '' when empty: never call string
	 * methods on it.
	 */
	const filled = (v: string | number | null | undefined) => v !== null && v !== undefined && String(v).trim() !== '';
	const ratingValid = $derived(
		!!rating && filled(rating.input) && filled(rating.output) && Number(rating.input) >= 0 && Number(rating.output) >= 0
	);
	/** What one credit is worth in provider cost at the rate being typed, as a hint. */
	const ratingHint = $derived.by(() => {
		if (!rating || !ratingValid) return 'Credits can have decimals, like 0.5.';
		const r = rates.get(rating.key);
		const v = r && usdPerCredit(r, { unit: Number(rating.unit) as CreditUnit, inputCredits: Number(rating.input), outputCredits: Number(rating.output) });
		return v ? `About $${v < 0.001 ? v.toPrecision(2) : +v.toFixed(4)} of provider cost per credit.` : 'Credits can have decimals, like 0.5.';
	});
	/** Changing the token unit keeps the same price: the numbers scale with it. */
	let ratingUnit = '';
	function changeUnit(next: string) {
		if (!rating) return;
		const k = Number(next) / Number(ratingUnit || next);
		const scale = (v: string | number | null) => (!filled(v) || !Number.isFinite(Number(v)) ? v : String(+(Number(v) * k).toPrecision(6)));
		rating.input = scale(rating.input);
		rating.output = scale(rating.output);
		ratingUnit = next;
	}
	async function saveRate(clear = false) {
		if (!rating) return;
		const { providerId, model, unit, input, output } = rating;
		const rate = clear ? null : { unit: Number(unit) as CreditUnit, inputCredits: Number(input), outputCredits: Number(output) };
		rateError = null;
		busy = true;
		try {
			data = await setCreditRate({ providerId, model, rate });
			rating = null;
			toast(clear ? 'Rate cleared' : 'Rate saved', '✓');
		} catch (err) {
			// shown in the form, so the numbers typed stay and Try again resends them
			rateError = err instanceof AdminError ? err : new AdminError(0, 'stepup', 'Passkey confirmation cancelled');
			lastClear = clear;
		} finally {
			busy = false;
		}
	}
	let rateError = $state<AdminError | null>(null);
	let lastClear = false;

	const usd = (n: number) => (n === 0 ? '$0' : `$${n % 1 ? n.toFixed(2) : n}`);
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	const PLAN_NAMES = $derived(Object.fromEntries((data?.plans ?? []).map((p) => [p.id, p.name])) as Record<string, string>);
	/** Price after a year of monthly payments, compared with the yearly price. */
	const yearlySaving = (p: AdminPlan) => (p.priceMonthUsd > 0 ? Math.round((1 - p.priceYearUsd / (p.priceMonthUsd * 12)) * 100) : 0);
</script>

<svelte:head><title>Packages · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-2)">
	<FleetTrail />
	<LargeTitle title="Packages" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<ListGroup><ListRow subtitle="Loading…" /></ListGroup>
	{:else}
		<Columns min="420px">
			{#each data.plans as p (p.id)}
				<ListGroup>
					{#if edit?.id === p.id}
						<ListRow>
							<div class="stack" style:--gap="var(--space-3)">
								<TextField id="name-{p.id}" label="Name" bind:value={edit.name} maxlength={30} />
								<TextField id="blurb-{p.id}" label="What’s included" bind:value={edit.blurb} maxlength={200} />
								{#if p.id !== 'free'}
									<span class="fields">
										<TextField id="m-{p.id}" label="Per month ($)" type="number" min="0" max="1000" step="0.01" bind:value={edit.month} />
										<TextField id="y-{p.id}" label="Per year ($)" type="number" min="0" max="1000" step="0.01" bind:value={edit.year} />
										<TextField id="a-{p.id}" label="AI credits a month" type="number" min="0" max="10000000" step="1" bind:value={edit.credits} />
									</span>
								{/if}
							</div>
						</ListRow>
						{#if p.id !== 'free'}
							<ListRow title="Offered to new people">
								{#snippet trailing()}<Switch label="Offered to new people" bind:checked={edit!.available} />{/snippet}
							</ListRow>
						{/if}
						<ListRow>
							<span class="row" style:gap="var(--space-2)" style:flex-wrap="wrap">
								{#if !p.builtin}<Button variant="danger" size="sm" onclick={() => remove(p)} disabled={busy}>Delete package</Button>{/if}
								<span class="spacer"></span>
								<Button variant="ghost" size="sm" onclick={() => (edit = null)} disabled={busy}>Cancel</Button>
								<Button size="sm" onclick={save} {busy}>Save</Button>
							</span>
						</ListRow>
					{:else}
						<ListRow>
							<b class="plan">{p.name}</b>
							{#if p.blurb}<span class="caption">{p.blurb}</span>{/if}
							{#snippet trailing()}
								{#if !p.available}<Badge>Not offered</Badge>{/if}
								<Button variant="plain" size="sm" onclick={() => open(p)} disabled={busy || edit !== null}>Edit</Button>
							{/snippet}
						</ListRow>
						<ListRow
							title={p.priceMonthUsd ? `${usd(p.priceMonthUsd)} a month · ${usd(p.priceYearUsd)} a year` : 'No charge'}
							subtitle={yearlySaving(p) > 0 ? `Yearly saves ${yearlySaving(p)}%` : undefined}
						/>
						{#if p.id !== 'free'}
							<ListRow title="AI credits each month" subtitle="Each model spends them at its rate under “Credits per model”">
								{#snippet trailing()}<b class="num">{formatCredits(p.aiCredits)}</b>{/snippet}
							</ListRow>
						{/if}
						<ListRow title="Accounts on it">
							{#snippet trailing()}<b class="num">{p.accounts}</b>{/snippet}
						</ListRow>
					{/if}
					{#if p.id !== 'free'}
						{#if picking?.id === p.id}
							{@render picker()}
						{:else}
							<ListRow>
								<div class="stack" style:--gap="var(--space-2)">
									<span class="row" style:gap="var(--space-2)">
										<span class="eyebrow">AI models</span>
										<span class="spacer"></span>
										<Button variant="plain" size="sm" onclick={() => pick(p)} disabled={busy || picking !== null}>{p.models.length ? 'Change' : 'Choose models'}</Button>
									</span>
									{#each p.models as m (m.providerId + m.model)}
										<span class="row" style:gap="var(--space-2)" style:align-items="flex-start">
											<span class="stack" style:--gap="var(--space-px)" style:min-width="0" style:flex="1">
												<span class="ellipsis">{m.label} <span class="caption">· {m.providerLabel ?? 'removed provider'}</span></span>
												<span class="caption">{priceLabel(m)}</span>
												<span class="caption">{rateText(rates.get(rateKey(m)))}</span>
											</span>
											<span class="chips">{#each m.features as f (f)}<Badge variant="tag">{FEATURE_SHORT[f]}</Badge>{/each}</span>
										</span>
									{:else}
										<span class="caption">No models yet. Pick some from your <a href="/admin/ai">AI providers</a>.</span>
									{/each}
								</div>
							</ListRow>
						{/if}
					{/if}
				</ListGroup>
			{/each}
		</Columns>

		{#if making}
			<Card padding="md">
				<div class="stack" style:--gap="var(--space-3)">
					<b>New package</b>
					<TextField id="new-name" label="Name" bind:value={making.name} maxlength={30} placeholder="Exam Sprint" />
					<TextField id="new-blurb" label="What’s included" bind:value={making.blurb} maxlength={200} />
					<span class="fields">
						<TextField id="new-m" label="Per month ($)" type="number" min="0" max="1000" step="0.01" bind:value={making.month} />
						<TextField id="new-y" label="Per year ($)" type="number" min="0" max="1000" step="0.01" bind:value={making.year} />
						<TextField id="new-a" label="AI credits a month" type="number" min="0" max="10000000" step="1" bind:value={making.credits} />
					</span>
					<span class="caption">It starts hidden from new people. Choose its models, then turn on “Offered”.</span>
					<span class="row" style:gap="var(--space-2)">
						<span class="spacer"></span>
						<Button variant="ghost" size="sm" onclick={() => (making = null)} disabled={busy}>Cancel</Button>
						<Button size="sm" onclick={make} {busy} disabled={!making.name.trim()}>Make package</Button>
					</span>
				</div>
			</Card>
		{:else}
			<ListGroup>
				<ListRow tone="link" title="＋ New package" onclick={() => !busy && edit === null && (making = { name: '', blurb: '', month: '4.99', year: '39', credits: '1500' })} />
			</ListGroup>
		{/if}

		<SectionHeader title="Credits per model" />
		<ListGroup>
			{#each data.rates as r (rateKey(r))}
				{#if rating?.key === rateKey(r)}
					{@const rt = rating}
					<ListRow>
						<div class="stack" style:--gap="var(--space-3)">
							<span class="stack" style:--gap="var(--space-px)">
								<b class="ellipsis">{r.label} <span class="caption">· {r.providerLabel ?? 'removed provider'}</span></b>
								<span class="caption">{priceLabel(r)}</span>
							</span>
							<Segmented label="Tokens the credits are for" options={UNITS} bind:value={rt.unit} onchange={changeUnit} />
							<span class="fields">
								<TextField id="rate-in" label="Input credits per {unitLabel(Number(rt.unit) as CreditUnit)}" type="number" min="0" max="1000000" step="any" bind:value={rt.input} />
								<TextField id="rate-out" label="Output credits per {unitLabel(Number(rt.unit) as CreditUnit)}" type="number" min="0" max="1000000" step="any" bind:value={rt.output} />
							</span>
							<span class="caption">{ratingHint} Changing the token unit keeps the price. Cached input counts as input.</span>
							{#if rateError}<ErrorCard error={rateError} onretry={() => saveRate(lastClear)} />{/if}
							<span class="row" style:gap="var(--space-2)" style:flex-wrap="wrap">
								{#if r.rate}<Button variant="plain" class="danger" size="sm" onclick={() => saveRate(true)} disabled={busy}>Clear rate</Button>{/if}
								<span class="spacer"></span>
								<Button variant="ghost" size="sm" onclick={() => ((rating = null), (rateError = null))} disabled={busy}>Cancel</Button>
								<Button size="sm" onclick={() => saveRate()} {busy} disabled={!ratingValid}>Save rate</Button>
							</span>
						</div>
					</ListRow>
				{:else}
					<ListRow title="{r.label} · {r.providerLabel ?? 'removed provider'}" subtitle="{rateText(r)} · in {r.packages.join(', ')}">
						{#snippet trailing()}<Button variant="plain" size="sm" onclick={() => openRate(r)} disabled={busy || rating !== null} aria-label="Set the credit rate for {r.label}">{r.rate ? 'Edit' : 'Set rate'}</Button>{/snippet}
					</ListRow>
				{/if}
			{:else}
				<ListRow subtitle="No package has a model yet. Choose a package’s models first, then set what each one costs in credits." />
			{/each}
		</ListGroup>

		<SectionHeader title="Granted now" />
		<ListGroup>
			{#each data.grants as g (g.id)}
				<ListRow
					href="/admin/accounts/{g.accountId}"
					title={`${g.accountName ?? `#${g.accountId}`} #${g.accountId}`}
					subtitle={`${g.kind === 'trial' ? 'Trial' : 'Complimentary'} · ${g.endsAt ? `until ${shortDay(g.endsAt)}` : 'until ended'}${g.note ? ` · ${g.note}` : ''}`}
				>
					{#snippet trailing()}<Badge tone="success">{PLAN_NAMES[g.plan] ?? g.plan}</Badge>{/snippet}
				</ListRow>
			{:else}
				<ListRow subtitle="Nobody has a paid package yet. Grant one from an account’s page." />
			{/each}
		</ListGroup>
		<p class="caption foot">
			A package’s AI credits and models apply as soon as an account has the package. A rate applies to the next AI call in every package that has the model. There’s no checkout yet: packages come from grants and promo codes. Changes ask for your passkey and go in the audit log.
		</p>
	{/if}
</main>

{#snippet picker()}
	{@const pk = picking!}
	<ListRow>
		<div class="stack picker" style:--gap="var(--space-2)">
			<span class="row" style:gap="var(--space-2)">
				<span class="eyebrow">AI models</span>
				<span class="spacer"></span>
				<span class="caption">{pk.models.length} chosen</span>
			</span>
			{#each pk.models as m, i (m.providerId + m.model)}
				<span class="row chosen" style:gap="var(--space-2)">
					<span class="stack" style:--gap="var(--space-1)" style:min-width="0" style:flex="1">
						<span class="ellipsis">{m.label} <span class="caption">· {m.providerLabel ?? providerLabels.get(m.providerId) ?? ''}</span></span>
						<span class="caption">{priceLabel(m)}</span>
						<span class="chips" role="group" aria-label="Used for">
							{#each FEATURES as f (f)}
								<Chip selected={m.features.includes(f)} onclick={() => toggleFeature(i, f)}>{FEATURE_SHORT[f]}</Chip>
							{/each}
						</span>
					</span>
					<Button variant="plain" class="danger" size="sm" onclick={() => dropModel(i)} aria-label="Take {m.label} out">Remove</Button>
				</span>
			{:else}
				<span class="caption">Nothing chosen yet. Add models from the list below.</span>
			{/each}
			{#if pk.models.length && unassigned.length}
				<span class="caption warn-text">No model does {unassigned.map((f) => FEATURE_NAMES[f].toLowerCase()).join(', ')} yet.</span>
			{/if}
			<span class="caption">Fill: {FEATURE_NAMES.fill} · Suggest: {FEATURE_NAMES.propose} · Photo: {FEATURE_NAMES.vision} · Translate: {FEATURE_NAMES.translate} (the cheapest model when none is picked)</span>

			<TextField id="model-search" type="search" bind:value={mq} placeholder="Search every provider’s models" aria-label="Search models" />
			{#if catalogError}
				<span class="caption warn-text">{catalogError}</span>
			{:else if !catalog}
				<Spinner label="Asking your providers for their models…" showLabel />
			{:else}
				{#each catalog.errors as e (e.providerId)}<span class="caption warn-text">{e.label}: {e.message}</span>{/each}
				{#if !catalog.models.length && !catalog.errors.length}
					<span class="caption">No turned-on providers. <a href="/admin/ai">Add one</a> first.</span>
				{/if}
				<div class="results">
					{#each results as m (m.providerId + m.id)}
						{@const label = catalogLabel(m.providerId)}
						<span class="row" style:gap="var(--space-2)">
							<span class="stack" style:--gap="var(--space-px)" style:min-width="0" style:flex="1">
								<span class="ellipsis">{m.label} <span class="caption">· {label}</span></span>
								<span class="caption">{priceLabel(m)}{m.vision ? ' · reads images' : ''}</span>
							</span>
							{#if isPicked(m.providerId, m.id)}
								<Badge tone="success">Added</Badge>
							{:else}
								<Button variant="plain" size="sm" onclick={() => addModel(m, label)} disabled={pk.models.length >= 20}>Add</Button>
							{/if}
						</span>
					{/each}
				</div>
				{#if matches.length > results.length}<span class="caption">Showing {results.length} of {matches.length}. Search to narrow it down.</span>{:else if mq.trim() && !matches.length}<span class="caption">No model matches.</span>{/if}
			{/if}
			<span class="row"><Button variant="plain" size="sm" onclick={() => loadCatalog(true)} busy={catalogLoading} disabled={busy}>Ask providers again</Button></span>
			<span class="row" style:gap="var(--space-2)" style:justify-content="flex-end">
				<Button variant="ghost" size="sm" onclick={() => (picking = null)} disabled={busy}>Cancel</Button>
				<Button size="sm" onclick={saveModels} {busy}>Save models</Button>
			</span>
		</div>
	</ListRow>
{/snippet}

<style>
	.plan {
		font-size: 20px;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: var(--space-2);
	}
	.picker .chosen {
		padding: var(--space-2) 0;
		border-bottom: 0.5px solid var(--hairline);
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-height: 360px;
		overflow-y: auto;
		padding: var(--space-1) 0;
	}
</style>
