<!--
	Account (docs/AI-PLAN.md wave 2, phase A): passkey-only accounts.
	Signed out: sign in with a passkey, create an account, or use a recovery
	code. Signed in: name, passkeys on this account, recovery code, sign out,
	delete account. Your AI keys belong to the account.
-->
<script lang="ts">
	import * as api from '#lib/ai/client.ts';
	import type { PasskeyInfo } from '#lib/ai/contract.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import BetaConsent from '#lib/components/BetaConsent.svelte';
	import { telemetry } from '#lib/beta/telemetry.svelte.ts';

	let { onchange }: { onchange: () => void | Promise<void> } = $props();

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
	let busy = $state(false);
	let name = $state('');
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
			toast(e instanceof Error ? e.message : 'Something went wrong', '⚠️', 2800);
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
		if (r?.account) toast(`Welcome back, ${r.account.name}`, '👋');
		await after();
	}
	async function create() {
		const n = name.trim();
		if (!n) return;
		const r = await guard(() => api.registerPasskey(n), 'Account created');
		if (r) {
			recoveryCode = r.recoveryCode ?? null;
			name = '';
			await after();
		}
	}
	async function addPasskey() {
		const r = await guard(() => api.registerPasskey(), 'Passkey added');
		if (r) {
			await after();
			await loadPasskeys();
		}
	}
	async function removePasskey(p: PasskeyInfo) {
		const label = p.name ?? 'this passkey';
		if (!(await confirmDestructive(`Remove ${label}?`, 'You won’t be able to sign in with it any more. Also delete it from your password manager.', 'Remove Passkey'))) return;
		await guard(() => api.deletePasskey(p.id), 'Passkey removed');
		await loadPasskeys();
		if (p.current) await after();
	}
	async function useRecovery() {
		const r = await guard(() => api.recover(recoverInput.trim()));
		if (r) {
			recoverInput = '';
			toast('Recovered. Add a new passkey now.', '🔑', 2800);
			await after();
		}
	}
	async function newCode() {
		if (!(await confirmDestructive('Make a new recovery code?', 'Your old recovery code will stop working.', 'New Code'))) return;
		const r = await guard(() => api.newRecoveryCode());
		if (r) recoveryCode = r.recoveryCode;
	}
	async function rename() {
		const n = prompt('Your name', ai.account?.name ?? '');
		if (!n?.trim()) return;
		await guard(() => api.renameAccount(n.trim()), 'Name updated');
		await ai.refresh();
	}
	async function signOut() {
		await guard(() => api.signOut(), 'Signed out');
		recoveryCode = null;
		await after();
	}
	async function deleteAccount() {
		if (
			!(await confirmDestructive(
				'Delete your account?',
				'Your API keys are deleted right away, with your passkey list, AI settings, usage history and beta usage data. Learning progress on this device stays. This can’t be undone.',
				'Delete Account'
			))
		)
			return;
		await guard(() => api.deleteAccount(), 'Account deleted');
		recoveryCode = null;
		await after();
	}
	// ------------------------------------------------------------ beta data --
	let showTerms = $state(false);
	async function downloadData() {
		await guard(() => api.downloadBetaData(), 'Download started');
	}
	async function deleteData() {
		if (
			!(await confirmDestructive(
				'Delete your beta usage data?',
				'Progress events, AI requests and replies, device details and error reports collected so far are deleted. Collection continues from now on while you take part.',
				'Delete Data'
			))
		)
			return;
		// drop what the app hasn't uploaded yet, and let an upload in flight land first
		await guard(async () => (await telemetry.discard(), api.deleteBetaData()), 'Beta data deleted');
	}
	async function withdraw() {
		if (
			!(await confirmDestructive(
				'Withdraw from the beta?',
				'Collection stops and your usage data is deleted. Your account features stay locked until you agree again. Learning offline on this device keeps working.',
				'Withdraw'
			))
		)
			return;
		await guard(async () => (await telemetry.discard(), api.withdrawConsent()), 'Withdrawn, usage data deleted');
		await after();
	}

	async function copyCode() {
		if (!recoveryCode) return;
		try {
			await navigator.clipboard.writeText(recoveryCode);
			toast('Recovery code copied', '📋');
		} catch {
			/* still visible on screen */
		}
	}

	const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	const initial = $derived((ai.account?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
</script>

<h2 class="eyebrow section" id="account">Account</h2>

<div class="glass group">
	{#if !supported}
		<div class="item caption">This browser doesn’t support passkeys, so accounts and AI aren’t available here.</div>
	{:else if ai.signedIn && ai.account}
		<div class="item">
			<span class="avatar" aria-hidden="true">{initial}</span>
			<span class="stack" style:--gap="2px">
				<b>{ai.account.name}</b>
				<span class="caption">
					{#if ai.account.recovery}Signed in with a recovery code{:else}Signed in with a passkey{/if}{ai.account.isAdmin ? ' · Admin' : ''}
				</span>
			</span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={rename} disabled={busy}>Rename</button>
			<button class="btn ghost small" onclick={signOut} disabled={busy}>Sign out</button>
		</div>
		{#if ai.account.recovery}
			<div class="item warn">
				<span class="caption">Add a new passkey now. Recovery sessions end after 12 hours.</span>
				<span class="spacer"></span>
				<button class="btn small" onclick={addPasskey} disabled={busy}>Add passkey</button>
			</div>
		{/if}
	{:else}
		<div class="item seg-wrap">
			<div class="seg" role="tablist" aria-label="Account">
				<button role="tab" aria-selected={mode === 'signin'} class:on={mode === 'signin'} onclick={() => (mode = 'signin')}>Sign in</button>
				<button role="tab" aria-selected={mode === 'create'} class:on={mode === 'create'} onclick={() => (mode = 'create')} disabled={!ai.signupOpen}>Create account</button>
			</div>
		</div>
		{#if mode === 'signin'}
			<div class="item caption">Use the passkey you made for Benkyo (Face ID, Touch ID or your password manager).</div>
			<div class="item"><button class="btn block" onclick={signIn} disabled={busy}>Sign in with passkey</button></div>
			<details class="item">
				<summary class="caption">Lost your passkey?</summary>
				<div class="row" style="margin-top:8px">
					<input type="text" placeholder="Recovery code" bind:value={recoverInput} autocomplete="off" autocapitalize="characters" aria-label="Recovery code" />
					<button class="btn ghost small" onclick={useRecovery} disabled={busy || !recoverInput.trim()}>Use</button>
				</div>
			</details>
		{:else}
			<div class="item caption">
				Free, with no password and no email: your device makes a passkey. Then add your own AI key (Anthropic or OpenAI-compatible). Only your account can use it.
			</div>
			<form class="item row" onsubmit={(e) => (e.preventDefault(), create())}>
				<input type="text" placeholder="Your name" bind:value={name} maxlength="40" autocomplete="nickname" aria-label="Your name" />
				<button class="btn small" disabled={busy || !name.trim()}>Create</button>
			</form>
		{/if}
		{#if !ai.signupOpen}<div class="item caption">New sign-ups are closed right now.</div>{/if}
	{/if}
	{#if recoveryCode}
		<div class="item recovery">
			<span class="stack" style:--gap="4px">
				<b>Recovery code: shown once</b>
				<code>{recoveryCode}</code>
				<span class="caption">Save it in your password manager. It lets you back in to add a new passkey if you lose yours.</span>
			</span>
			<span class="stack" style:--gap="6px">
				<button class="btn ghost small" onclick={copyCode}>Copy</button>
				<button class="btn ghost small" onclick={() => (recoveryCode = null)}>Done</button>
			</span>
		</div>
	{/if}
</div>

{#if ai.signedIn && ai.account}
	<h3 class="eyebrow section">Passkeys</h3>
	<div class="glass group">
		{#each passkeys as p (p.id)}
			<div class="item">
				<span class="key-ico" aria-hidden="true">🔑</span>
				<span class="stack" style:--gap="2px">
					<span>{p.name ?? 'Passkey'}{#if p.current}<span class="badge">This device</span>{/if}</span>
					<span class="caption">Added {day(p.createdAt)}{p.lastUsedAt ? ` · used ${day(p.lastUsedAt)}` : ''}{p.backedUp ? ' · synced' : ''}</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={() => removePasskey(p)} disabled={busy || passkeys.length < 2} aria-label="Remove {p.name ?? 'passkey'}">Remove</button>
			</div>
		{/each}
		<div class="item">
			<span class="caption">Add a passkey for another device or password manager.</span>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={addPasskey} disabled={busy}>Add passkey</button>
		</div>
		{#if !ai.account.recovery}
			<div class="item">
				<span class="caption">Lost your recovery code?</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={newCode} disabled={busy}>New recovery code</button>
			</div>
		{/if}
		<div class="item"><button class="btn ghost block danger" onclick={deleteAccount} disabled={busy}>Delete account</button></div>
	</div>

	{#if ai.beta?.acceptedAt && !ai.needsConsent}
		<h3 class="eyebrow section" id="beta-data">Beta data</h3>
		<div class="glass group">
			<div class="item">
				<span class="key-ico" aria-hidden="true">🧪</span>
				<span class="stack" style:--gap="2px">
					<span>Sharing usage data</span>
					<span class="caption">Agreed {day(ai.beta.acceptedAt)} · kept {ai.beta.retentionDays} days</span>
				</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={() => (showTerms = true)}>Details</button>
			</div>
			<div class="item">
				<span class="caption">A copy of everything collected for your account.</span>
				<span class="spacer"></span>
				<button class="btn ghost small" onclick={downloadData} disabled={busy}>Download</button>
			</div>
			<div class="item">
				<span class="caption">Delete what’s been collected so far.</span>
				<span class="spacer"></span>
				<button class="btn ghost small danger" onclick={deleteData} disabled={busy}>Delete data</button>
			</div>
			<div class="item"><button class="btn ghost block danger" onclick={withdraw} disabled={busy}>Withdraw from the beta</button></div>
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
