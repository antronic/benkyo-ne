<!--
	Fleet console: one account. Changes ask for a fresh passkey tap
	(handled in #lib/admin/client.ts) and are written to the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button, FieldRow, LargeTitle, ListGroup, ListRow, SectionHeader, Select, Skeleton, TextField } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, deleteAccount, endGrant, getAccount, getPackages, grantPackage, patchAccount, revokeSessions } from '#lib/admin/client.ts';
	import type { AdminAccountDetail, AdminGrant, AdminPlan } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	const id = $derived(Number(page.params.id));
	let a = $state<AdminAccountDetail | null>(null);
	let error = $state<AdminError | null>(null);
	/** which action's request is running ('disable', 'cap', 'revoke', 'delete', 'grant', 'end:<id>'), or null */
	let pending = $state<string | null>(null);
	const busy = $derived(pending !== null);
	let cap = $state('');
	let confirmName = $state('');
	let gPlan = $state('plus');
	/** paid packages to grant (all but Free) */
	let paid = $state<Pick<AdminPlan, 'id' | 'name' | 'available'>[]>([
		{ id: 'plus', name: 'Plus', available: true },
		{ id: 'pro', name: 'Pro', available: true }
	]);
	let gKind = $state<'comp' | 'trial'>('trial');
	let gDays = $state('7');
	let gNote = $state('');
	const PLAN_OPTIONS = $derived(paid.map((p) => ({ value: p.id, label: p.available ? p.name : `${p.name} (not offered)` })));
	const KIND_OPTIONS = [
		{ value: 'trial', label: 'Trial' },
		{ value: 'comp', label: 'Complimentary' }
	] as const satisfies { value: 'comp' | 'trial'; label: string }[];
	const dayOptions = $derived([
		{ value: '7', label: '7 days' },
		{ value: '30', label: '30 days' },
		{ value: '90', label: '90 days' },
		{ value: '365', label: '1 year' },
		...(gKind === 'comp' ? [{ value: '', label: 'Until ended' }] : [])
	]);

	async function load() {
		error = null;
		try {
			a = await getAccount(id);
			cap = String(a.capUsd);
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(() => {
		load();
		getPackages()
			.then((p) => (paid = p.plans.filter((x) => x.id !== 'free')))
			.catch(() => {}); // ui-ok: package names only; the defaults show until they arrive
	});

	async function act(key: string, fn: () => Promise<AdminAccountDetail | void>, done: string) {
		pending = key;
		try {
			const r = await fn();
			if (r) {
				a = r;
				cap = String(r.capUsd);
			}
			toast(done, '✓');
		} catch (e) {
			const err = e instanceof AdminError ? e : null;
			// A cancelled passkey prompt isn't an error worth a card.
			toast(err?.message ?? 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			pending = null;
		}
	}

	async function toggleDisabled() {
		if (!a) return;
		if (!a.disabled && !(await confirmDestructive(`Disable ${a.name}?`, 'They are signed out everywhere and can’t sign in until you enable the account again.', 'Disable')))
			return;
		await act('disable', () => patchAccount(id, { disabled: !a!.disabled }), a.disabled ? 'Account enabled' : 'Account disabled');
	}
	async function saveCap() {
		const n = Number(cap);
		if (!Number.isFinite(n)) return toast('Enter a number', '⚠️');
		await act('cap', () => patchAccount(id, { capUsd: n }), 'Cap updated');
	}
	async function revoke() {
		if (!a || !(await confirmDestructive('Sign out everywhere?', `${a.name} is signed out on every device.`, 'Sign out'))) return;
		await act('revoke', () => revokeSessions(id), 'Signed out everywhere');
	}
	async function remove() {
		if (!a || confirmName !== a.name) return;
		if (!(await confirmDestructive(`Delete ${a.name}?`, 'The account, its passkeys, keys, usage and beta data are deleted. This can’t be undone.', 'Delete')))
			return;
		pending = 'delete';
		try {
			await deleteAccount(id, confirmName);
			toast('Account deleted', '✓');
			await goto('/admin/accounts');
		} catch (e) {
			toast(e instanceof AdminError ? e.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			pending = null;
		}
	}

	// "Until ended" is only offered for a complimentary package.
	$effect(() => {
		if (gKind === 'trial' && gDays === '') gDays = '7';
	});

	async function give() {
		if (!a) return;
		const days = gDays === '' ? null : Number(gDays);
		const live = a.grants.find((g) => g.live);
		if (live && !(await confirmDestructive(`Replace ${PLAN_NAMES[live.plan]}?`, `${a.name}'s current ${live.kind} ends now and the new one starts.`, 'Replace')))
			return;
		await act('grant', () => grantPackage(id, { plan: gPlan, kind: gKind, days, note: gNote.trim() || undefined }), `${PLAN_NAMES[gPlan]} granted`);
		gNote = '';
	}
	async function end(g: AdminGrant) {
		if (!a || !(await confirmDestructive(`End ${PLAN_NAMES[g.plan]} now?`, `${a.name} goes back to Free.`, 'End'))) return;
		await act(`end:${g.id}`, () => endGrant(id, g.id), 'Package ended');
	}
	const PLAN_NAMES = $derived({ free: 'Free', ...Object.fromEntries(paid.map((p) => [p.id, p.name])) } as Record<string, string>);
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

	const day = (t: number | null) =>
		t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
	const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
</script>

<svelte:head><title>{a?.name ?? 'Account'} · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail detail={a?.name} />
	<LargeTitle title={a?.name ?? 'Account'} />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !a}
		<Skeleton variant="row" count={5} label="Loading the account" />
	{:else}
		{@const acc = a}
		<ListGroup>
			<ListRow title="Account">{#snippet trailing()}<span class="caption">#{acc.id}</span>{/snippet}</ListRow>
			<ListRow title="Status">
				{#snippet trailing()}
					{#if acc.isAdmin}<span class="pill muted">Admin</span>{/if}
					<span class="pill" class:off={acc.disabled}>{acc.disabled ? 'Disabled' : 'Active'}</span>
				{/snippet}
			</ListRow>
			<ListRow title="Created">{#snippet trailing()}<span class="caption">{day(acc.createdAt)}</span>{/snippet}</ListRow>
			<ListRow title="Last seen">{#snippet trailing()}<span class="caption">{day(acc.lastSeenAt)}</span>{/snippet}</ListRow>
			<ListRow title="Beta consent">
				{#snippet trailing()}
					<span class="caption">
						{#if !acc.consent}Never agreed{:else if acc.consent.withdrawnAt}Withdrawn {day(acc.consent.withdrawnAt)}{:else}Version {acc.consent.version}, {day(acc.consent.acceptedAt)}{/if}
					</span>
				{/snippet}
			</ListRow>
			<ListRow title="Apple ID">{#snippet trailing()}<span class="caption">{acc.appleLinked ? 'Connected' : 'Not connected'}</span>{/snippet}</ListRow>
			<ListRow title="Recovery code">
				{#snippet trailing()}<span class="caption">{acc.recoveryCode === 'unused' ? 'Ready' : acc.recoveryCode === 'used' ? 'Used' : 'None'}</span>{/snippet}
			</ListRow>
		</ListGroup>

		<SectionHeader title="Package" />
		<ListGroup>
			<ListRow title="Now on">
				{#snippet trailing()}<span class="pill" class:muted={acc.plan === 'free'}>{PLAN_NAMES[acc.plan]}</span>{/snippet}
			</ListRow>
			{#each acc.grants as g (g.id)}
				<ListRow
					class={g.live ? '' : 'gone'}
					title="{PLAN_NAMES[g.plan]} · {g.kind === 'trial' ? 'Trial' : 'Complimentary'}"
					subtitle="{g.endedAt
						? `${shortDay(g.startsAt)} to ${shortDay(g.endedAt)}, ended early`
						: g.endsAt
							? `${shortDay(g.startsAt)} to ${shortDay(g.endsAt)}`
							: `Since ${shortDay(g.startsAt)}, until ended`}{g.note ? ` · ${g.note}` : ''}"
				>
					{#snippet trailing()}
						{#if g.live}<Button variant="plain" size="sm" class="danger" onclick={() => end(g)} busy={pending === `end:${g.id}`} disabled={busy}>End</Button>{/if}
					{/snippet}
				</ListRow>
			{/each}
			<form class="item grant" onsubmit={(e) => (e.preventDefault(), give())}>
				<div class="picks">
					<Select options={PLAN_OPTIONS} bind:value={gPlan} label="Package" block />
					<Select options={KIND_OPTIONS} bind:value={gKind} label="Kind" block />
					<Select options={dayOptions} bind:value={gDays} label="How long" block />
				</div>
				<FieldRow>
					<TextField bind:value={gNote} maxlength={120} placeholder="Note (optional)" aria-label="Note" grow />
					<Button type="submit" busy={pending === 'grant'} disabled={busy}>Grant</Button>
				</FieldRow>
			</form>
		</ListGroup>
		<p class="caption" style:margin="var(--space-px) var(--space-1h)">Packages aren’t enforced in the app yet. This records who gets a paid package for when managed AI ships.</p>

		<SectionHeader title="AI this month" />
		<ListGroup>
			<ListRow title="Own-key spend">{#snippet trailing()}<b class="num">{usd(acc.monthUsd)}</b>{/snippet}</ListRow>
			<div class="item inline-form">
				<FieldRow as="form" onsubmit={saveCap}>
					<label class="grow" for="cap">Monthly cap ($)</label>
					<TextField id="cap" class="num-field" type="number" min="0" max="1000" step="0.5" bind:value={cap} />
					<Button type="submit" busy={pending === 'cap'} disabled={busy || Number(cap) === acc.capUsd}>Save</Button>
				</FieldRow>
			</div>
			{#each acc.spendByModel as m (m.feature + m.provider + m.model)}
				<ListRow title={m.model} subtitle="{m.feature} · {m.provider} · {m.calls} {m.calls === 1 ? 'call' : 'calls'}">
					{#snippet trailing()}<span class="num">{usd(m.usd)}</span>{/snippet}
				</ListRow>
			{/each}
		</ListGroup>

		{#if acc.recentCalls.length}
			<SectionHeader title="Recent AI calls" />
			<ListGroup>
				{#each acc.recentCalls as c, i (i)}
					<ListRow title="{c.feature} · {c.model}" subtitle={day(c.at)}>
						{#snippet trailing()}
							<span class="pill" class:off={c.status === 'failed'} class:muted={c.status === 'reserved'}>{c.status}</span>
							<span class="num caption">{usd(c.usd)}</span>
						{/snippet}
					</ListRow>
				{/each}
			</ListGroup>
		{/if}

		<SectionHeader title="Passkeys" />
		<ListGroup>
			{#each acc.passkeyList as p (p.id)}
				<ListRow title={p.name ?? 'Passkey'} subtitle="Added {day(p.createdAt)} · last used {day(p.lastUsedAt)}" />
			{:else}
				<ListRow subtitle="No passkeys" />
			{/each}
		</ListGroup>

		<SectionHeader title="Sessions" />
		<ListGroup>
			{#each acc.sessions as s, i (i)}
				<ListRow title={s.kind}>{#snippet trailing()}<span class="caption">until {day(s.expiresAt)}</span>{/snippet}</ListRow>
			{:else}
				<ListRow subtitle="Not signed in anywhere" />
			{/each}
			{#if acc.sessions.length && !acc.isAdmin}
				<div class="item"><Button variant="plain" size="sm" class="danger" onclick={revoke} busy={pending === 'revoke'} disabled={busy}>Sign out everywhere</Button></div>
			{/if}
		</ListGroup>

		{#if !acc.isAdmin}
			<SectionHeader title="Danger zone" />
			<ListGroup>
				<ListRow
					title={acc.disabled ? 'Enable account' : 'Disable account'}
					subtitle={acc.disabled ? 'They can sign in again.' : 'Signs them out everywhere. You can undo this.'}
				>
					{#snippet trailing()}
						<Button size="sm" variant={acc.disabled ? 'primary' : 'ghost'} onclick={toggleDisabled} busy={pending === 'disable'} disabled={busy}>
							{acc.disabled ? 'Enable' : 'Disable'}
						</Button>
					{/snippet}
				</ListRow>
				<div class="item col">
					<span>Delete account</span>
					<span class="caption">Deletes the account and all its data for good. Type <b>{acc.name}</b> to confirm.</span>
					<FieldRow as="form" onsubmit={remove}>
						<TextField bind:value={confirmName} placeholder={acc.name} aria-label="Type the account name" grow />
						<Button type="submit" variant="danger" busy={pending === 'delete'} disabled={busy || confirmName !== acc.name}>Delete</Button>
					</FieldRow>
				</div>
			</ListGroup>
			<p class="caption" style:text-align="center">Changes ask for your passkey and are written to the audit log.</p>
		{/if}
	{/if}
</main>

<style>
	.fleet :global(.gone) {
		opacity: 0.55;
	}
	/* Three pickers share one row, then the note and its button: every control 44px. */
	.item.grant {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
	}
	.picks {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}
	/* On a phone the package name needs the full width; Kind and How long share the next row. */
	@media (max-width: 599px) {
		.picks {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.picks > :global(:first-child) {
			grid-column: 1 / -1;
		}
	}
	.inline-form :global(.field-row) {
		align-items: center;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
</style>
