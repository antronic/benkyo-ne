<!--
	Beta access, shown right after the introduction when you're signed out.
	Passkey only: create an account (name + Face ID / Touch ID) or sign in
	with an existing passkey. A recovery code is shown once after sign-up.
	"Not now" keeps the app usable offline without AI.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import * as api from '#lib/ai/client.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { strokesOf } from '#lib/content/strokes.ts';

	let { ondone }: { ondone: () => void } = $props();

	const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
	const strokes = strokesOf('あ')?.d ?? [];
	let mode = $state<'create' | 'signin' | 'recover'>('create');
	let name = $state('');
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
				error = e instanceof Error ? e.message : 'Something went wrong';
				haptic('error');
			}
		} finally {
			busy = false;
		}
	}

	async function create() {
		const n = name.trim();
		if (!n) return;
		const r = await run(() => api.registerPasskey(n));
		if (!r) return;
		haptic('success');
		await ai.refresh();
		if (r.recoveryCode) recoveryCode = r.recoveryCode;
		else finish();
	}
	async function signIn() {
		const r = await run(() => api.signIn());
		if (!r?.signedIn) return;
		haptic('success');
		await ai.refresh();
		toast(`Welcome back, ${r.account?.name ?? ''}`.trim(), '👋');
		finish();
	}
	async function recover() {
		const r = await run(() => api.recover(code.trim()));
		if (!r?.signedIn) return;
		await ai.refresh();
		// a recovery session must add a passkey straight away
		const added = await run(() => api.registerPasskey());
		await ai.refresh();
		toast(added ? 'Recovered, new passkey saved' : 'Recovered. Add a passkey in Settings.', '🔑', 2800);
		finish();
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(recoveryCode ?? '');
			toast('Recovery code copied', '📋');
		} catch {
			/* still on screen */
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

<div class="welcome" transition:fade={{ duration: 350 }} role="dialog" aria-modal="true" aria-label="Join the Benkyo beta">
	<div class="bg" aria-hidden="true"></div>

	<div class="panel">
		<div class="hero" in:fly|global={{ y: 20, duration: 600, easing: cubicOut }}>
			<div class="tile" aria-hidden="true">
				<svg viewBox="0 0 109 109">
					{#each strokes as d, i}<path {d} pathLength="1" style:--i={i} />{/each}
				</svg>
			</div>
			<span class="beta">BETA</span>
			<h2 class="large-title">Join the beta</h2>
			<p class="subhead">
				One tap with Face ID or Touch ID. No password, no email: your device makes a <b>passkey</b>.
			</p>
		</div>

		{#if recoveryCode}
			<div class="card glass glass-strong" in:fly|global={{ y: 16, duration: 450 }}>
				<b>You’re in! 🎉 Save your recovery code</b>
				<code>{recoveryCode}</code>
				<p class="caption">Shown only once. Keep it in your password manager: it gets you back in if you lose your passkey.</p>
				<div class="row">
					<button class="btn ghost" onclick={copy}>Copy</button>
					<button class="btn accent grow" onclick={finish}>I saved it</button>
				</div>
			</div>
		{:else if !supported}
			<div class="card glass glass-strong">
				<p class="caption">This browser doesn’t support passkeys. Open Benkyo in Safari or Chrome to join the beta. You can still learn offline.</p>
			</div>
		{:else}
			<div class="card glass glass-strong" in:fly|global={{ y: 16, duration: 500, delay: 120 }}>
				<div class="seg" role="tablist" aria-label="Account">
					<button role="tab" aria-selected={mode === 'create'} class:on={mode === 'create'} onclick={() => ((mode = 'create'), (error = ''))} disabled={!ai.signupOpen}>Create account</button>
					<button role="tab" aria-selected={mode !== 'create'} class:on={mode !== 'create'} onclick={() => ((mode = 'signin'), (error = ''))}>Sign in</button>
				</div>

				{#if mode === 'create'}
					{#if ai.signupOpen}
						<form class="stack" style:--gap="10px" onsubmit={(e) => (e.preventDefault(), create())}>
							<input type="text" placeholder="Your name" bind:value={name} maxlength="40" autocomplete="nickname" aria-label="Your name" />
							<button class="btn accent block" disabled={busy || !name.trim()}>
								{busy ? 'Waiting for passkey…' : 'Create passkey'}
							</button>
						</form>
						<p class="caption">Then add your own AI key in Settings. It’s encrypted and only your account can use it.</p>
					{:else}
						<p class="caption">The beta is full right now. Already joined? Sign in instead.</p>
					{/if}
				{:else if mode === 'signin'}
					<button class="btn accent block" onclick={signIn} disabled={busy}>{busy ? 'Waiting for passkey…' : 'Sign in with passkey'}</button>
					<button class="link" onclick={() => ((mode = 'recover'), (error = ''))}>Lost your passkey?</button>
				{:else}
					<form class="stack" style:--gap="10px" onsubmit={(e) => (e.preventDefault(), recover())}>
						<input type="text" placeholder="Recovery code" bind:value={code} autocomplete="off" autocapitalize="characters" aria-label="Recovery code" />
						<button class="btn accent block" disabled={busy || !code.trim()}>Recover and add a passkey</button>
					</form>
					<button class="link" onclick={() => ((mode = 'signin'), (error = ''))}>Back to sign in</button>
				{/if}

				{#if error}<p class="error" role="alert" in:fade>{error}</p>{/if}
			</div>
		{/if}

		{#if !recoveryCode}
			<button class="later" onclick={later}>Not now, learn offline without AI</button>
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
		padding: calc(var(--safe-top) + 16px) max(20px, var(--safe-right)) calc(var(--safe-bottom) + 20px) max(20px, var(--safe-left));
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
		gap: 18px;
		margin: auto;
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
	}
	.hero h2 {
		margin: 6px 0 0;
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
		margin-top: 4px;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		background: linear-gradient(90deg, #e8432e, #8a5cf6);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border-radius: 24px;
	}
	.card p {
		margin: 0;
	}
	.seg {
		display: flex;
		padding: 2px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.seg button {
		flex: 1;
		height: 34px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		font-size: 0.9375rem;
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
	input {
		font: inherit;
		font-size: 1.0625rem;
		height: 50px;
		min-height: 50px;
		padding: 0 16px;
		border-radius: 14px;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		color: var(--ink);
		box-sizing: border-box;
		width: 100%;
	}
	.btn.block,
	.row .btn {
		min-height: 50px;
	}
	.row {
		display: flex;
		gap: 10px;
	}
	.grow {
		flex: 1;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 1.125rem;
		letter-spacing: 0.05em;
		text-align: center;
		padding: 12px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--warn) 16%, transparent);
		word-break: break-all;
	}
	.link,
	.later {
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
		padding: 6px;
	}
	.link {
		color: var(--accent-2);
		align-self: center;
	}
	.later {
		color: var(--ink-2);
		font-size: 0.9375rem;
		align-self: center;
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
