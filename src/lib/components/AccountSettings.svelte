<!--
	Account (docs/AI-PLAN.md wave 2, phase A): passkey accounts, plus Sign in
	with Apple when the server has it set up. Signed out: sign in with a
	passkey or Apple, create an account, or use a recovery code. Signed in:
	name, passkeys, Apple ID, recovery code, sign out, delete account. Your AI
	keys belong to the account.
-->
<script lang="ts">
	import { t, fmtDate } from '#lib/i18n/index.svelte.ts';
	import * as api from '#lib/ai/client.ts';
	import type { PasskeyInfo } from '#lib/ai/contract.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import AppleButton from './AppleButton.svelte';
	import PromoCode from './PromoCode.svelte';
	import { SectionHeader } from '#lib/ui/index.ts';
	import BetaConsent from '#lib/components/BetaConsent.svelte';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';
	import { Badge, Button, FieldRow, ListGroup, ListRow, Segmented, TextField } from '#lib/ui/index.ts';
	import { plan } from '#lib/state/plan.svelte.ts';

	let { onchange }: { onchange: () => void | Promise<void> } = $props();

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
	let busy = $state(false);
	/** Which action is running, so its own button shows the spinner. */
	let pending = $state('');
	let name = $state('');
	let invite = $state('');
	let recoverInput = $state('');
	let recoveryCode = $state<string | null>(null);
	let passkeys = $state<PasskeyInfo[]>([]);
	let mode = $state<'signin' | 'create'>('signin');

	$effect(() => {
		if (ai.signedIn) {
			void loadPasskeys();
			mode = 'signin'; // after signing out, offer Sign in first
		} else passkeys = [];
	});

	async function loadPasskeys() {
		try {
			passkeys = await api.listPasskeys();
		} catch {
			/* shown again on next refresh */
		}
	}

	async function guard<T>(fn: () => Promise<T>, ok?: string, key = ''): Promise<T | undefined> {
		busy = true;
		pending = key;
		try {
			const r = await fn();
			if (ok) {
				haptic('success');
				toast(ok, '✓');
			}
			return r;
		} catch (e) {
			// the user closed the passkey sheet: not an error worth a toast
			if ((e as Error)?.name === 'NotAllowedError') return;
			haptic('error');
			toast(e instanceof Error ? e.message : t('welcome.error'), '⚠️', 2800);
		} finally {
			busy = false;
			pending = '';
		}
	}
	async function after() {
		await ai.refresh();
		await onchange();
	}

	async function signIn() {
		const r = await guard(() => api.signIn(), undefined, 'signin');
		if (r?.account) toast(t('welcome.back', { name: r.account.name }), '👋');
		await after();
	}
	async function create() {
		const n = name.trim();
		if (!n) return;
		const r = await guard(() => api.registerPasskey(n, !ai.signupOpen ? invite.trim() : undefined), t('account.created'), 'create');
		if (r) {
			recoveryCode = r.recoveryCode ?? null;
			name = '';
			await after();
		}
	}
	async function addPasskey() {
		const r = await guard(() => api.registerPasskey(), t('account.passkeyAdded'), 'addPasskey');
		if (r) {
			await after();
			await loadPasskeys();
		}
	}
	async function removePasskey(p: PasskeyInfo) {
		const label = p.name ?? t('account.thisPasskey');
		if (!(await confirmDestructive(t('account.removeTitle', { label }), t('account.removeBody'), t('account.removeConfirm')))) return;
		await guard(() => api.deletePasskey(p.id), t('account.passkeyRemoved'), `rmPasskey${p.id}`);
		await loadPasskeys();
		if (p.current) await after();
	}
	async function useRecovery() {
		const r = await guard(() => api.recover(recoverInput.trim()), undefined, 'recover');
		if (r) {
			recoverInput = '';
			toast(t('account.recovered'), '🔑', 2800);
			await after();
		}
	}
	async function disconnectApple() {
		if (!(await confirmDestructive(t('account.appleOffTitle'), t('account.appleOffBody'), t('account.disconnect')))) return;
		const r = await guard(() => api.disconnectApple(), t('account.appleOff'), 'appleOff');
		if (r) await after();
	}
	async function newCode() {
		if (!(await confirmDestructive(t('account.newCodeTitle'), t('account.newCodeBody'), t('account.newCodeConfirm')))) return;
		const r = await guard(() => api.newRecoveryCode(), undefined, 'newCode');
		if (r) recoveryCode = r.recoveryCode;
	}
	async function rename() {
		const n = prompt(t('account.yourName'), ai.account?.name ?? '');
		if (!n?.trim()) return;
		await guard(() => api.renameAccount(n.trim()), t('account.renamed'), 'rename');
		await ai.refresh();
	}
	async function signOut() {
		await guard(() => api.signOut(), t('account.signedOut'), 'signout');
		recoveryCode = null;
		await after();
	}
	async function deleteAccount() {
		if (
			!(await confirmDestructive(
				t('account.deleteTitle'),
				t('account.deleteBody'),
				t('account.deleteConfirm')
			))
		)
			return;
		await guard(() => api.deleteAccount(), t('account.deleted'), 'delete');
		recoveryCode = null;
		await after();
	}
	// ------------------------------------------------------------ beta data --
	let showTerms = $state(false);
	async function downloadData() {
		await guard(() => api.downloadBetaData(), t('beta.downloadStarted'), 'download');
	}
	async function deleteData() {
		if (
			!(await confirmDestructive(
				t('beta.deleteTitle'),
				t('beta.deleteBody'),
				t('beta.deleteConfirm')
			))
		)
			return;
		// drop what the app hasn't uploaded yet, and let an upload in flight land first
		await guard(async () => (await telemetry.discard(), api.deleteBetaData()), t('beta.deleted'), 'deleteData');
	}
	async function withdraw() {
		if (
			!(await confirmDestructive(
				t('beta.withdrawTitle'),
				t('beta.withdrawBody'),
				t('beta.withdrawConfirm')
			))
		)
			return;
		await guard(async () => (await telemetry.discard(), api.withdrawConsent()), t('beta.withdrawn'), 'withdraw');
		await after();
	}

	async function copyCode() {
		if (!recoveryCode) return;
		try {
			await navigator.clipboard.writeText(recoveryCode);
			toast(t('account.codeCopied'), '📋');
		} catch {
			/* still visible on screen */
		}
	}

	const day = (ms: number) => fmtDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
	const initial = $derived((ai.account?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
</script>

<h2 class="eyebrow section" id="account">{t('account.section')}</h2>

<!-- data-sveltekit-reload: the /admin row needs a full page load so Cloudflare Access can run its sign-in. -->
<div class="acct" data-sveltekit-reload>
	<ListGroup>
		{#if !supported}
			<ListRow subtitle={t('account.noPasskeys')} />
		{:else if ai.signedIn && ai.account}
			<ListRow>
				{#snippet leading()}<span class="avatar" aria-hidden="true">{initial}</span>{/snippet}
				<b>{ai.account.name}</b>
				<span class="caption">
					{#if ai.account.recovery}{t('account.viaRecovery')}{:else if ai.account.via === 'apple'}{t('account.viaApple')}{:else}{t('account.viaPasskey')}{/if}{ai.account.isAdmin ? ` · ${t('account.admin')}` : ''}
				</span>
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={rename} disabled={busy} busy={pending === 'rename'}>{t('account.rename')}</Button>
					<Button variant="ghost" size="sm" onclick={signOut} disabled={busy} busy={pending === 'signout'}>{t('account.signOut')}</Button>
				{/snippet}
			</ListRow>
			{#if ai.account.isAdmin && !ai.account.recovery}
				<ListRow title={t('account.fleet')} href="/admin" />
			{/if}
			{#if ai.account.recovery}
				<ListRow class="acct-warn" subtitle={t('account.recoveryWarn')}>
					{#snippet trailing()}
						<Button size="sm" onclick={addPasskey} disabled={busy} busy={pending === 'addPasskey'}>{t('account.addPasskey')}</Button>
					{/snippet}
				</ListRow>
			{/if}
		{:else}
			<ListRow>
				<Segmented
					label={t('account.section')}
					bind:value={mode}
					options={[
						{ value: 'signin', label: t('account.signIn') },
						{ value: 'create', label: t('account.create'), disabled: !ai.signupOpen && !ai.signupInvite }
					]}
				/>
			</ListRow>
			{#if mode === 'signin'}
				<ListRow subtitle={t('account.signInHelp')} />
				<ListRow>
					<Button block onclick={signIn} disabled={busy} busy={pending === 'signin'}>{t('account.signInPasskey')}</Button>
				</ListRow>
				{#if ai.appleEnabled}<ListRow><AppleButton label={t('apple.signIn')} disabled={busy} /></ListRow>{/if}
				<ListRow>
					<details>
						<summary class="caption">{t('account.lost')}</summary>
						<div class="lost">
							<FieldRow as="form" onsubmit={useRecovery}>
								<TextField
									grow
									placeholder={t('account.recoveryCode')}
									bind:value={recoverInput}
									autocomplete="off"
									autocapitalize="characters"
									aria-label={t('account.recoveryCode')}
								/>
								<Button variant="ghost" type="submit" disabled={busy || !recoverInput.trim()} busy={pending === 'recover'}>{t('account.use')}</Button>
							</FieldRow>
						</div>
					</details>
				</ListRow>
			{:else}
				<ListRow subtitle={t('account.createHelp')} />
				{#if !ai.signupOpen}
					<ListRow>
						<TextField
							placeholder={t('account.invite')}
							bind:value={invite}
							maxlength={20}
							autocomplete="off"
							autocapitalize="characters"
							aria-label={t('account.invite')}
						/>
					</ListRow>
				{/if}
				<ListRow>
					<FieldRow as="form" onsubmit={create}>
						<TextField grow placeholder={t('account.yourName')} bind:value={name} maxlength={40} autocomplete="nickname" aria-label={t('account.yourName')} />
						<Button type="submit" disabled={busy || !name.trim() || (!ai.signupOpen && !invite.trim())} busy={pending === 'create'}>{t('account.createBtn')}</Button>
					</FieldRow>
				</ListRow>
				{#if ai.appleEnabled && ai.signupOpen}<ListRow><AppleButton disabled={busy} /></ListRow>{/if}
			{/if}
			{#if !ai.signupOpen}<ListRow subtitle={ai.signupInvite ? t('account.inviteOnly') : t('account.signupClosed')} />{/if}
		{/if}
		{#if recoveryCode}
			<ListRow class="acct-recovery">
				<span class="stack" style:--gap="var(--space-1)">
					<b>{t('account.codeOnce')}</b>
					<code>{recoveryCode}</code>
					<span class="caption">{t('account.codeHelp')}</span>
				</span>
				{#snippet trailing()}
					<span class="stack" style:--gap="var(--space-1h)">
						<Button variant="ghost" size="sm" onclick={copyCode}>{t('common.copy')}</Button>
						<Button variant="ghost" size="sm" onclick={() => (recoveryCode = null)}>{t('common.done')}</Button>
					</span>
				{/snippet}
			</ListRow>
		{/if}
	</ListGroup>
</div>

{#if ai.signedIn && ai.account}
	<h3 class="eyebrow section">{ai.appleEnabled || ai.account.appleLinked ? t('account.waysIn') : t('account.passkeys')}</h3>
	<ListGroup>
		{#each passkeys as p (p.id)}
			<ListRow subtitle="{t('account.added', { date: day(p.createdAt) })}{p.lastUsedAt ? ` · ${t('account.used', { date: day(p.lastUsedAt) })}` : ''}{p.backedUp ? ` · ${t('account.synced')}` : ''}">
				{#snippet leading()}<span class="key-ico" aria-hidden="true">🔑</span>{/snippet}
				<span>{p.name ?? t('account.passkey')}{#if p.current}<span class="badge"><Badge tone="success">{t('account.thisDevice')}</Badge></span>{/if}</span>
				{#snippet trailing()}
					<Button
						variant="ghost-danger"
						size="sm"
						onclick={() => removePasskey(p)}
						disabled={busy || (passkeys.length < 2 && !ai.account?.appleLinked)}
						busy={pending === `rmPasskey${p.id}`}
						aria-label={t('account.removeAria', { name: p.name ?? t('account.passkey') })}>{t('account.remove')}</Button
					>
				{/snippet}
			</ListRow>
		{/each}
		<ListRow subtitle={t('account.addAnother')}>
			{#snippet trailing()}
				<Button variant="ghost" size="sm" onclick={addPasskey} disabled={busy} busy={pending === 'addPasskey'}>{t('account.addPasskey')}</Button>
			{/snippet}
		</ListRow>
		{#if ai.appleEnabled || ai.account.appleLinked}
			<ListRow title={t('apple.signIn')} subtitle={ai.account.appleLinked ? (passkeys.length ? t('account.appleOn') : t('account.appleOnNoPasskey')) : t('account.appleHelp')}>
				{#snippet leading()}
					<span class="key-ico" aria-hidden="true"><svg viewBox="0 0 17 20" width="16" height="18" fill="currentColor"><path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.8 1 7.5c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 2 2.7 3.4 2.7 1.3-.1 1.9-.9 3.5-.9s2.1.9 3.5.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.5 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"/></svg></span>
				{/snippet}
				{#snippet trailing()}
					{#if ai.account?.appleLinked}
						<Button variant="ghost-danger" size="sm" onclick={disconnectApple} disabled={busy || !passkeys.length} busy={pending === 'appleOff'}>{t('account.disconnect')}</Button>
					{:else}
						<AppleButton label={t('account.connect')} link small disabled={busy} />
					{/if}
				{/snippet}
			</ListRow>
		{/if}
		{#if !ai.account.recovery}
			<ListRow subtitle={t('account.lostCode')}>
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={newCode} disabled={busy} busy={pending === 'newCode'}>{t('account.newCode')}</Button>
				{/snippet}
			</ListRow>
		{/if}
		<ListRow>
			<Button variant="ghost-danger" block onclick={deleteAccount} disabled={busy} busy={pending === 'delete'}>{t('account.delete')}</Button>
		</ListRow>
	</ListGroup>

	<div id="promo"><SectionHeader title={t('promo.section')} level={3} /></div>
	<PromoCode onredeemed={(r) => plan.set(r)} />

	{#if ai.beta?.acceptedAt && !ai.needsConsent}
		<h3 class="eyebrow section" id="beta-data">{t('beta.section')}</h3>
		<ListGroup>
			<ListRow title={t('beta.sharing')} subtitle={t('beta.agreedKept', { date: day(ai.beta.acceptedAt), days: ai.beta.retentionDays })}>
				{#snippet leading()}<span class="key-ico" aria-hidden="true">🧪</span>{/snippet}
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={() => (showTerms = true)}>{t('beta.details')}</Button>
				{/snippet}
			</ListRow>
			<ListRow subtitle={t('beta.copyHelp')}>
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={downloadData} disabled={busy} busy={pending === 'download'}>{t('beta.download')}</Button>
				{/snippet}
			</ListRow>
			<ListRow subtitle={t('beta.deleteHelp')}>
				{#snippet trailing()}
					<Button variant="ghost-danger" size="sm" onclick={deleteData} disabled={busy} busy={pending === 'deleteData'}>{t('beta.deleteData')}</Button>
				{/snippet}
			</ListRow>
			<ListRow>
				<Button variant="ghost-danger" block onclick={withdraw} disabled={busy} busy={pending === 'withdraw'}>{t('beta.withdraw')}</Button>
			</ListRow>
		</ListGroup>
	{/if}
{/if}

{#if showTerms}
	<BetaConsent review onclose={() => (showTerms = false)} />
{/if}

<style>
	.section {
		margin: var(--space-4) var(--space-1h) var(--space-px);
	}
	.lost {
		margin-top: var(--space-2);
	}
	.acct :global(.acct-recovery),
	.acct :global(.acct-warn) {
		background: color-mix(in srgb, var(--warn) 14%, transparent);
	}
	.avatar {
		display: grid;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		place-items: center;
		font-weight: 700;
		font-size: 1.125rem;
		color: #fff;
		background: linear-gradient(135deg, #ff7a5c, #e8432e 55%, #b8264f);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
	}
	.key-ico {
		display: block;
		width: 30px;
		text-align: center;
	}
	.badge {
		margin-left: var(--space-2);
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 1rem;
		letter-spacing: 0.04em;
		word-break: break-all;
	}
	details summary {
		cursor: pointer;
	}
</style>
