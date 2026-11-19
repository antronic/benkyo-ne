<!--
	Fleet console: promo codes. Make a code (random, or one you type in) that
	gives a package for a while; learners redeem it in Settings. Tap a code to
	see who redeemed it, to edit it or to switch it off. Making, editing or switching a code asks
	for a passkey tap and goes in the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { Badge, Button, Card, Columns, ListGroup, ListRow, Notice, SectionHeader, Segmented, Select, Switch, TextField } from '#lib/ui/index.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError } from '#lib/admin/client.ts';
	import { createPromo, getPromo, listPromos, setPromoDisabled, updatePromo } from '#lib/admin/promos.ts';
	import type { AdminPromo, AdminPromoDetail, AdminPromoInput, AdminPromoList, AdminPromoPatch } from '#lib/promo/contract.ts';
	import { promoLink } from '#lib/promo/link.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let data = $state<AdminPromoList | null>(null);
	let error = $state<AdminError | null>(null);

	// the new-code form, as strings so a half-typed number isn't lost
	let source = $state<'random' | 'custom'>('random');
	let custom = $state('');
	let plan = $state('plus');
	let kind = $state<'trial' | 'comp'>('trial');
	let days = $state('30');
	let openEnded = $state(false);
	let limitUses = $state(true);
	let maxUses = $state('100');
	let expires = $state(true);
	let expiresIn = $state('30');
	let label = $state('');
	let creating = $state(false);
	let formError = $state<string | null>(null);
	let made = $state<AdminPromoDetail | null>(null);

	// the code opened below the list
	let open = $state<string | null>(null);
	let detail = $state<AdminPromoDetail | null>(null);
	let detailError = $state<AdminError | null>(null);
	let switching = $state(false);

	async function load() {
		error = null;
		try {
			data = await listPromos();
			if (data.plans.length && !data.plans.some((p) => p.id === plan)) plan = data.plans[0].id;
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	// same rule as normalizePromo/parseCode in the Worker: letters, digits and _, not _ at either end
	const CODE_RE = /^[0-9A-Z][0-9A-Z_]{2,22}[0-9A-Z]$/;
	const cleanCode = (s: string) => s.toUpperCase().replace(/[\s\-.]/g, '');
	const codeProblem = (c: string) => (c && (!CODE_RE.test(c) || c.replace(/_/g, '').length < 6) ? '6 to 24 letters, digits and _, starting and ending with a letter or digit' : undefined);
	const customClean = $derived(cleanCode(custom));
	const customProblem = $derived(source === 'custom' ? codeProblem(customClean) : undefined);
	const num = (s: string | number | null | undefined) => {
		const v = String(s ?? '').trim();
		return /^\d+$/.test(v) ? Number(v) : NaN;
	};

	async function create(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		made = null;
		const input: AdminPromoInput = {
			plan,
			kind,
			days: kind === 'comp' && openEnded ? null : num(days),
			maxUses: limitUses ? num(maxUses) : null,
			expiresInDays: expires ? num(expiresIn) : null,
			label: label.trim() || undefined,
			code: source === 'custom' ? customClean : undefined
		};
		if ([input.days, input.maxUses, input.expiresInDays].some((v) => v !== null && !Number.isFinite(v))) {
			formError = 'Days, uses and expiry are whole numbers.';
			return;
		}
		creating = true;
		try {
			made = await createPromo(input);
			custom = '';
			label = '';
			await load();
		} catch (err) {
			formError = err instanceof AdminError ? err.message : 'Passkey confirmation cancelled';
		} finally {
			creating = false;
		}
	}

	async function show(code: string) {
		if (open === code) {
			open = null;
			return;
		}
		open = code;
		detail = null;
		detailError = null;
		edit = null;
		try {
			detail = await getPromo(code);
		} catch (e) {
			detailError = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}

	// editing the open code, as form strings like the new-code form
	type EditForm = { code: string; label: string; plan: string; kind: 'trial' | 'comp'; days: string; openEnded: boolean; limitUses: boolean; maxUses: string; expires: boolean; expiresIn: string };
	let edit = $state<EditForm | null>(null);
	let editStart: EditForm | null = null;
	let saving = $state(false);
	let editError = $state<string | null>(null);
	const daysLeft = (t: number) => Math.max(1, Math.ceil((t - Date.now()) / 86_400_000));

	function startEdit(d: AdminPromoDetail) {
		edit = {
			code: d.code,
			label: d.label ?? '',
			plan: d.plan,
			kind: d.kind,
			days: d.days === null ? '30' : String(d.days),
			openEnded: d.days === null,
			limitUses: d.maxUses !== null,
			maxUses: String(d.maxUses ?? Math.max(100, d.uses)),
			expires: d.expiresAt !== null,
			expiresIn: d.expiresAt === null ? '30' : String(daysLeft(d.expiresAt))
		};
		editStart = { ...edit };
		editError = null;
	}
	const editCode = $derived(edit ? cleanCode(edit.code) : '');
	const editCodeProblem = $derived(edit ? codeProblem(editCode) : undefined);

	/** Only what changed, so an untouched expiry keeps its exact date. */
	function patchOf(f: EditForm, was: EditForm): AdminPromoPatch {
		const p: AdminPromoPatch = {};
		if (cleanCode(f.code) !== cleanCode(was.code)) p.code = cleanCode(f.code);
		if (f.label.trim() !== was.label.trim()) p.label = f.label.trim() || null;
		if (f.plan !== was.plan) p.plan = f.plan;
		if (f.kind !== was.kind) p.kind = f.kind;
		const days = f.kind === 'comp' && f.openEnded ? null : num(f.days);
		const daysWas = was.kind === 'comp' && was.openEnded ? null : num(was.days);
		if (days !== daysWas) p.days = days;
		const uses = f.limitUses ? num(f.maxUses) : null;
		if (uses !== (was.limitUses ? num(was.maxUses) : null)) p.maxUses = uses;
		const exp = f.expires ? num(f.expiresIn) : null;
		if (exp !== (was.expires ? num(was.expiresIn) : null)) p.expiresInDays = exp;
		return p;
	}

	async function saveEdit(e: SubmitEvent) {
		e.preventDefault();
		if (!edit || !editStart || !detail) return;
		editError = null;
		const patch = patchOf(edit, editStart);
		if ([patch.days, patch.maxUses, patch.expiresInDays].some((v) => v !== undefined && v !== null && !Number.isFinite(v))) {
			editError = 'Days, uses and expiry are whole numbers.';
			return;
		}
		if (!Object.keys(patch).length) {
			edit = null;
			return;
		}
		saving = true;
		try {
			detail = await updatePromo(detail.code, patch);
			open = detail.code;
			edit = null;
			toast('Code saved', '✓');
			await load();
		} catch (err) {
			editError = err instanceof AdminError ? err.message : 'Passkey confirmation cancelled';
		} finally {
			saving = false;
		}
	}

	function retryDetail() {
		const code = open;
		open = null;
		if (code) void show(code);
	}

	async function toggle(on: boolean) {
		if (!detail) return;
		switching = true;
		try {
			detail = await setPromoDisabled(detail.code, !on);
			toast(on ? 'Code switched on' : 'Code switched off', '✓');
			await load();
		} catch (err) {
			toast(err instanceof AdminError ? err.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			switching = false;
		}
	}

	async function copy(code: string, what: 'code' | 'link' = 'code') {
		try {
			await navigator.clipboard.writeText(what === 'link' ? promoLink(code, location.origin) : code);
			toast(what === 'link' ? 'Link copied' : 'Code copied', '📋');
		} catch {
			toast('Couldn’t copy. Select the code instead.', '⚠️');
		}
	}

	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	const planName = (id: string) => data?.plans.find((p) => p.id === id)?.name ?? id;
	const STATE = {
		live: { label: 'Live', tone: 'success' },
		disabled: { label: 'Off', tone: 'neutral' },
		expired: { label: 'Expired', tone: 'warning' },
		used_up: { label: 'Used up', tone: 'warning' }
	} as const;
	const gives = (p: AdminPromo) => `${planName(p.plan)} ${p.kind === 'trial' ? 'trial' : 'comp'}, ${p.days === null ? 'until ended' : `${p.days} days`}`;
	/** used / allowed: "12 / 50", "12 / ∞" for no limit */
	const usage = (p: AdminPromo) => `${p.uses} / ${p.maxUses ?? '∞'}`;
	const limits = (p: AdminPromo) =>
		`${usage(p)} redeemed · ${p.expiresAt ? `${p.state === 'expired' ? 'expired' : 'until'} ${shortDay(p.expiresAt)}` : 'no expiry'}`;
</script>

<svelte:head><title>Promo codes · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-2)">
	<FleetTrail />
	<LargeTitle title="Promo codes" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<Skeleton variant="card" count={1} label="Loading promo codes" />
		<Skeleton variant="row" count={3} label="Loading promo codes" />
	{:else}
		<Columns min="420px">
			<section>
				<SectionHeader title="New code" />
				<Card padding="md">
					<form class="form" onsubmit={create}>
						<Segmented
							label="Code type"
							bind:value={source}
							options={[
								{ value: 'random', label: 'Random' },
								{ value: 'custom', label: 'Type my own' }
							]}
						/>
						{#if source === 'custom'}
							<TextField
								label="Code"
								bind:value={custom}
								placeholder="SONGKRAN_27"
								maxlength={30}
								autocomplete="off"
								autocapitalize="characters"
								spellcheck={false}
								error={customProblem}
								hint={customClean && !customProblem ? `Saved as ${customClean}. Case, spaces, dashes and _ don’t matter when redeeming.` : 'Letters, digits and _, 6 to 24.'}
							/>
						{/if}
						<Segmented
							label="Kind"
							bind:value={kind}
							options={[
								{ value: 'trial', label: 'Trial' },
								{ value: 'comp', label: 'Complimentary' }
							]}
						/>
						<ListGroup>
							<ListRow title="Package" subtitle="What the code gives">
								{#snippet trailing()}<Select label="Package" bind:value={plan} options={data!.plans.map((p) => ({ value: p.id, label: p.name }))} />{/snippet}
							</ListRow>
							{#if kind === 'comp'}
								<ListRow title="No end date" subtitle="Lasts until you end it">
									{#snippet trailing()}<Switch label="No end date" bind:checked={openEnded} />{/snippet}
								</ListRow>
							{/if}
							<ListRow title="Limit uses" subtitle={limitUses ? 'Stops after this many people' : 'Anyone with the code can use it'}>
								{#snippet trailing()}<Switch label="Limit uses" bind:checked={limitUses} />{/snippet}
							</ListRow>
							<ListRow title="Expires" subtitle={expires ? 'Stops accepting it after a while' : 'Accepted until you switch it off'}>
								{#snippet trailing()}<Switch label="Expires" bind:checked={expires} />{/snippet}
							</ListRow>
						</ListGroup>
						<div class="grid">
							{#if kind === 'trial' || !openEnded}
								<TextField label="Days of the package" type="number" inputmode="numeric" min={1} max={730} bind:value={days} hint="From redeeming, 1 to 730" />
							{/if}
							{#if limitUses}<TextField label="Uses" type="number" inputmode="numeric" min={1} max={10000} bind:value={maxUses} hint="1 to 10,000" />{/if}
							{#if expires}<TextField label="Redeemable for (days)" type="number" inputmode="numeric" min={1} max={365} bind:value={expiresIn} hint="1 to 365" />{/if}
						</div>
						<TextField label="Note (only you see it)" bind:value={label} maxlength={60} placeholder="Songkran 2027 newsletter" />
						{#if formError}<Notice tone="danger" title="Code not made">{formError}</Notice>{/if}
						{#if made}
							<Notice tone="success" title="Code {made.code} is live">
								{gives(made)}. {limits(made)}.
								{#snippet action()}<Button variant="ghost" size="sm" onclick={() => copy(made!.code)}>Copy</Button>{/snippet}
							</Notice>
						{/if}
						<Button type="submit" block busy={creating} disabled={!!customProblem || (source === 'custom' && !customClean) || !data.plans.length}>
							Make code
						</Button>
					</form>
				</Card>
			</section>
			<section>
				<SectionHeader title="Codes" />
				<ListGroup>
					{#each data.promos as p (p.code)}
						<ListRow title={p.code} subtitle="{gives(p)} · {limits(p)}{p.label ? ` · ${p.label}` : ''}" onclick={() => show(p.code)} chevron>
							{#snippet trailing()}<span class="uses">{usage(p)}</span><Badge tone={STATE[p.state].tone}>{STATE[p.state].label}</Badge>{/snippet}
						</ListRow>
					{:else}
						<ListRow title="No codes yet" subtitle="Make one above. People redeem it in Settings, under Account." />
					{/each}
				</ListGroup>

				{#if open}
					<SectionHeader title="Code {open}" />
					{#if detailError}
						<ErrorCard error={detailError} onretry={retryDetail} />
					{:else if !detail}
						<Skeleton variant="row" count={2} label="Loading code" />
					{:else}
						{#if edit}
							<Card padding="md">
								<form class="form" onsubmit={saveEdit}>
									<TextField
										label="Code"
										bind:value={edit.code}
										maxlength={30}
										autocomplete="off"
										autocapitalize="characters"
										spellcheck={false}
										disabled={detail.uses > 0 || detail.redemptions.length > 0}
										error={editCodeProblem}
										hint={detail.uses > 0 || detail.redemptions.length > 0
											? 'Can’t change after someone has redeemed it: they and their grant already name it. Make a new code instead.'
											: editCode && !editCodeProblem && editCode !== detail.code
												? `Saved as ${editCode}.`
												: 'Nobody has used it yet, so you can still change it.'}
									/>
									<Segmented
										label="Kind"
										bind:value={edit.kind}
										options={[
											{ value: 'trial', label: 'Trial' },
											{ value: 'comp', label: 'Complimentary' }
										]}
									/>
									<ListGroup>
										<ListRow title="Package" subtitle="What the code gives">
											{#snippet trailing()}<Select label="Package" bind:value={edit!.plan} options={data!.plans.map((p) => ({ value: p.id, label: p.name }))} />{/snippet}
										</ListRow>
										{#if edit.kind === 'comp'}
											<ListRow title="No end date" subtitle="Lasts until you end it">
												{#snippet trailing()}<Switch label="No end date" bind:checked={edit!.openEnded} />{/snippet}
											</ListRow>
										{/if}
										<ListRow title="Limit uses" subtitle={`Used ${detail.uses} time${detail.uses === 1 ? '' : 's'} so far`}>
											{#snippet trailing()}<Switch label="Limit uses" bind:checked={edit!.limitUses} />{/snippet}
										</ListRow>
										<ListRow title="Expires" subtitle={detail.expiresAt ? `Now ${detail.state === 'expired' ? 'expired' : 'until'} ${shortDay(detail.expiresAt)}` : 'Now accepted until you switch it off'}>
											{#snippet trailing()}<Switch label="Expires" bind:checked={edit!.expires} />{/snippet}
										</ListRow>
									</ListGroup>
									<div class="grid">
										{#if edit.kind === 'trial' || !edit.openEnded}
											<TextField label="Days of the package" type="number" inputmode="numeric" min={1} max={730} bind:value={edit.days} hint="From redeeming, 1 to 730" />
										{/if}
										{#if edit.limitUses}<TextField label="Uses" type="number" inputmode="numeric" min={Math.max(1, detail.uses)} max={10000} bind:value={edit.maxUses} hint="{Math.max(1, detail.uses)} to 10,000" />{/if}
										{#if edit.expires}<TextField label="Redeemable for (days from today)" type="number" inputmode="numeric" min={1} max={365} bind:value={edit.expiresIn} hint="1 to 365" />{/if}
									</div>
									<TextField label="Note (only you see it)" bind:value={edit.label} maxlength={60} />
									<Notice tone="info">Changes apply to people who redeem it from now on. Packages it already gave keep their terms.</Notice>
									{#if editError}<Notice tone="danger" title="Not saved">{editError}</Notice>{/if}
									<div class="actions">
										<Button variant="ghost" onclick={() => (edit = null)} disabled={saving}>Cancel</Button>
										<Button type="submit" busy={saving} disabled={!!editCodeProblem}>Save changes</Button>
									</div>
								</form>
							</Card>
						{:else}
						<Card padding="md">
							<div class="form">
								<span class="caption">{gives(detail)}. {limits(detail)}. Made {shortDay(detail.createdAt)}.</span>
								<ListGroup>
									<ListRow title="Accept this code" subtitle={detail.disabledAt === null ? 'People can redeem it' : `Off since ${shortDay(detail.disabledAt)}`}>
										{#snippet trailing()}<Switch label="Accept this code" checked={detail!.disabledAt === null} disabled={switching} onchange={toggle} />{/snippet}
									</ListRow>
								</ListGroup>
								<span class="caption">Link: {promoLink(detail.code, location.origin)}. Opening it keeps the code through sign-up and uses it once the person is signed in.</span>
								<span class="caption">Switching a code off stops new redemptions. Packages it already gave keep running; end one on the account’s page.</span>
								<div class="actions">
									<Button variant="ghost" size="sm" onclick={() => copy(detail!.code)}>Copy code</Button>
									<Button variant="ghost" size="sm" onclick={() => copy(detail!.code, 'link')}>Copy link</Button>
									<Button size="sm" onclick={() => startEdit(detail!)}>Edit code</Button>
								</div>
							</div>
						</Card>
						{/if}
						<SectionHeader title="Redeemed by" level={3} trailing={redeemedCount} />
						<ListGroup>
							{#each detail.redemptions as r (r.accountId)}
								<ListRow title={r.accountName ?? `#${r.accountId}`} subtitle="#{r.accountId} · {shortDay(r.redeemedAt)}" href="/admin/accounts/{r.accountId}">
									{#snippet trailing()}<Badge tone={r.live ? 'success' : 'neutral'}>{r.live ? 'Active' : 'Ended'}</Badge>{/snippet}
								</ListRow>
							{:else}
								<ListRow title="Nobody yet" subtitle="Redemptions show up here." />
							{/each}
						</ListGroup>
					{/if}
				{/if}
			</section>
		</Columns>


		<p class="caption foot">
			A code gives its package from the moment it’s redeemed, once per account. It replaces a lower package and is refused when the account already has
			the same package or a better one.
		</p>
	{/if}
</main>

{#snippet redeemedCount()}{detail ? usage(detail) : ''}{/snippet}

<style>
	.uses {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-2);
		font-size: var(--text-subhead);
		margin-inline-end: var(--space-2);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-3);
		align-items: start;
	}
</style>
