<!--
	"Open Benkyo in Safari": on iPhone and iPad only Safari can install Benkyo,
	so inside LINE, Instagram, Chrome and other apps this card moves the page
	to Safari. The button is a plain link to `x-safari-https://…` (iOS 17+
	opens it in Safari from any app); Copy link is the fallback.

	  href        this page's URL (kept whole: path, invite code, ?ref=)
	  app         the app or browser by name ("LINE", "Chrome"), or null
	  browser     true when `app` is a browser (Chrome, Edge, Firefox), not an in-app view
	  oncontinue  "Continue here"; left out, the button isn't shown

	Used by OpenInSafari (the launch prompt) and the install guide.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { safariUrl } from '#lib/pwa/platform.ts';
	import Button from './Button.svelte';
	import Card from './Card.svelte';

	type Props = { href: string; app?: string | null; browser?: boolean; oncontinue?: () => void };
	let { href, app = null, browser = false, oncontinue }: Props = $props();

	const body = $derived(browser ? t('safari.bodyBrowser') : app ? t('safari.bodyApp', { app }) : t('safari.bodyOther'));

	let copied = $state(false);
	let failed = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(href);
			copied = true;
		} catch {
			failed = true; // no clipboard: show the link so it can be selected
		}
	}
</script>

<Card as="section" strong padding="lg" radius="large" class="safari-prompt" aria-label={t('safari.title')}>
	<svg class="art" viewBox="0 0 64 64" role="img" aria-label={t('safari.art')}>
		<circle cx="32" cy="32" r="29" class="ring" />
		<circle cx="32" cy="32" r="24" class="face" />
		{#each Array.from({ length: 24 }, (_, n) => n * 15) as a (a)}
			<line x1="32" y1="10" x2="32" y2={a % 90 ? 13 : 15} transform="rotate({a} 32 32)" class="tick" />
		{/each}
		<path d="M32 32 L45 19 L35 35 Z" class="needle-n" />
		<path d="M32 32 L19 45 L29 29 Z" class="needle-s" />
	</svg>
	<div class="stack text" style:--gap="var(--space-1)">
		<div class="title-3">{t('safari.title')}</div>
		<p class="caption body">{body}</p>
	</div>
	<div class="actions">
		<Button variant="accent" block href={safariUrl(href)}>{t('safari.open')}</Button>
		<div class="row buttons" style:--gap="var(--space-2)">
			<Button variant="ghost" size="md" class="grow" onclick={copy}>{copied ? t('safari.copied') : t('safari.copy')}</Button>
			{#if oncontinue}
				<Button variant="plain" size="md" class="grow" onclick={oncontinue}>{t('safari.stay')}</Button>
			{/if}
		</div>
	</div>
	{#if failed}
		<p class="caption link" aria-live="polite">{href}</p>
	{/if}
	<p class="caption hint" aria-live="polite">{copied ? t('safari.copiedHint') : t('safari.hint')}</p>
</Card>

<style>
	:global(.safari-prompt) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		text-align: center;
	}
	.art {
		width: 64px;
		height: 64px;
		flex: none;
	}
	.ring {
		fill: var(--color-surface-strong);
		stroke: var(--color-border);
		stroke-width: 1;
	}
	.face {
		fill: color-mix(in srgb, var(--color-info) 18%, var(--color-surface-strong));
	}
	.tick {
		stroke: var(--color-text-3);
		stroke-width: 1;
		stroke-linecap: round;
	}
	.needle-n {
		fill: var(--color-accent);
	}
	.needle-s {
		fill: var(--color-text-3);
	}
	.text {
		max-width: 34ch;
	}
	.body {
		margin: 0;
		color: var(--color-text-2);
	}
	.actions {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.buttons {
		flex-wrap: wrap;
	}
	.actions :global(.grow) {
		flex: 1 0 auto;
		white-space: nowrap;
	}
	.link {
		margin: 0;
		user-select: all;
		-webkit-user-select: all;
		word-break: break-all;
		color: var(--color-text);
	}
	.hint {
		margin: 0;
		color: var(--color-text-3);
	}
</style>
