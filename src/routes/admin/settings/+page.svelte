<!--
	Fleet console: sign-up mode and session lifetime. Invites and VIPs are in
	Invitations (src/routes/admin/invitations).
	Switching sign-ups and changing the session lifetime ask for a passkey tap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart, Button, Columns, FieldRow, LargeTitle, ListGroup, ListRow, SectionHeader, Skeleton, TextField } from '#lib/ui/index.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, getSettings, setSessionDays, setSignupMode } from '#lib/admin/client.ts';
	import type { AdminSettings } from '#lib/admin/contract.ts';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let s = $state<AdminSettings | null>(null);
	let error = $state<AdminError | null>(null);
	/** which action's request is running ('signup', 'days', 'default'), or null */
	let pending = $state<string | null>(null);
	const busy = $derived(pending !== null);
	let days = $state('');
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

	const total = $derived(s?.signupsByDay.reduce((n, d) => n + d.count, 0) ?? 0);
</script>

<svelte:head><title>Sign-up settings · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Sign-up settings" />

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


		<p class="caption" style:text-align="center">Invite codes and VIP links are in <a href="/admin/invitations">Invitations</a>. Switching sign-ups and changing the lifetime ask for your passkey. Every change is in the audit log.</p>
	{/if}
</main>

<style>
	.inline-form :global(.field-row) {
		align-items: center;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
</style>
