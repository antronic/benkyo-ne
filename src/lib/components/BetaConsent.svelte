<!--
	Beta consent (docs/BETA-DATA.md). Shown full screen after sign-in when the
	account hasn't agreed to the current CONSENT_VERSION. Agreeing is required
	to keep using the account; "Not now" signs out and the app keeps working
	offline. With `review`, the same text opens read-only from Settings.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import * as api from '#lib/ai/client.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { CONSENT_DATE, CONSENT_VERSION } from '#lib/beta/contract.ts';
	import { AGREE_LABEL, CHOICES, COLLECTED, CONSENT_INTRO, HOW_USED, NEVER_COLLECTED, RETENTION } from '#lib/beta/consentText.ts';

	let { review = false, onclose }: { review?: boolean; onclose?: () => void } = $props();

	let agreed = $state(false);
	let busy = $state(false);
	let error = $state('');
	// agreed to an older version before: say why this is back
	const updated = $derived(!review && ai.beta?.acceptedVersion != null);

	async function agree() {
		if (!agreed) return;
		busy = true;
		error = '';
		try {
			await api.acceptConsent(CONSENT_VERSION);
			haptic('success');
			await ai.refresh();
			toast('Thanks for helping with the beta', '🙏', 2400);
		} catch (e) {
			haptic('error');
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		busy = true;
		try {
			await api.signOut();
		} catch {
			/* signed out locally anyway below */
		}
		await ai.refresh();
		busy = false;
		toast('Signed out. You can keep learning offline.', '👋', 2600);
	}
</script>

<div class="consent" transition:fade={{ duration: 300 }} role="dialog" aria-modal="true" aria-labelledby="consent-title">
	<div class="panel" in:fly|global={{ y: 18, duration: 500, easing: cubicOut }}>
		<header class="hero">
			<span class="beta">BETA</span>
			<h2 class="large-title" id="consent-title">Help shape Benkyo</h2>
			{#if updated}<p class="caption">The beta terms changed since you last agreed. Please read them again.</p>{/if}
			<p class="subhead">{CONSENT_INTRO}</p>
		</header>

		<section class="card glass glass-strong" aria-label="What we collect">
			<h3 class="eyebrow">What we collect</h3>
			{#each COLLECTED as s (s.title)}
				<details class="row">
					<summary>
						<span class="ico" aria-hidden="true">{s.icon}</span>
						<span class="stack" style:--gap="2px">
							<b>{s.title}</b>
							<span class="caption">{s.summary}</span>
						</span>
					</summary>
					<ul>
						{#each s.items as it}<li>{it}</li>{/each}
					</ul>
				</details>
			{/each}
		</section>

		<section class="card glass glass-strong" aria-label="What we never collect">
			<h3 class="eyebrow">Never collected</h3>
			<ul class="plain">
				{#each NEVER_COLLECTED as it}<li><span aria-hidden="true">🔒</span> {it}</li>{/each}
			</ul>
		</section>

		<section class="card glass glass-strong" aria-label="How it is used and kept">
			<h3 class="eyebrow">How it’s used</h3>
			<ul>{#each HOW_USED as it}<li>{it}</li>{/each}</ul>
			<h3 class="eyebrow">How long we keep it</h3>
			<ul>{#each RETENTION as it}<li>{it}</li>{/each}</ul>
			<h3 class="eyebrow">Your choices</h3>
			<ul>{#each CHOICES as it}<li>{it}</li>{/each}</ul>
			<p class="caption version">Beta terms version {CONSENT_VERSION} · {CONSENT_DATE}</p>
		</section>

		{#if review}
			{#if ai.beta?.acceptedAt}
				<p class="caption center">You agreed on {new Date(ai.beta.acceptedAt).toLocaleString()}.</p>
			{/if}
			<button class="btn accent block" onclick={() => onclose?.()}>Done</button>
		{:else}
			<div class="card glass glass-strong agree-card">
				<label class="agree">
					<input type="checkbox" bind:checked={agreed} />
					<span>{AGREE_LABEL}</span>
				</label>
				<button class="btn accent block" onclick={agree} disabled={!agreed || busy}>{busy ? 'Saving…' : 'Agree and continue'}</button>
				{#if error}<p class="error" role="alert" in:fade>{error}</p>{/if}
			</div>
			<button class="later" onclick={signOut} disabled={busy}>Not now, sign out and learn offline</button>
		{/if}
	</div>
</div>

<style>
	.consent {
		position: fixed;
		inset: 0;
		z-index: 160;
		display: flex;
		justify-content: center;
		padding: calc(var(--safe-top) + 16px) max(16px, var(--safe-right)) calc(var(--safe-bottom) + 20px) max(16px, var(--safe-left));
		background: var(--bg);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	.panel {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0 auto;
		padding-bottom: 12px;
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
		padding-top: 8px;
	}
	.hero h2,
	.hero p {
		margin: 0;
	}
	.hero .subhead {
		max-width: 40ch;
	}
	.beta {
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
		gap: 8px;
		padding: 14px 16px;
		border-radius: 20px;
	}
	.card h3 {
		margin: 6px 0 0;
	}
	.card h3:first-child {
		margin-top: 0;
	}
	details.row {
		border-top: 0.5px solid var(--hairline);
		padding-top: 8px;
	}
	details.row:first-of-type {
		border-top: 0;
		padding-top: 0;
	}
	summary {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '›';
		margin-left: auto;
		color: var(--ink-2);
		font-size: 1.25rem;
		line-height: 1;
		transition: transform 200ms;
	}
	details[open] summary::after {
		transform: rotate(90deg);
	}
	.ico {
		font-size: 1.375rem;
		line-height: 1.2;
	}
	ul {
		margin: 4px 0 2px;
		padding-left: 20px;
		font-size: 0.9375rem;
		line-height: 1.4;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	details ul {
		margin-left: 34px;
		padding-left: 16px;
	}
	ul.plain {
		list-style: none;
		padding-left: 0;
	}
	.version,
	.center {
		text-align: center;
		margin: 4px 0 0;
	}
	.agree {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		font-size: 0.9375rem;
		line-height: 1.4;
		cursor: pointer;
	}
	.agree input {
		width: 22px;
		height: 22px;
		flex: none;
		margin: 0;
		accent-color: var(--accent);
	}
	.btn.block {
		min-height: 50px;
	}
	.later {
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
		padding: 8px;
		color: var(--ink-2);
		font-size: 0.9375rem;
		align-self: center;
	}
	.error {
		color: var(--danger);
		font-size: 0.875rem;
		text-align: center;
		margin: 0;
	}
</style>
