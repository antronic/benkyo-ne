<!--
	Fleet console: sign-ups, invite codes and session lifetime.
	Switching sign-ups and changing the session lifetime ask for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart, Button, Columns, FieldRow, LargeTitle, ListGroup, ListRow, SectionHeader, Select, Skeleton, TextField } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, createInvite, getSettings, revokeInvite, setSessionDays, setSignupMode } from '#lib/admin/client.ts';
	import type { AdminInvite, AdminSettings } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let s = $state<AdminSettings | null>(null);
	let error = $state<AdminError | null>(null);
	/** which action's request is running ('signup', 'invite', 'days', 'default', 'revoke:<code>'), or null */
	let pending = $state<string | null>(null);
	const busy = $derived(pending !== null);
	let days = $state('');
	let label = $state('');
	/** optional name such as VIP, for /invite/vip links; empty: a random code */
	let inviteName = $state('');
	let uses = $state('1');
	let expiry = $state('14');
	const EXPIRY = [
		{ value: '7', label: '7 days' },
		{ value: '14', label: '14 days' },
		{ value: '30', label: '30 days' },
		{ value: '', label: 'Never' }
	];

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

	async function act<T>(key: string, fn: () => Promise<T>, done: string): Promise<T | undefined> {
		pending = key;
		try {
			const r = await fn();
			toast(done, '✓');
			return r;
		} catch (e) {
			toast(e instanceof AdminError ? e.message : 'Passkey confirmation cancelled', '⚠️', 2600);
		} finally {
			pending = null;
		}
	}

	async function toggleSignups() {
		if (!s) return;
		const to = s.signup.mode === 'open' ? 'closed' : 'open';
		if (to === 'closed' && !(await confirmDestructive('Make sign-ups invite-only?', 'New people need an invite code to create an account. Apple sign-up stops.', 'Invite only')))
			return;
		const r = await act('signup', () => setSignupMode(to), to === 'open' ? 'Sign-ups are open' : 'Sign-ups are invite-only');
		if (r) s = r;
	}
	async function saveDays(value: number | null) {
		const r = await act(value === null ? 'default' : 'days', () => setSessionDays(value), value === null ? 'Back to the default' : 'Session lifetime saved');
		if (r) {
			s = r;
			days = r.session.days === null ? '' : String(r.session.days);
		}
	}
	async function newInvite(e: SubmitEvent) {
		e.preventDefault();
		const inv = await act(
			'invite',
			() => createInvite({ code: inviteName.trim() || undefined, label: label.trim() || undefined, maxUses: Number(uses) || 1, expiresInDays: Number(expiry) || null }),
			'Invite created'
		);
		if (inv && s) {
			s.invites = [inv, ...s.invites];
			label = '';
			inviteName = '';
			void copy(inv.code);
		}
	}
	async function copy(code: string, link = false) {
		try {
			await navigator.clipboard.writeText(link ? `${location.origin}/invite/${encodeURIComponent(code)}` : code);
			toast(link ? 'Sign-up link copied' : 'Code copied', '📋');
		} catch {
			/* still on screen */
		}
	}
	async function revoke(inv: AdminInvite) {
		if (!(await confirmDestructive(`Revoke ${inv.code}?`, 'Nobody can sign up with it after this.', 'Revoke'))) return;
		const key = `revoke:${inv.code}`;
		if (!(await act(key, () => revokeInvite(inv.code), 'Invite revoked'))) return;
		// keep the Revoke button spinning while the list reloads
		pending = key;
		await load();
		pending = null;
	}

	const live = (i: AdminInvite) => !i.revokedAt && i.uses < i.maxUses && (!i.expiresAt || i.expiresAt > Date.now());
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

	const total = $derived(s?.signupsByDay.reduce((n, d) => n + d.count, 0) ?? 0);
</script>

<svelte:head><title>Sign-ups and settings · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Sign-ups and sessions" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !s}
		<Skeleton variant="row" count={4} label="Loading settings" />
	{:else}
		<Columns min="420px">
			<section>
				<SectionHeader title="Sign-ups" />
				<ListGroup>
					{#if s.signup.hardClosed}
						<div class="item col">
							<b class="danger">Closed on the Worker</b>
							<span class="caption">SIGNUP_MODE=closed is set, so nobody can sign up, even with an invite. Remove the variable to use this switch.</span>
						</div>
					{/if}
					<ListRow
						title={s.signup.mode === 'open' ? 'Open to everyone' : 'Invite only'}
						subtitle={s.signup.mode === 'open' ? 'Anyone can create an account.' : 'New accounts need an invite code. Apple sign-up is off.'}
					>
						{#snippet trailing()}
							<Button size="sm" variant={s!.signup.mode === 'open' ? 'ghost' : 'primary'} onclick={toggleSignups} busy={pending === 'signup'} disabled={busy}>
								{s!.signup.mode === 'open' ? 'Make invite-only' : 'Open to everyone'}
							</Button>
						{/snippet}
					</ListRow>
					<div class="item col">
						<span class="row" style:gap="var(--space-2)">
							<span>New accounts, last 30 days</span><span class="spacer"></span><b class="num">{total}</b>
						</span>
						<BarChart days={s.signupsByDay.map((d) => ({ day: d.day, value: d.count }))} label="New accounts per day" column="New accounts" />
					</div>
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Invite codes" />
				<ListGroup>
					<form class="item col" onsubmit={newInvite}>
						<TextField placeholder="Who it’s for (optional)" bind:value={label} maxlength={60} aria-label="Who the invite is for" />
						<TextField
							placeholder="Name, e.g. VIP (optional)"
							bind:value={inviteName}
							maxlength={20}
							autocapitalize="characters"
							autocomplete="off"
							aria-label="Invite name"
							hint={inviteName.trim() ? `Link: ${location.origin}/invite/${inviteName.trim().toUpperCase()}` : 'Leave empty for a random code.'}
						/>
						<FieldRow stack="narrow">
							<TextField label="Uses" class="num-field" type="number" min="1" max="100" bind:value={uses} />
							<span class="pick">
								<label class="pick-label" for="exp">Expires</label>
								<Select id="exp" options={EXPIRY} bind:value={expiry} label="Expires" />
							</span>
							<span class="spacer"></span>
							<Button type="submit" busy={pending === 'invite'} disabled={busy}>Create</Button>
						</FieldRow>
					</form>
					{#each s.invites as inv (inv.code)}
						<div class="item" class:gone={!live(inv)}>
							<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
								<Button variant="link" class="code" onclick={() => copy(inv.code)} title="Copy">{inv.code}</Button>
								<span class="caption">
									{inv.label ? `${inv.label} · ` : ''}{inv.uses} of {inv.maxUses} used ·
									{#if inv.revokedAt}revoked{:else if inv.expiresAt && inv.expiresAt <= Date.now()}expired{:else if inv.expiresAt}until {shortDay(inv.expiresAt)}{:else}no expiry{/if}
								</span>
							</span>
							<span class="spacer"></span>
							{#if live(inv)}<Button variant="link" onclick={() => copy(inv.code, true)}>Copy link</Button>{/if}
							{#if !inv.revokedAt}<Button variant="link" class="danger" onclick={() => revoke(inv)} busy={pending === `revoke:${inv.code}`} disabled={busy}>Revoke</Button>{/if}
						</div>
					{:else}
						<ListRow subtitle="No invites yet." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Sign-in sessions" />
				<ListGroup>
					<div class="item inline-form">
						<FieldRow as="form" onsubmit={() => saveDays(Number(days))}>
							<span class="stack grow" style:--gap="var(--space-px)">
								<label for="days">Session lifetime (days)</label>
								<span class="caption">Now {s.session.effectiveDays} days{s.session.days === null ? ' (default)' : ''}. Renewed while the app is used.</span>
							</span>
							<TextField id="days" class="num-field" type="number" min="1" max="400" placeholder={String(s.session.defaultDays)} bind:value={days} />
							<Button type="submit" busy={pending === 'days'} disabled={busy || !days || Number(days) === s.session.days}>Save</Button>
						</FieldRow>
					</div>
					{#if s.session.days !== null}
						<div class="item">
							<Button variant="link" onclick={() => saveDays(null)} busy={pending === 'default'} disabled={busy}>Use the default ({s.session.defaultDays} days)</Button>
						</div>
					{/if}
				</ListGroup>
			</section>
		</Columns>


		<p class="caption" style:text-align="center">Switching sign-ups and changing the lifetime ask for your passkey. Every change is in the audit log.</p>
	{/if}
</main>

<style>
	.fleet :global(.ui-link.code) {
		font: 600 15px ui-monospace, 'SF Mono', Menlo, monospace;
		letter-spacing: 0.04em;
		color: inherit;
		text-align: left;
		cursor: copy;
	}
	.pick {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
	}
	/* Same look as a TextField label, so "Uses" and "Expires" match. */
	.pick-label {
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
		color: var(--color-text-2);
		padding-left: var(--space-1);
	}
	.inline-form :global(.field-row) {
		align-items: center;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.gone {
		opacity: 0.55;
	}
</style>
