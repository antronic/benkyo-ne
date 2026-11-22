<!--
	Beta consent (docs/BETA-DATA.md). Shown full screen after sign-in when the
	account hasn't agreed to the current CONSENT_VERSION. Agreeing is required
	to keep using the account; "Not now" signs out and the app keeps working
	offline. With `review`, the same text opens read-only from Settings.
-->
<script lang="ts">
	import { i18n, t, fmtDateTime } from '#lib/i18n/index.svelte.ts';
	import { consentCopy } from '#lib/beta/consentCopy.ts';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import * as api from '#lib/ai/client.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { CONSENT_DATE, CONSENT_VERSION } from '#lib/beta/contract.ts';
	import { OPERATOR } from '#lib/beta/consentText.ts';
	import { Button, Card, Checkbox, ScrollMore } from '#lib/ui/index.ts';

	let { review = false, onclose }: { review?: boolean; onclose?: () => void } = $props();

	const { AGREE_LABEL, COLLECTED, CONSENT_INTRO, CONTACT, GOOD_TO_KNOW, NEVER_COLLECTED } = $derived(consentCopy(i18n.locale));
	let agreed = $state(false);
	/** the screen scrolls itself, so its "More below" button follows this element */
	let sheet: HTMLElement | undefined = $state();
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
			toast(t('consent.thanks'), '🙏', 2400);
		} catch (e) {
			haptic('error');
			error = e instanceof Error ? e.message : t('welcome.error');
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
		toast(t('consent.signedOut'), '👋', 2600);
	}
</script>

<div class="consent" bind:this={sheet} transition:fade={{ duration: 300 }} role="dialog" aria-modal="true" aria-labelledby="consent-title">
	<div class="panel" in:fly|global={{ y: 18, duration: 500, easing: cubicOut }}>
		<header class="hero">
			<span class="beta">BETA</span>
			<h2 class="large-title" id="consent-title">{t('consent.title')}</h2>
			{#if updated}<p class="caption">{t('consent.updated')}</p>{/if}
			<p class="subhead">{CONSENT_INTRO}</p>
		</header>

		<Card as="section" strong class="consent-card" aria-label={t('consent.collected')}>
			<h3 class="eyebrow">{t('consent.collected')}</h3>
			{#each COLLECTED as s (s.title)}
				<details class="item">
					<summary>
						<span class="ico" aria-hidden="true">{s.icon}</span>
						<span class="stack" style:--gap="var(--space-px)">
							<b>{s.title}</b>
							<span class="caption">{s.summary}</span>
						</span>
					</summary>
					<ul>
						{#each s.items as it}<li>{it}</li>{/each}
					</ul>
				</details>
			{/each}
		</Card>

		<Card as="section" strong class="consent-card" aria-label={t('consent.neverAria')}>
			<h3 class="eyebrow">{t('consent.never')}</h3>
			<ul class="plain">
				{#each NEVER_COLLECTED as it}<li><span aria-hidden="true">🔒</span> {it}</li>{/each}
			</ul>
		</Card>

		<Card as="section" strong class="consent-card" aria-label={t('consent.good')}>
			<h3 class="eyebrow">{t('consent.good')}</h3>
			<ul>
				{#each GOOD_TO_KNOW as it}<li>{it}</li>{/each}
				<li>
					{CONTACT[0]}
					{t('consent.contactAsk')}
					<a href="mailto:{OPERATOR.email}?subject=Benkyo%20beta%20data">{OPERATOR.email}</a>
				</li>
			</ul>
			<p class="caption version">{t('consent.version', { version: CONSENT_VERSION, date: CONSENT_DATE })}</p>
		</Card>

		{#if review}
			{#if ai.beta?.acceptedAt}
				<p class="caption center">{t('consent.agreedOn', { date: fmtDateTime(new Date(ai.beta.acceptedAt).getTime()) })}</p>
			{/if}
			<Button variant="accent" block onclick={() => onclose?.()}>{t('common.done')}</Button>
		{:else}
			<Card strong class="consent-card">
				<span class="agree"><Checkbox bind:checked={agreed}>{AGREE_LABEL}</Checkbox></span>
				<Button variant="accent" block onclick={agree} disabled={!agreed} {busy}>{busy ? t('common.saving') : t('consent.agree')}</Button>
				{#if error}<p class="error" role="alert" in:fade>{error}</p>{/if}
			</Card>
			<Button variant="plain" class="later" onclick={signOut} disabled={busy}>{t('consent.later')}</Button>
		{/if}
	</div>
	{#if sheet}<ScrollMore target={sheet} />{/if}
</div>

<style>
	.consent {
		position: fixed;
		inset: 0;
		z-index: 160;
		display: flex;
		justify-content: center;
		padding: calc(var(--safe-top) + var(--space-4)) max(var(--space-4), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-4), var(--safe-left));
		background: var(--bg);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	.panel {
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin: 0 auto;
		padding-bottom: var(--space-3);
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding-top: var(--space-2);
	}
	.hero h2,
	.hero p {
		margin: 0;
	}
	.hero .subhead {
		max-width: 40ch;
	}
	.beta {
		padding: var(--space-px) var(--space-3);
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		background: linear-gradient(90deg, #e8432e, #8a5cf6);
	}
	.panel :global(.consent-card) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-radius: 20px;
	}
	.panel h3 {
		margin: var(--space-1h) 0 0;
	}
	.panel h3:first-child {
		margin-top: 0;
	}
	details.item {
		border-top: 0.5px solid var(--hairline);
		padding-top: var(--space-2);
	}
	details.item:first-of-type {
		border-top: 0;
		padding-top: 0;
	}
	summary {
		display: flex;
		gap: var(--space-3);
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
		margin: var(--space-1) 0 var(--space-px);
		padding-left: var(--space-5);
		font-size: 0.9375rem;
		line-height: 1.4;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	details ul {
		margin-left: 34px; /* ui-ok: lines up with the text after the 22px check mark */
		padding-left: var(--space-4);
	}
	ul.plain {
		list-style: none;
		padding-left: 0;
	}
	.version,
	.center {
		text-align: center;
		margin: var(--space-1) 0 0;
	}
	ul a {
		color: var(--accent-2);
	}
	.agree {
		display: block;
		font-size: 0.9375rem;
	}
	.panel > :global(.later) {
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
