<!--
	Fleet console: promo codes. Make a code (random, or one you type in) that
	gives a package for a while; learners redeem it in Settings. Tap a code to
	see who redeemed it, or to switch it off. Making or switching a code asks
	for a passkey tap and goes in the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { Badge, Button, Card, ListGroup, ListRow, Notice, SectionHeader, Segmented, Select, Switch, TextField } from '#lib/ui/index.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError } from '#lib/admin/client.ts';
	import { createPromo, getPromo, listPromos, setPromoDisabled } from '#lib/admin/promos.ts';
	import type { AdminPromo, AdminPromoDetail, AdminPromoInput, AdminPromoList } from '#lib/promo/contract.ts';
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

	const CODE_RE = /^[0-9A-Z]{6,24}$/;
	const customClean = $derived(custom.toUpperCase().replace(/[\s\-_.]/g, ''));
	const customProblem = $derived(source === 'custom' && custom && !CODE_RE.test(customClean) ? '6 to 24 letters and digits' : undefined);
	const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

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
		try {
			detail = await getPromo(code);
		} catch (e) {
			detailError = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
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

	async function copy(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			toast('Code copied', '📋');
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
	const limits = (p: AdminPromo) =>
		`${p.uses}${p.maxUses === null ? '' : ` of ${p.maxUses}`} used · ${p.expiresAt ? `${p.state === 'expired' ? 'expired' : 'until'} ${shortDay(p.expiresAt)}` : 'no expiry'}`;
</script>

<svelte:head><title>Promo codes · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-2)">
	<LargeTitle title="Promo codes" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !data}
		<Skeleton variant="card" count={1} label="Loading promo codes" />
		<Skeleton variant="row" count={3} label="Loading promo codes" />
	{:else}
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
						placeholder="SONGKRAN27"
						maxlength={30}
						autocomplete="off"
						autocapitalize="characters"
						spellcheck={false}
						error={customProblem}
						hint={customClean && !customProblem ? `Saved as ${customClean}. Case, spaces and dashes don’t matter when redeeming.` : 'Letters and digits, 6 to 24.'}
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

		<SectionHeader title="Codes" />
		<ListGroup>
			{#each data.promos as p (p.code)}
				<ListRow title={p.code} subtitle="{gives(p)} · {limits(p)}{p.label ? ` · ${p.label}` : ''}" onclick={() => show(p.code)} chevron>
					{#snippet trailing()}<Badge tone={STATE[p.state].tone}>{STATE[p.state].label}</Badge>{/snippet}
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
				<Card padding="md">
					<div class="form">
						<span class="caption">{gives(detail)}. {limits(detail)}. Made {shortDay(detail.createdAt)}.</span>
						<ListGroup>
							<ListRow title="Accept this code" subtitle={detail.disabledAt === null ? 'People can redeem it' : `Off since ${shortDay(detail.disabledAt)}`}>
								{#snippet trailing()}<Switch label="Accept this code" checked={detail!.disabledAt === null} disabled={switching} onchange={toggle} />{/snippet}
							</ListRow>
						</ListGroup>
						<span class="caption">Switching a code off stops new redemptions. Packages it already gave keep running; end one on the account’s page.</span>
						<Button variant="ghost" size="sm" onclick={() => copy(detail!.code)}>Copy code</Button>
					</div>
				</Card>
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

		<p class="caption foot">
			A code gives its package from the moment it’s redeemed, once per account. It replaces a lower package and is refused when the account already has
			the same package or a better one. Packages aren’t enforced in the app yet.
		</p>
	{/if}
</main>

{#snippet redeemedCount()}{detail?.redemptions.length ?? 0}{/snippet}

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-3);
		align-items: start;
	}
</style>
