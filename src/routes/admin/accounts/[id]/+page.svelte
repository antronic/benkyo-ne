<!--
	Fleet console: one account. Changes ask for a fresh passkey tap
	(handled in #lib/admin/client.ts) and are written to the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, deleteAccount, endGrant, getAccount, getPackages, grantPackage, patchAccount, revokeSessions } from '#lib/admin/client.ts';
	import type { AdminAccountDetail, AdminGrant, AdminPlan } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	const id = $derived(Number(page.params.id));
	let a = $state<AdminAccountDetail | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);
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
			.catch(() => {});
	});

	async function act(fn: () => Promise<AdminAccountDetail | void>, done: string) {
		busy = true;
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
			busy = false;
		}
	}

	async function toggleDisabled() {
		if (!a) return;
		if (!a.disabled && !(await confirmDestructive(`Disable ${a.name}?`, 'They are signed out everywhere and can’t sign in until you enable the account again.', 'Disable')))
			return;
		await act(() => patchAccount(id, { disabled: !a!.disabled }), a.disabled ? 'Account enabled' : 'Account disabled');
	}
	async function saveCap() {
		const n = Number(cap);
		if (!Number.isFinite(n)) return toast('Enter a number', '⚠️');
		await act(() => patchAccount(id, { capUsd: n }), 'Cap updated');
	}
	async function revoke() {
		if (!a || !(await confirmDestructive('Sign out everywhere?', `${a.name} is signed out on every device.`, 'Sign out'))) return;
		await act(() => revokeSessions(id), 'Signed out everywhere');
	}
	async function remove() {
		if (!a || confirmName !== a.name) return;
		if (!(await confirmDestructive(`Delete ${a.name}?`, 'The account, its passkeys, keys, usage and beta data are deleted. This can’t be undone.', 'Delete')))
			return;
		busy = true;
		try {
			await deleteAccount(id, confirmName);
			toast('Account deleted', '✓');
			await goto('/admin/accounts');
		} catch (e) {
			toast(e instanceof AdminError ? e.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			busy = false;
		}
	}

	async function give(e: SubmitEvent) {
		e.preventDefault();
		if (!a) return;
		const days = gDays === '' ? null : Number(gDays);
		const live = a.grants.find((g) => g.live);
		if (live && !(await confirmDestructive(`Replace ${PLAN_NAMES[live.plan]}?`, `${a.name}'s current ${live.kind} ends now and the new one starts.`, 'Replace')))
			return;
		await act(() => grantPackage(id, { plan: gPlan, kind: gKind, days, note: gNote.trim() || undefined }), `${PLAN_NAMES[gPlan]} granted`);
		gNote = '';
	}
	async function end(g: AdminGrant) {
		if (!a || !(await confirmDestructive(`End ${PLAN_NAMES[g.plan]} now?`, `${a.name} goes back to Free.`, 'End'))) return;
		await act(() => endGrant(id, g.id), 'Package ended');
	}
	const PLAN_NAMES = $derived({ free: 'Free', ...Object.fromEntries(paid.map((p) => [p.id, p.name])) } as Record<string, string>);
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

	const day = (t: number | null) =>
		t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
	const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
</script>

<svelte:head><title>{a?.name ?? 'Account'} · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title={a?.name ?? 'Account'} />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !a}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else}
		<div class="glass group">
			<div class="item"><span>Account</span><span class="spacer"></span><span class="caption">#{a.id}</span></div>
			<div class="item">
				<span>Status</span><span class="spacer"></span>
				{#if a.isAdmin}<span class="pill muted">Admin</span>{/if}
				<span class="pill" class:off={a.disabled}>{a.disabled ? 'Disabled' : 'Active'}</span>
			</div>
			<div class="item"><span>Created</span><span class="spacer"></span><span class="caption">{day(a.createdAt)}</span></div>
			<div class="item"><span>Last seen</span><span class="spacer"></span><span class="caption">{day(a.lastSeenAt)}</span></div>
			<div class="item">
				<span>Beta consent</span><span class="spacer"></span>
				<span class="caption">
					{#if !a.consent}Never agreed{:else if a.consent.withdrawnAt}Withdrawn {day(a.consent.withdrawnAt)}{:else}Version {a.consent.version}, {day(a.consent.acceptedAt)}{/if}
				</span>
			</div>
			<div class="item"><span>Apple ID</span><span class="spacer"></span><span class="caption">{a.appleLinked ? 'Connected' : 'Not connected'}</span></div>
			<div class="item"><span>Recovery code</span><span class="spacer"></span><span class="caption">{a.recoveryCode === 'unused' ? 'Ready' : a.recoveryCode === 'used' ? 'Used' : 'None'}</span></div>
		</div>

		<h2 class="eyebrow section">Package</h2>
		<div class="glass group">
			<div class="item">
				<span>Now on</span><span class="spacer"></span>
				<span class="pill" class:muted={a.plan === 'free'}>{PLAN_NAMES[a.plan]}</span>
			</div>
			{#each a.grants as g (g.id)}
				<div class="item" class:gone={!g.live}>
					<span class="stack" style:--gap="2px" style:min-width="0">
						<span>{PLAN_NAMES[g.plan]} · {g.kind === 'trial' ? 'Trial' : 'Complimentary'}</span>
						<span class="caption">
							{g.endedAt ? `${shortDay(g.startsAt)} to ${shortDay(g.endedAt)}, ended early` : g.endsAt ? `${shortDay(g.startsAt)} to ${shortDay(g.endsAt)}` : `Since ${shortDay(g.startsAt)}, until ended`}{g.note ? ` · ${g.note}` : ''}
						</span>
					</span>
					<span class="spacer"></span>
					{#if g.live}<button class="link danger" onclick={() => end(g)} disabled={busy}>End</button>{/if}
				</div>
			{/each}
			<form class="item col" onsubmit={give}>
				<span class="row" style:gap="8px" style:flex-wrap="wrap">
					<select bind:value={gPlan} aria-label="Package">
						{#each paid as p (p.id)}<option value={p.id}>{p.name}{p.available ? '' : ' (not offered)'}</option>{/each}
					</select>
					<select bind:value={gKind} aria-label="Kind" onchange={() => gKind === 'trial' && gDays === '' && (gDays = '7')}>
						<option value="trial">Trial</option>
						<option value="comp">Complimentary</option>
					</select>
					<select bind:value={gDays} aria-label="How long">
						<option value="7">7 days</option>
						<option value="30">30 days</option>
						<option value="90">90 days</option>
						<option value="365">1 year</option>
						{#if gKind === 'comp'}<option value="">Until ended</option>{/if}
					</select>
				</span>
				<span class="row" style:gap="8px">
					<input type="text" bind:value={gNote} maxlength="120" placeholder="Note (optional)" aria-label="Note" style:flex="1" />
					<button class="btn small" disabled={busy}>Grant</button>
				</span>
			</form>
		</div>
		<p class="caption" style:margin="2px 6px">Packages aren’t enforced in the app yet. This records who gets a paid package for when managed AI ships.</p>

		<h2 class="eyebrow section">AI this month</h2>
		<div class="glass group">
			<div class="item">
				<span>Spend</span><span class="spacer"></span><b class="num">{usd(a.monthUsd)}</b>
			</div>
			<form class="item" onsubmit={(e) => (e.preventDefault(), saveCap())}>
				<label for="cap">Monthly cap ($)</label><span class="spacer"></span>
				<input id="cap" type="number" min="0" max="1000" step="0.5" bind:value={cap} style:width="90px" />
				<button class="btn small" disabled={busy || Number(cap) === a.capUsd}>Save</button>
			</form>
			{#each a.spendByModel as m (m.feature + m.provider + m.model)}
				<div class="item">
					<span class="stack" style:--gap="2px"><span>{m.model}</span><span class="caption">{m.feature} · {m.provider} · {m.calls} {m.calls === 1 ? "call" : "calls"}</span></span>
					<span class="spacer"></span><span class="num">{usd(m.usd)}</span>
				</div>
			{/each}
		</div>

		{#if a.recentCalls.length}
			<h2 class="eyebrow section">Recent AI calls</h2>
			<div class="glass group">
				{#each a.recentCalls as c, i (i)}
					<div class="item">
						<span class="stack" style:--gap="2px"><span>{c.feature} · {c.model}</span><span class="caption">{day(c.at)}</span></span>
						<span class="spacer"></span>
						<span class="pill" class:off={c.status === 'failed'} class:muted={c.status === 'reserved'}>{c.status}</span>
						<span class="num caption">{usd(c.usd)}</span>
					</div>
				{/each}
			</div>
		{/if}

		<h2 class="eyebrow section">Passkeys</h2>
		<div class="glass group">
			{#each a.passkeyList as p (p.id)}
				<div class="item">
					<span class="stack" style:--gap="2px"><span>{p.name ?? 'Passkey'}</span><span class="caption">Added {day(p.createdAt)} · last used {day(p.lastUsedAt)}</span></span>
				</div>
			{:else}
				<div class="item caption">No passkeys</div>
			{/each}
		</div>

		<h2 class="eyebrow section">Sessions</h2>
		<div class="glass group">
			{#each a.sessions as s, i (i)}
				<div class="item">
					<span>{s.kind}</span><span class="spacer"></span><span class="caption">until {day(s.expiresAt)}</span>
				</div>
			{:else}
				<div class="item caption">Not signed in anywhere</div>
			{/each}
			{#if a.sessions.length && !a.isAdmin}
				<div class="item"><button class="link" onclick={revoke} disabled={busy}>Sign out everywhere</button></div>
			{/if}
		</div>

		{#if !a.isAdmin}
			<h2 class="eyebrow section">Danger zone</h2>
			<div class="glass group">
				<div class="item">
					<span class="stack" style:--gap="2px">
						<span>{a.disabled ? 'Enable account' : 'Disable account'}</span>
						<span class="caption">{a.disabled ? 'They can sign in again.' : 'Signs them out everywhere. You can undo this.'}</span>
					</span>
					<span class="spacer"></span>
					<button class="btn small" class:ghost={!a.disabled} onclick={toggleDisabled} disabled={busy}>{a.disabled ? 'Enable' : 'Disable'}</button>
				</div>
				<div class="item col">
					<span>Delete account</span>
					<span class="caption">Deletes the account and all its data for good. Type <b>{a.name}</b> to confirm.</span>
					<span class="row" style:gap="8px">
						<input type="text" bind:value={confirmName} placeholder={a.name} aria-label="Type the account name" style:flex="1" />
						<button class="btn small danger-btn" onclick={remove} disabled={busy || confirmName !== a.name}>Delete</button>
					</span>
				</div>
			</div>
			<p class="caption" style:text-align="center">Changes ask for your passkey and are written to the audit log.</p>
		{/if}
	{/if}
</main>

<style>
	.gone {
		opacity: 0.55;
	}
	.danger-btn {
		background: var(--danger);
	}
</style>
