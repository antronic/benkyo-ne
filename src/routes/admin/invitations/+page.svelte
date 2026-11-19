<!--
	Fleet console: invitations. A VIP is a named invite (/invite/VIP) with a card
	(note, who it's from, handwriting) and, if you like, a promo code the link
	uses without ?coupon=. VIPs are made only here. Plain invite codes (random
	BK-XXXX-XXXX) are for handing out by hand. Editing a VIP and revoking ask
	for a passkey tap; everything is in the audit log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Badge,
		Button,
		Columns,
		FieldRow,
		InkPad,
		InviteCard,
		LargeTitle,
		ListGroup,
		ListRow,
		SectionHeader,
		Select,
		Sheet,
		Skeleton,
		Spinner,
		TextArea,
		TextField,
		emptyInk,
		type Ink
	} from '#lib/ui/index.ts';
	import { CARD_FROM_MAX, CARD_NOTE_MAX } from '#lib/invite/contract.ts';
	import type { AdminPromo } from '#lib/promo/contract.ts';
	import ErrorCard from '#lib/admin/ErrorCard.svelte';
	import FleetTrail from '#lib/admin/FleetTrail.svelte';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { AdminError, createInvite, listInvites, revokeInvite, updateInvite } from '#lib/admin/client.ts';
	import { listPromos } from '#lib/admin/promos.ts';
	import type { AdminInvite } from '#lib/admin/contract.ts';
	import '#lib/admin/admin.css';

	ui.hue = 200;
	let invites = $state<AdminInvite[] | null>(null);
	let error = $state<AdminError | null>(null);
	/** which request is running ('code', 'vip', 'revoke:<code>'), or null */
	let pending = $state<string | null>(null);
	const busy = $derived(pending !== null);

	async function load() {
		error = null;
		try {
			invites = (await listInvites()).invites;
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

	const live = (i: AdminInvite) => !i.revokedAt && i.uses < i.maxUses && (!i.expiresAt || i.expiresAt > Date.now());
	const shortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	const vips = $derived((invites ?? []).filter((i) => i.card));
	const codes = $derived((invites ?? []).filter((i) => !i.card));
	const linkFor = (code: string) => `${location.origin}/invite/${encodeURIComponent(code)}`;

	const EXPIRY = [
		{ value: '7', label: '7 days' },
		{ value: '14', label: '14 days' },
		{ value: '30', label: '30 days' },
		{ value: '90', label: '90 days' },
		{ value: '', label: 'Never' }
	];

	// ------------------------------------------------------------ promo codes for VIPs --
	let promos = $state<AdminPromo[] | null>(null);
	let planNames = $state<Record<string, string>>({});
	let promosFailed = $state(false);
	async function loadPromos() {
		promosFailed = false;
		try {
			const r = await listPromos();
			planNames = Object.fromEntries(r.plans.map((p) => [p.id, p.name]));
			promos = r.promos;
		} catch {
			promosFailed = true;
		}
	}
	const perkOf = (p: AdminPromo) => `${planNames[p.plan] ?? p.plan} ${p.kind === 'trial' ? 'trial' : 'on us'}${p.days ? ` · ${p.days} days` : ''}`;
	const promoOptions = $derived([
		{ value: '', label: 'No promo code' },
		...(promos ?? [])
			.filter((p) => p.state === 'live' || p.code === vipCoupon)
			.map((p) => ({ value: p.code, label: `${p.code} · ${perkOf(p)}${p.state === 'live' ? '' : ` (${p.state.replace('_', ' ')})`}` }))
	]);

	// ------------------------------------------------------------ VIP editor --
	/** null: closed; 'new': making one; otherwise the VIP being edited */
	let editing = $state<'new' | AdminInvite | null>(null);
	let vipName = $state('');
	let vipLabel = $state('');
	let vipNote = $state('');
	let vipFrom = $state('');
	let vipInk = $state<Ink>(emptyInk());
	let vipCoupon = $state('');
	let vipUses = $state('50');
	let vipExpiry = $state('');
	let vipError = $state('');
	let preview = $state(false);
	const editName = $derived(editing === 'new' ? vipName.trim().toUpperCase() : (editing?.code ?? ''));
	const previewPerk = $derived.by(() => {
		const p = promos?.find((x) => x.code === vipCoupon);
		return p ? perkOf(p) : null;
	});

	function openVip(inv: AdminInvite | 'new') {
		editing = inv;
		vipError = '';
		vipName = '';
		vipLabel = '';
		vipUses = '50';
		vipExpiry = '';
		vipNote = inv === 'new' ? '' : (inv.card?.note ?? '');
		vipFrom = inv === 'new' ? '' : (inv.card?.from ?? '');
		vipInk = inv === 'new' ? emptyInk() : (inv.card?.ink ?? emptyInk());
		vipCoupon = inv === 'new' ? '' : (inv.coupon ?? '');
		if (!promos) void loadPromos();
	}

	async function saveVip() {
		if (!editing || !invites) return;
		if (editing === 'new' && !vipName.trim()) {
			vipError = 'Give the VIP a name: it becomes the link, /invite/NAME.';
			return;
		}
		if (!vipNote.trim()) {
			vipError = 'Write a note for the card.';
			return;
		}
		vipError = '';
		const card = { note: vipNote.trim(), from: vipFrom.trim(), ink: vipInk.strokes.length ? vipInk : null };
		const coupon = vipCoupon || null;
		const r =
			editing === 'new'
				? await act(
						'vip',
						() => createInvite({ code: vipName.trim(), label: vipLabel.trim() || undefined, maxUses: Number(vipUses) || 1, expiresInDays: Number(vipExpiry) || null, card, coupon }),
						'VIP created'
					)
				: await act('vip', () => updateInvite((editing as AdminInvite).code, { card, coupon }), 'VIP saved');
		if (!r) return;
		invites = editing === 'new' ? [r, ...invites] : invites.map((i) => (i.code === r.code ? r : i));
		if (editing === 'new') void copy(r.code, true);
		editing = null;
	}

	// ------------------------------------------------------------ plain codes --
	let label = $state('');
	let uses = $state('1');
	let expiry = $state('14');
	async function newCode(e: SubmitEvent) {
		e.preventDefault();
		const inv = await act('code', () => createInvite({ label: label.trim() || undefined, maxUses: Number(uses) || 1, expiresInDays: Number(expiry) || null }), 'Invite code created');
		if (inv && invites) {
			invites = [inv, ...invites];
			label = '';
			void copy(inv.code);
		}
	}

	async function copy(code: string, link = false) {
		try {
			await navigator.clipboard.writeText(link ? linkFor(code) : code);
			toast(link ? 'Link copied' : 'Code copied', '📋');
		} catch {
			/* still on screen */
		}
	}
	async function revoke(inv: AdminInvite) {
		if (!(await confirmDestructive(`Revoke ${inv.code}?`, 'Nobody can sign up with it after this, and its link stops showing the card.', 'Revoke'))) return;
		const key = `revoke:${inv.code}`;
		if (!(await act(key, () => revokeInvite(inv.code), 'Invite revoked'))) return;
		// keep the Revoke button spinning while the list reloads
		pending = key;
		await load();
		pending = null;
	}
	const usage = (inv: AdminInvite) =>
		`${inv.uses} of ${inv.maxUses} used · ${inv.revokedAt ? 'revoked' : inv.expiresAt && inv.expiresAt <= Date.now() ? 'expired' : inv.expiresAt ? `until ${shortDay(inv.expiresAt)}` : 'no expiry'}`;
</script>

<svelte:head><title>Invitations · Fleet</title></svelte:head>

<main class="page stack fleet" style:--gap="var(--space-3)">
	<FleetTrail />
	<LargeTitle title="Invitations" />

	{#if error}
		<ErrorCard {error} onretry={load} />
	{:else if !invites}
		<Skeleton variant="row" count={4} label="Loading invitations" />
	{:else}
		<Columns min="420px">
			<section>
				<SectionHeader title="VIP invites" />
				<ListGroup>
					<ListRow title="A link with your note" subtitle="/invite/NAME shows your card and drawing, then sign-up with the invite filled in. Add a promo code and the link uses it.">
						{#snippet trailing()}<Button size="sm" onclick={() => openVip('new')} disabled={busy}>＋ New VIP</Button>{/snippet}
					</ListRow>
					{#each vips as inv (inv.code)}
						<div class="item col" class:gone={!live(inv)}>
							<span class="row" style:gap="var(--space-2)">
								<span class="code">{inv.code}</span>
								{#if inv.coupon}<Badge tone="violet">{inv.coupon}</Badge>{:else}<Badge>No promo code</Badge>{/if}
							</span>
							<span class="note">“{inv.card?.note}”{inv.card?.from ? ` · ${inv.card.from}` : ''}{inv.card?.ink ? ' · ✍️ drawing' : ''}</span>
							<span class="caption">{inv.label ? `${inv.label} · ` : ''}{usage(inv)}</span>
							<span class="row actions">
								{#if live(inv)}<Button size="sm" variant="ghost" onclick={() => copy(inv.code, true)}>Copy link</Button>{/if}
								{#if live(inv)}<Button size="sm" variant="ghost" onclick={() => openVip(inv)} disabled={busy}>Edit</Button>{/if}
								{#if !inv.revokedAt}<Button size="sm" variant="ghost-danger" onclick={() => revoke(inv)} busy={pending === `revoke:${inv.code}`} disabled={busy}>Revoke</Button>{/if}
							</span>
						</div>
					{:else}
						<ListRow subtitle="No VIPs yet. Make one for a person or a campaign, such as VIP or NEWYEAR27." />
					{/each}
				</ListGroup>
			</section>
			<section>
				<SectionHeader title="Invite codes" />
				<ListGroup>
					<form class="item col" onsubmit={newCode}>
						<span class="caption">A random code (BK-XXXX-XXXX) to hand out. It works in the sign-up sheet’s invite field.</span>
						<TextField placeholder="Who it’s for (optional)" bind:value={label} maxlength={60} aria-label="Who the invite is for" />
						<FieldRow stack="narrow">
							<TextField label="Uses" class="num-field" type="number" min="1" max="100" bind:value={uses} />
							<span class="pick">
								<label class="pick-label" for="exp">Expires</label>
								<Select id="exp" options={EXPIRY} bind:value={expiry} label="Expires" />
							</span>
							<span class="spacer"></span>
							<Button type="submit" busy={pending === 'code'} disabled={busy}>Create</Button>
						</FieldRow>
					</form>
					{#each codes as inv (inv.code)}
						<div class="item" class:gone={!live(inv)}>
							<span class="stack" style:--gap="var(--space-px)" style:min-width="0">
								<span class="code">{inv.code}</span>
								<span class="caption">{inv.label ? `${inv.label} · ` : ''}{usage(inv)}</span>
							</span>
							<span class="spacer"></span>
							<span class="row actions">
								{#if live(inv)}<Button size="sm" variant="ghost" onclick={() => copy(inv.code)}>Copy code</Button>{/if}
								{#if !inv.revokedAt}<Button size="sm" variant="ghost-danger" onclick={() => revoke(inv)} busy={pending === `revoke:${inv.code}`} disabled={busy}>Revoke</Button>{/if}
							</span>
						</div>
					{:else}
						<ListRow subtitle="No invite codes yet." />
					{/each}
				</ListGroup>
			</section>
		</Columns>
		<p class="caption" style:text-align="center">Whether sign-up needs an invite is in <a href="/admin/settings">Sign-up settings</a>. Editing a VIP asks for your passkey.</p>
	{/if}
</main>

<Sheet open={!!editing} label="VIP invite" onclose={() => (editing = null)}>
	{#if editing}
		<div class="stack" style:--gap="var(--space-3)">
			<SectionHeader title={editing === 'new' ? 'New VIP' : `VIP ${editing.code}`} />
			{#if editing === 'new'}
				<TextField
					label="Name"
					placeholder="VIP"
					bind:value={vipName}
					maxlength={20}
					autocapitalize="characters"
					autocomplete="off"
					hint={vipName.trim() ? `Link: ${linkFor(editName)}` : '3 to 20 letters, digits or _. It becomes the link.'}
				/>
				<TextField label="Who it’s for (optional)" bind:value={vipLabel} maxlength={60} placeholder="Friends from the meetup" />
			{:else}
				<span class="caption">Link: {linkFor(editing.code)}</span>
			{/if}
			<TextArea label="Note" bind:value={vipNote} maxlength={CARD_NOTE_MAX} rows={3} placeholder="Saved you a seat. Start with kana, I’ll check in on Friday." />
			<TextField label="From" bind:value={vipFrom} maxlength={CARD_FROM_MAX} placeholder="Job" />
			<InkPad bind:value={vipInk} label="Drawing for the card" placeholder="Write or draw here (optional)" />
			<span class="pick">
				<span class="pick-label">Promo code (optional)</span>
				{#if promos}
					<Select options={promoOptions} bind:value={vipCoupon} label="Promo code" />
				{:else if promosFailed}
					<span class="row" style:gap="var(--space-2)"><span class="caption danger-text">Couldn’t load promo codes.</span><Button size="sm" variant="ghost" onclick={loadPromos}>Try again</Button></span>
				{:else}
					<Spinner size="sm" label="Loading promo codes…" showLabel />
				{/if}
				<span class="caption">Used after sign-up. A ?coupon= in a link you share still wins.</span>
			</span>
			{#if editing === 'new'}
				<FieldRow stack="narrow">
					<TextField label="Uses" class="num-field" type="number" min="1" max="100" bind:value={vipUses} />
					<span class="pick">
						<label class="pick-label" for="vip-exp">Expires</label>
						<Select id="vip-exp" options={EXPIRY} bind:value={vipExpiry} label="Expires" />
					</span>
				</FieldRow>
			{/if}
			{#if vipError}<span class="caption danger-text" role="alert">{vipError}</span>{/if}
			<FieldRow stack="narrow">
				<Button variant="ghost" onclick={() => (preview = true)} disabled={!vipNote.trim()}>Preview</Button>
				<span class="spacer"></span>
				<Button busy={pending === 'vip'} disabled={busy} onclick={saveVip}>{editing === 'new' ? 'Create VIP' : 'Save VIP'}</Button>
			</FieldRow>
		</div>
	{/if}
</Sheet>
<InviteCard
	open={preview}
	code={editName || 'VIP'}
	from={vipFrom}
	note={vipNote}
	ink={vipInk.strokes.length ? vipInk : null}
	perk={previewPerk}
	acceptLabel="Close preview"
	onaccept={() => (preview = false)}
/>

<style>
	.danger-text {
		color: var(--color-danger);
	}
	.code {
		font: 600 15px ui-monospace, 'SF Mono', Menlo, monospace;
		letter-spacing: 0.04em;
		user-select: all;
	}
	.note {
		font-size: var(--text-subhead);
		color: var(--color-text-2);
		overflow-wrap: anywhere;
	}
	.actions {
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.pick {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
	}
	.pick-label {
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
		color: var(--color-text-2);
		padding-left: var(--space-1);
	}
	.gone {
		opacity: 0.55;
	}
</style>
