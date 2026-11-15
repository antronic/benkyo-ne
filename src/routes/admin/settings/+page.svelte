<!--
	Fleet console: sign-ups, invite codes and session lifetime.
	Switching sign-ups and changing the session lifetime ask for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import DayBars from '#lib/admin/DayBars.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, createInvite, getSettings, revokeInvite, setSessionDays, setSignupMode } from '#lib/admin/client.ts';
	import type { AdminInvite, AdminSettings } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let s = $state<AdminSettings | null>(null);
	let error = $state<AdminError | null>(null);
	let busy = $state(false);
	let days = $state('');
	let label = $state('');
	let uses = $state('1');
	let expiry = $state('14');

	async function load() {
		error = null;
		try {
			s = await getSettings();
			days = s.session.days === null ? '' : String(s.session.days);
		} catch (e) {
			error = e instanceof AdminError ? e : new AdminError(0, 'server', String(e));
		}
	}
	onMount(load);

	async function act<T>(fn: () => Promise<T>, done: string): Promise<T | undefined> {
		busy = true;
		try {
			const r = await fn();
			toast(done, '✓');
			return r;
		} catch (e) {
			toast(e instanceof AdminError ? e.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			busy = false;
		}
	}

	async function toggleSignups() {
		if (!s) return;
		const to = s.signup.mode === 'open' ? 'closed' : 'open';
		if (to === 'closed' && !(await confirmDestructive('Make sign-ups invite-only?', 'New people need an invite code to create an account. Apple sign-up stops.', 'Invite only')))
			return;
		const r = await act(() => setSignupMode(to), to === 'open' ? 'Sign-ups are open' : 'Sign-ups are invite-only');
		if (r) s = r;
	}
	async function saveDays(value: number | null) {
		const r = await act(() => setSessionDays(value), value === null ? 'Back to the default' : 'Session lifetime saved');
		if (r) {
			s = r;
			days = r.session.days === null ? '' : String(r.session.days);
		}
	}
	async function newInvite(e: SubmitEvent) {
		e.preventDefault();
		const inv = await act(
			() => createInvite({ label: label.trim() || undefined, maxUses: Number(uses) || 1, expiresInDays: Number(expiry) || null }),
			'Invite created'
		);
		if (inv && s) {
			s.invites = [inv, ...s.invites];
			label = '';
			void copy(inv.code);
		}
	}
	async function copy(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			toast('Code copied', '📋');
		} catch {
			/* still on screen */
		}
	}
	async function revoke(inv: AdminInvite) {
		if (!(await confirmDestructive(`Revoke ${inv.code}?`, 'Nobody can sign up with it after this.', 'Revoke'))) return;
		if (await act(() => revokeInvite(inv.code), 'Invite revoked')) await load();
	}

	const live = (i: AdminInvite) => !i.revokedAt && i.uses < i.maxUses && (!i.expiresAt || i.expiresAt > Date.now());
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

	const total = $derived(s?.signupsByDay.reduce((n, d) => n + d.count, 0) ?? 0);
</script>

<svelte:head><title>Sign-ups and settings · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="8px">
	<LargeTitle title="Settings" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !s}
		<div class="glass group" aria-busy="true"><div class="item caption">Loading…</div></div>
	{:else}
		<h2 class="eyebrow section">Sign-ups</h2>
		<div class="glass group">
			{#if s.signup.hardClosed}
				<div class="item col">
					<b class="danger">Closed on the Worker</b>
					<span class="caption">SIGNUP_MODE=closed is set, so nobody can sign up, even with an invite. Remove the variable to use this switch.</span>
				</div>
			{/if}
			<div class="item">
				<span class="stack" style:--gap="2px">
					<span>{s.signup.mode === 'open' ? 'Open to everyone' : 'Invite only'}</span>
					<span class="caption">{s.signup.mode === 'open' ? 'Anyone can create an account.' : 'New accounts need an invite code. Apple sign-up is off.'}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn small" class:ghost={s.signup.mode === 'open'} onclick={toggleSignups} disabled={busy}>
					{s.signup.mode === 'open' ? 'Make invite-only' : 'Open to everyone'}
				</button>
			</div>
			<div class="item col">
				<span class="row" style:gap="8px">
					<span>New accounts, last 30 days</span><span class="spacer"></span><b class="num">{total}</b>
				</span>
				<DayBars days={s.signupsByDay.map((d) => ({ day: d.day, value: d.count }))} label="New accounts per day" column="New accounts" />
			</div>
		</div>

		<h2 class="eyebrow section">Invite codes</h2>
		<div class="glass group">
			<form class="item col" onsubmit={newInvite}>
				<input type="text" placeholder="Who it’s for (optional)" bind:value={label} maxlength="60" aria-label="Who the invite is for" />
				<span class="row" style:gap="8px" style:flex-wrap="wrap">
					<label class="caption" for="uses">Uses</label>
					<input id="uses" class="n" type="number" min="1" max="100" bind:value={uses} />
					<label class="caption" for="exp">Expires</label>
					<select id="exp" bind:value={expiry}>
						<option value="7">7 days</option>
						<option value="14">14 days</option>
						<option value="30">30 days</option>
						<option value="">Never</option>
					</select>
					<span class="spacer"></span>
					<button class="btn small" disabled={busy}>Create</button>
				</span>
			</form>
			{#each s.invites as inv (inv.code)}
				<div class="item" class:gone={!live(inv)}>
					<span class="stack" style:--gap="2px" style:min-width="0">
						<button class="code" onclick={() => copy(inv.code)} title="Copy">{inv.code}</button>
						<span class="caption">
							{inv.label ? `${inv.label} · ` : ''}{inv.uses} of {inv.maxUses} used ·
							{#if inv.revokedAt}revoked{:else if inv.expiresAt && inv.expiresAt <= Date.now()}expired{:else if inv.expiresAt}until {shortDay(inv.expiresAt)}{:else}no expiry{/if}
						</span>
					</span>
					<span class="spacer"></span>
					{#if !inv.revokedAt}<button class="link danger" onclick={() => revoke(inv)} disabled={busy}>Revoke</button>{/if}
				</div>
			{:else}
				<div class="item caption">No invites yet.</div>
			{/each}
		</div>

		<h2 class="eyebrow section">Sign-in sessions</h2>
		<div class="glass group">
			<form class="item" onsubmit={(e) => (e.preventDefault(), saveDays(Number(days)))}>
				<span class="stack" style:--gap="2px">
					<label for="days">Session lifetime (days)</label>
					<span class="caption">Now {s.session.effectiveDays} days{s.session.days === null ? ' (default)' : ''}. Renewed while the app is used.</span>
				</span>
				<span class="spacer"></span>
				<input id="days" type="number" min="1" max="400" placeholder={String(s.session.defaultDays)} bind:value={days} class="n wide" />
				<button class="btn small" disabled={busy || !days || Number(days) === s.session.days}>Save</button>
			</form>
			{#if s.session.days !== null}
				<div class="item"><button class="link" onclick={() => saveDays(null)} disabled={busy}>Use the default ({s.session.defaultDays} days)</button></div>
			{/if}
		</div>
		<p class="caption" style:text-align="center">Switching sign-ups and changing the lifetime ask for your passkey. Every change is in the audit log.</p>
	{/if}
</main>

<style>
	.code {
		font: 600 15px ui-monospace, 'SF Mono', Menlo, monospace;
		letter-spacing: 0.04em;
		background: none;
		border: 0;
		padding: 0;
		color: inherit;
		text-align: left;
		cursor: copy;
	}
	.fleet input.n {
		flex: none;
		box-sizing: border-box;
		width: 64px;
		padding: 8px 4px;
		text-align: center;
	}
	.fleet input.n.wide {
		width: 76px;
	}
	.gone {
		opacity: 0.55;
	}
	select {
		font: inherit;
		padding: 8px 10px;
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: inherit;
	}
</style>
