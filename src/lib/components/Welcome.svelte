<!--
	Beta access, shown right after the introduction when you're signed out.
	Create an account (name + Face ID / Touch ID) or sign in with an existing
	passkey; a recovery code is shown once after a passkey sign-up. When the
	server has it set up, "Continue with Apple" is offered beside the passkey.
	"Not now" keeps the app usable offline without AI.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import * as api from '#lib/ai/client.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { strokesOf } from '#lib/content/strokes.ts';
	import AppleButton from './AppleButton.svelte';
	import { Button, Card, Segmented, TextField } from '#lib/ui/index.ts';
	import { clearPendingInvite, pendingInvite } from '#lib/promo/link.ts';

	let { ondone }: { ondone: () => void } = $props();

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
	const strokes = strokesOf('あ')?.d ?? [];
	let mode = $state<'create' | 'signin' | 'recover'>('create');
	let name = $state('');
	// filled in from a sign-up link (/invite/CODE)
	let invite = $state(pendingInvite() ?? '');
	const canCreate = $derived(ai.signupOpen || ai.signupInvite);
	const needInvite = $derived(!ai.signupOpen && ai.signupInvite);
	let code = $state('');
	let busy = $state(false);
	let error = $state('');
	let recoveryCode = $state<string | null>(null);

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		busy = true;
		error = '';
		try {
			return await fn();
		} catch (e) {
			// closing the system passkey sheet is not an error
			if ((e as Error)?.name !== 'NotAllowedError') {
				error = e instanceof Error ? e.message : t('welcome.error');
				haptic('error');
			}
		} finally {
			busy = false;
		}
	}

	async function create() {
		const n = name.trim();
		if (!n) return;
		const r = await run(() => api.registerPasskey(n, needInvite ? invite.trim() : undefined));
		if (!r) return;
		clearPendingInvite();
		haptic('success');
		// the avatar step follows the recovery code and the beta consent (docs/AVATAR.md)
		avatar.afterSignup = true;
		await ai.refresh();
		if (r.recoveryCode) recoveryCode = r.recoveryCode;
		else finish();
	}
	async function signIn() {
		const r = await run(() => api.signIn());
		if (!r?.signedIn) return;
		haptic('success');
		await ai.refresh();
		toast(t('welcome.back', { name: r.account?.name ?? '' }).trim(), '👋');
		finish();
	}
	async function recover() {
		const r = await run(() => api.recover(code.trim()));
		if (!r?.signedIn) return;
		await ai.refresh();
		// a recovery session must add a passkey straight away
		const added = await run(() => api.registerPasskey());
		await ai.refresh();
		toast(added ? t('welcome.recovered') : t('welcome.recoveredNoKey'), '🔑', 2800);
		finish();
	}
	let copying = $state(false);
	async function copy() {
		copying = true;
		try {
			await navigator.clipboard.writeText(recoveryCode ?? '');
			toast(t('welcome.codeCopied'), '📋');
		} catch {
			/* still on screen */
		} finally {
			copying = false;
		}
	}
	function finish() {
		ondone();
	}
	function later() {
		haptic('selection');
		ondone();
	}
</script>

<div class="welcome" transition:fade={{ duration: 350 }} role="dialog" aria-modal="true" aria-label={t('welcome.label')}>
	<div class="bg" aria-hidden="true"></div>

	<div class="panel">
		<div class="hero" in:fly|global={{ y: 20, duration: 600, easing: cubicOut }}>
			<div class="tile" aria-hidden="true">
				<svg viewBox="0 0 109 109">
					{#each strokes as d, i}<path {d} pathLength="1" style:--i={i} />{/each}
				</svg>
			</div>
			<span class="beta">BETA</span>
			<h2 class="large-title">{t('welcome.title')}</h2>
			<p class="subhead">
				{@html t(ai.appleEnabled ? 'welcome.leadApple' : 'welcome.lead')}
			</p>
		</div>

		{#if recoveryCode}
			<div in:fly|global={{ y: 16, duration: 450 }}><Card strong class="wl-card">
				<b>{t('welcome.inSave')}</b>
				<code>{recoveryCode}</code>
				<p class="caption">{t('welcome.codeBody')}</p>
				<div class="row">
					<Button variant="ghost" busy={copying} onclick={copy}>{t('welcome.copy')}</Button>
					<Button variant="accent" class="grow" onclick={finish}>{t('welcome.saved')}</Button>
				</div>
			</Card></div>
		{:else if !supported}
			<Card strong class="wl-card">
				{#if ai.appleEnabled}
					<AppleButton />
					<p class="caption">{t('welcome.noPasskeysApple')}</p>
				{:else}
					<p class="caption">{t('welcome.noPasskeys')}</p>
				{/if}
			</Card>
		{:else}
			<div in:fly|global={{ y: 16, duration: 500, delay: 120 }}><Card strong class="wl-card">
				<Segmented
					label={t('welcome.account')}
					options={[
						{ value: 'create', label: t('welcome.create'), disabled: !canCreate },
						{ value: 'signin', label: t('welcome.signIn') }
					]}
					value={mode === 'create' ? 'create' : 'signin'}
					onchange={(v) => ((mode = v), (error = ''))}
				/>

				{#if mode === 'create'}
					{#if canCreate}
						<form class="stack" style:--gap="var(--space-3)" onsubmit={(e) => (e.preventDefault(), create())}>
							{#if needInvite}
								<p class="caption">{t('welcome.inviteOnly')}</p>
								<TextField size="lg" placeholder={t('welcome.invite')} bind:value={invite} maxlength={20} autocomplete="off" autocapitalize="characters" aria-label={t('welcome.invite')} />
							{/if}
							<TextField size="lg" placeholder={t('welcome.name')} bind:value={name} maxlength={40} autocomplete="nickname" aria-label={t('welcome.name')} />
							<Button type="submit" variant="accent" block {busy} disabled={!name.trim() || (needInvite && !invite.trim())}>
								{busy ? t('welcome.waiting') : t('welcome.createPasskey')}
							</Button>
						</form>
						{#if ai.appleEnabled && ai.signupOpen}
							<div class="or" aria-hidden="true"><span>{t('welcome.or')}</span></div>
							<AppleButton disabled={busy} />
						{/if}
						<p class="caption">{t('welcome.thenKey')}</p>
					{:else}
						<p class="caption">{t('welcome.full')}</p>
					{/if}
				{:else if mode === 'signin'}
					<Button variant="accent" block {busy} onclick={signIn}>{busy ? t('welcome.waiting') : t('welcome.signInPasskey')}</Button>
					{#if ai.appleEnabled}<AppleButton label={t('welcome.signInApple')} disabled={busy} />{/if}
					<Button variant="plain" class="wl-link" onclick={() => ((mode = 'recover'), (error = ''))}>{t('welcome.lost')}</Button>
				{:else}
					<form class="stack" style:--gap="var(--space-3)" onsubmit={(e) => (e.preventDefault(), recover())}>
						<TextField size="lg" placeholder={t('welcome.code')} bind:value={code} autocomplete="off" autocapitalize="characters" aria-label={t('welcome.code')} />
						<Button type="submit" variant="accent" block {busy} disabled={!code.trim()}>{t('welcome.recover')}</Button>
					</form>
					<Button variant="plain" class="wl-link" onclick={() => ((mode = 'signin'), (error = ''))}>{t('welcome.backToSignIn')}</Button>
				{/if}

				{#if error}<p class="error" role="alert" in:fade>{error}</p>{/if}
			</Card></div>
		{/if}

		{#if !recoveryCode}
			<Button variant="plain" class="wl-later" onclick={later}>{t('welcome.later')}</Button>
		{/if}
	</div>
</div>

<style>
	.welcome {
		position: fixed;
		inset: 0;
		z-index: 150;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--safe-top) + var(--space-4)) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
		background: var(--bg);
		overflow-y: auto;
	}
	.bg {
		position: fixed;
		inset: -20%;
		background:
			radial-gradient(40% 35% at 30% 25%, hsl(8 85% 62% / 0.4), transparent 70%),
			radial-gradient(45% 40% at 75% 75%, hsl(265 80% 60% / 0.32), transparent 70%);
		filter: blur(30px);
		animation: breathe 9s ease-in-out infinite alternate;
		pointer-events: none;
	}
	@keyframes breathe {
		to {
			transform: scale(1.1) rotate(6deg);
		}
	}
	.panel {
		position: relative;
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin: auto;
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
	}
	.hero h2 {
		margin: var(--space-1h) 0 0;
	}
	.hero p {
		margin: 0;
		max-width: 32ch;
	}
	.tile {
		width: 88px;
		height: 88px;
		border-radius: 22px;
		background: linear-gradient(135deg, #ff7a5c, #e8432e 55%, #b8264f);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.45),
			0 18px 36px -12px rgb(232 67 46 / 0.6);
		display: grid;
		place-items: center;
		animation: float 5s ease-in-out infinite;
	}
	@keyframes float {
		50% {
			transform: translateY(-6px) rotate(-3deg);
		}
	}
	.tile svg {
		width: 58px;
		height: 58px;
		overflow: visible;
	}
	.tile path {
		fill: none;
		stroke: #fff;
		stroke-width: 7;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: write 420ms ease-out forwards;
		animation-delay: calc(250ms + var(--i) * 230ms);
	}
	@keyframes write {
		to {
			stroke-dashoffset: 0;
		}
	}
	.beta {
		margin-top: var(--space-1);
		padding: var(--space-px) var(--space-3);
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		background: linear-gradient(90deg, #e8432e, #8a5cf6);
	}
	.panel :global(.wl-card) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		border-radius: 24px;
	}
	.panel p {
		margin: 0;
	}
	.row {
		display: flex;
		gap: var(--space-3);
	}
	.row :global(.grow) {
		flex: 1;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 1.125rem;
		letter-spacing: 0.05em;
		text-align: center;
		padding: var(--space-3);
		border-radius: 12px;
		background: color-mix(in srgb, var(--warn) 16%, transparent);
		word-break: break-all;
	}
	.panel :global(.wl-link),
	.panel :global(.wl-later) {
		align-self: center;
		font-weight: 400;
	}
	.panel :global(.wl-link) {
		color: var(--accent-2);
	}
	.panel :global(.wl-later) {
		color: var(--ink-2);
		font-size: 0.9375rem;
	}
	.or {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--ink-2);
		font-size: 0.8125rem;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 0.5px;
		background: var(--hairline);
	}
	.error {
		color: var(--danger);
		font-size: 0.875rem;
		text-align: center;
	}
	@media (prefers-reduced-motion: reduce) {
		.tile,
		.bg {
			animation: none;
		}
		.tile path {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
