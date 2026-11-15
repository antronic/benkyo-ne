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
	import BetaConsent from '#lib/components/BetaConsent.svelte';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';

	let { onchange }: { onchange: () => void | Promise<void> } = $props();

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
	let busy = $state(false);
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

	async function guard<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
		busy = true;
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
		}
	}
	async function after() {
		await ai.refresh();
		await onchange();
	}

	async function signIn() {
		const r = await guard(() => api.signIn());
		if (r?.account) toast(t('welcome.back', { name: r.account.name }), '👋');
		await after();
	}
	async function create() {
		const n = name.trim();
		if (!n) return;
		const r = await guard(() => api.registerPasskey(n, !ai.signupOpen ? invite.trim() : undefined), t('account.created'));
		if (r) {
			recoveryCode = r.recoveryCode ?? null;
			name = '';
			await after();
		}
	}
	async function addPasskey() {
		const r = await guard(() => api.registerPasskey(), t('account.passkeyAdded'));
		if (r) {
			await after();
			await loadPasskeys();
		}
	}
	async function removePasskey(p: PasskeyInfo) {
		const label = p.name ?? t('account.thisPasskey');
		if (!(await confirmDestructive(t('account.removeTitle', { label }), t('account.removeBody'), t('account.removeConfirm')))) return;
		await guard(() => api.deletePasskey(p.id), t('account.passkeyRemoved'));
		await loadPasskeys();
		if (p.current) await after();
	}
	async function useRecovery() {
		const r = await guard(() => api.recover(recoverInput.trim()));
		if (r) {
			recoverInput = '';
			toast(t('account.recovered'), '🔑', 2800);
			await after();
		}
	}
	async function disconnectApple() {
		if (!(await confirmDestructive(t('account.appleOffTitle'), t('account.appleOffBody'), t('account.disconnect')))) return;
		const r = await guard(() => api.disconnectApple(), t('account.appleOff'));
		if (r) await after();
	}
	async function newCode() {
		if (!(await confirmDestructive(t('account.newCodeTitle'), t('account.newCodeBody'), t('account.newCodeConfirm')))) return;
		const r = await guard(() => api.newRecoveryCode());
		if (r) recoveryCode = r.recoveryCode;
	}
	async function rename() {
		const n = prompt(t('account.yourName'), ai.account?.name ?? '');
		if (!n?.trim()) return;
		await guard(() => api.renameAccount(n.trim()), t('account.renamed'));
		await ai.refresh();
	}
	async function signOut() {
		await guard(() => api.signOut(), t('account.signedOut'));
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
		await guard(() => api.deleteAccount(), t('account.deleted'));
		recoveryCode = null;
		await after();
	}
	// ------------------------------------------------------------ beta data --
	let showTerms = $state(false);
	async function downloadData() {
		await guard(() => api.downloadBetaData(), t('beta.downloadStarted'));
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
		await guard(async () => (await telemetry.discard(), api.deleteBetaData()), t('beta.deleted'));
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
		await guard(async () => (await telemetry.discard(), api.withdrawConsent()), t('beta.withdrawn'));
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

<div class="glass group">
	{#if !supported}
		<div class="item caption">{t('account.noPasskeys')}</div>
	{:else if ai.signedIn && ai.account}
		<div class="item">
			<span class="avatar" aria-hidden="true">{initial}</span>
			<span class="stack" style:--gap="2px">
				<b>{ai.account.name}</b>
				<span class="caption">
					{#if ai.account.recovery}{t('account.viaRecovery')}{:else if ai.account.via === 'apple'}{t('account.viaApple')}{:else}{t('account.viaPasskey')}{/if}{ai.account.isAdmin ? ` · ${t('account.admin')}` : ''}
				</span>
			</span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={rename} disabled={busy}>{t('account.rename')}</button>
			<button class="btn ghost small" onclick={signOut} disabled={busy}>{t('account.signOut')}</button>
		</div>
		{#if ai.account.isAdmin && !ai.account.recovery}
			<!-- Full page load so Cloudflare Access can run its sign-in for /admin. -->
			<a class="item link-item" href="/admin" data-sveltekit-reload>
				<span>{t('account.fleet')}</span>
				<span class="spacer"></span>
				<span class="caption" aria-hidden="true">›</span>
			</a>
		{/if}
		{#if ai.account.recovery}
			<div class="item warn">
				<span class="caption">{t('account.recoveryWarn')}</span>
				<span class="spacer"></span>
				<button class="btn small" onclick={addPasskey} disabled={busy}>{t('account.addPasskey')}</button>
			</div>
		{/if}
	{:else}
		<div class="item seg-wrap">
			<div class="seg" role="tablist" aria-label={t('account.section')}>
				<button role="tab" aria-selected={mode === 'signin'} class:on={mode === 'signin'} onclick={() => (mode = 'signin')}>{t('account.signIn')}</button>
				<button role="tab" aria-selected={mode === 'create'} class:on={mode === 'create'} onclick={() => (mode = 'create')} disabled={!ai.signupOpen && !ai.signupInvite}>{t('account.create')}</button>
			</div>
		</div>
		{#if mode === 'signin'}
			<div class="item caption">{t('account.signInHelp')}</div>
			<div class="item"><button class="btn block" onclick={signIn} disabled={busy}>{t('account.signInPasskey')}</button></div>
			{#if ai.appleEnabled}<div class="item"><AppleButton label={t('apple.signIn')} disabled={busy} /></div>{/if}
			<details class="item">
				<summary class="caption">{t('account.lost')}</summary>
				<div class="row" style="margin-top:8px">
					<input type="text" placeholder={t('account.recoveryCode')} bind:value={recoverInput} autocomplete="off" autocapitalize="characters" aria-label={t('account.recoveryCode')} />
					<button class="btn ghost small" onclick={useRecovery} disabled={busy || !recoverInput.trim()}>{t('account.use')}</button>
				</div>
			</details>
		{:else}
			<div class="item caption">{t('account.createHelp')}</div>
			{#if !ai.signupOpen}
				<div class="item"><input type="text" placeholder={t('account.invite')} bind:value={invite} maxlength="20" autocomplete="off" autocapitalize="characters" aria-label={t('account.invite')} /></div>
			{/if}
			<form class="item row" onsubmit={(e) => (e.preventDefault(), create())}>
				<input type="text" placeholder={t('account.yourName')} bind:value={name} maxlength="40" autocomplete="nickname" aria-label={t('account.yourName')} />
				<button class="btn small" disabled={busy || !name.trim() || (!ai.signupOpen && !invite.trim())}>{t('account.createBtn')}</button>
			</form>
			{#if ai.appleEnabled && ai.signupOpen}<div class="item"><AppleButton disabled={busy} /></div>{/if}
		{/if}
		{#if !ai.signupOpen}<div class="item caption">{ai.signupInvite ? t('account.inviteOnly') : t('account.signupClosed')}</div>{/if}
	{/if}
	{#if recoveryCode}
		<div class="item recovery">
			<span class="stack" style:--gap="4px">
				<b>{t('account.codeOnce')}</b>
				<code>{recoveryCode}</code>
				<span class="caption">{t('account.codeHelp')}</span>
			</span>
			<span class="stack" style:--gap="6px">
				<button class="btn ghost small" onclick={copyCode}>{t('common.copy')}</button>
				<button class="btn ghost small" onclick={() => (recoveryCode = null)}>{t('common.done')}</button>
			</span>
		</div>
	{/if}
</div>

{#if ai.signedIn && ai.account}
	<h3 class="eyebrow section">{ai.appleEnabled || ai.account.appleLinked ? t('account.waysIn') : t('account.passkeys')}</h3>
	<div class="glass group">
		{#each passkeys as p (p.id)}
			<div class="item">
				<span class="key-ico" aria-hidden="true">🔑</span>
				<span class="stack" style:--gap="2px">
					<span>{p.name ?? t('account.passkey')}{#if p.current}<span class="badge">{t('account.thisDevice')}</span>{/if}</span>
					<span class="caption">{t('account.added', { date: day(p.createdAt) })}{p.lastUsedAt ? ` · ${t('account.used', { date: day(p.lastUsedAt) })}` : ''}{p.backedUp ? ` · ${t('account.synced')}` : ''}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={() => removePasskey(p)} disabled={busy || (passkeys.length < 2 && !ai.account.appleLinked)} aria-label={t('account.removeAria', { name: p.name ?? t('account.passkey') })}>{t('account.remove')}</button>
			</div>
		{/each}
		<div class="item">
			<span class="caption">{t('account.addAnother')}</span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={addPasskey} disabled={busy}>{t('account.addPasskey')}</button>
		</div>
		{#if ai.appleEnabled || ai.account.appleLinked}
			<div class="item">
				<span class="key-ico" aria-hidden="true"><svg viewBox="0 0 17 20" width="16" height="18" fill="currentColor"><path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.8 1 7.5c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 2 2.7 3.4 2.7 1.3-.1 1.9-.9 3.5-.9s2.1.9 3.5.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.5 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"/></svg></span>
				<span class="stack" style:--gap="2px">
					<span>{t('apple.signIn')}</span>
					<span class="caption">
						{#if ai.account.appleLinked}{passkeys.length ? t('account.appleOn') : t('account.appleOnNoPasskey')}{:else}{t('account.appleHelp')}{/if}
					</span>
				</span>
				<span class="spacer"></span>
				{#if ai.account.appleLinked}
					<button class="btn ghost small danger" onclick={disconnectApple} disabled={busy || !passkeys.length}>{t('account.disconnect')}</button>
				{:else}
					<AppleButton label={t('account.connect')} link small disabled={busy} />
				{/if}
			</div>
		{/if}
		{#if !ai.account.recovery}
			<div class="item">
				<span class="caption">{t('account.lostCode')}</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={newCode} disabled={busy}>{t('account.newCode')}</button>
			</div>
		{/if}
		<div class="item"><button class="btn ghost block danger" onclick={deleteAccount} disabled={busy}>{t('account.delete')}</button></div>
	</div>

	{#if ai.beta?.acceptedAt && !ai.needsConsent}
		<h3 class="eyebrow section" id="beta-data">{t('beta.section')}</h3>
		<div class="glass group">
			<div class="item">
				<span class="key-ico" aria-hidden="true">🧪</span>
				<span class="stack" style:--gap="2px">
					<span>{t('beta.sharing')}</span>
					<span class="caption">{t('beta.agreedKept', { date: day(ai.beta.acceptedAt), days: ai.beta.retentionDays })}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={() => (showTerms = true)}>{t('beta.details')}</button>
			</div>
			<div class="item">
				<span class="caption">{t('beta.copyHelp')}</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={downloadData} disabled={busy}>{t('beta.download')}</button>
			</div>
			<div class="item">
				<span class="caption">{t('beta.deleteHelp')}</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={deleteData} disabled={busy}>{t('beta.deleteData')}</button>
			</div>
			<div class="item"><button class="btn ghost block danger" onclick={withdraw} disabled={busy}>{t('beta.withdraw')}</button></div>
		</div>
	{/if}
{/if}

{#if showTerms}
	<BetaConsent review onclose={() => (showTerms = false)} />
{/if}

<style>
	.section {
		margin: 16px 6px 2px;
	}
	.group {
		padding: 4px 0;
		border-radius: var(--r-m);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		min-height: 48px;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	a.link-item {
		color: inherit;
		text-decoration: none;
	}
	details.item {
		display: block;
	}
	.item .row {
		--gap: 10px;
		display: flex;
		gap: 10px;
		align-items: stretch;
		width: 100%;
	}
	form.item {
		align-items: stretch;
	}
	.item input[type='text'] {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 1rem;
		height: 48px;
		min-height: 48px;
		padding: 0 14px;
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: var(--ink);
		box-sizing: border-box;
	}
	.item .row .btn,
	form.item .btn {
		flex: none;
		min-height: 48px;
	}
	.recovery {
		background: color-mix(in srgb, var(--warn) 14%, transparent);
	}
	.item .btn {
		flex: none;
		white-space: nowrap;
	}
	.item > .stack {
		min-width: 0;
	}
	.avatar {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 1.125rem;
		color: #fff;
		background: linear-gradient(135deg, #ff7a5c, #e8432e 55%, #b8264f);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
	}
	.key-ico {
		flex: none;
		width: 30px;
		text-align: center;
	}
	.badge {
		margin-left: 8px;
		padding: 1px 7px;
		border-radius: 8px;
		font-size: 0.6875rem;
		font-weight: 600;
		vertical-align: 1px;
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}
	.warn {
		background: color-mix(in srgb, var(--warn) 14%, transparent);
	}
	.seg-wrap {
		padding-bottom: 4px;
	}
	.seg {
		display: flex;
		width: 100%;
		padding: 2px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.seg button {
		flex: 1;
		height: 32px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 200ms, box-shadow 200ms;
	}
	.seg button.on {
		background: color-mix(in srgb, var(--ink) 14%, var(--glass-strong));
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.12);
	}
	.seg button:disabled {
		opacity: 0.4;
	}
	.recovery code {
		font-family: ui-monospace, monospace;
		font-size: 1rem;
		letter-spacing: 0.04em;
		word-break: break-all;
	}
	.danger {
		color: var(--danger);
	}
	details summary {
		cursor: pointer;
	}
</style>
