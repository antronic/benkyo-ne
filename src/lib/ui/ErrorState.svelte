<!--
	What went wrong, in plain words, and the actions that help. Used for whole
	pages (src/routes/+error.svelte, Fleet) and, with layout="inline", inside a
	card where one panel failed and the rest of the screen still works.

	  kind     offline · not-found · server · session · access · crash · update
	  layout   page (centred, Kuri, big title) · inline (a card in the flow)
	  errorId  "E-7F3K2Q" from lib/debug/errors.ts; shown with the build so a
	           screenshot is enough for Job to find the error in Fleet → Errors
	  details  plain-text block for "Copy details" (errorDetails() in lib/debug)
	  sendNote optional: lets the learner add a line to the report (the report
	           itself is sent automatically when the error happens)

	Kuri is drawn in plain SVG here, not with the WebGL renderer: an error page
	must work when the rest of the app does not.
-->
<script lang="ts" module>
	export type ErrorKind = 'offline' | 'not-found' | 'server' | 'session' | 'access' | 'crash' | 'update';
	export type ErrorAction = { label: string; href?: string; onclick?: () => unknown };
</script>

<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from './Button.svelte';
	import Card from './Card.svelte';
	import TextArea from './TextArea.svelte';
	import Notice from './Notice.svelte';

	type Props = {
		kind: ErrorKind;
		layout?: 'page' | 'inline';
		/** HTTP status or other code, shown in the details. */
		status?: number | string;
		errorId?: string | null;
		build?: string;
		/** The technical message (shown under "Details", never as the title). */
		message?: string;
		details?: string;
		/** Main action. Defaults per kind: Try again, Go to Today, Reload, Update now… */
		primary?: ErrorAction;
		secondary?: ErrorAction;
		/** Where "home" is: Today for learners, Fleet overview in /admin. */
		home?: { href: string; label: string };
		retry?: () => unknown;
		sendNote?: (note: string) => Promise<boolean>;
		kuri?: boolean;
	};
	let {
		kind,
		layout = 'page',
		status,
		errorId,
		build,
		message,
		details,
		primary,
		secondary,
		home = { href: '/', label: t('error.goToday') },
		retry,
		sendNote,
		kuri = true
	}: Props = $props();

	const back = () => (history.length > 1 ? history.back() : location.assign(home.href));
	const reload = () => location.reload();

	// Copy for each kind: what happened, then what it means for the learner.
	const COPY: Record<ErrorKind, { title: MessageKey; body: MessageKey; mood: Mood }> = {
		offline: { title: 'error.offline.title', body: 'error.offline.body', mood: 'sleepy' },
		'not-found': { title: 'error.notFound.title', body: 'error.notFound.body', mood: 'puzzled' },
		server: { title: 'error.server.title', body: 'error.server.body', mood: 'worried' },
		session: { title: 'error.session.title', body: 'error.session.body', mood: 'calm' },
		access: { title: 'error.access.title', body: 'error.access.body', mood: 'calm' },
		crash: { title: 'error.crash.title', body: 'error.crash.body', mood: 'worried' },
		update: { title: 'error.update.title', body: 'error.update.body', mood: 'happy' }
	};
	type Mood = 'sleepy' | 'puzzled' | 'worried' | 'calm' | 'happy';
	const copy = $derived(COPY[kind]);

	const defaults = $derived.by((): [ErrorAction, ErrorAction | undefined] => {
		const tryAgain = { label: t('error.tryAgain'), onclick: retry ?? reload };
		const goHome = { label: home.label, href: home.href };
		const goBack = { label: t('error.goBack'), onclick: back };
		switch (kind) {
			case 'offline':
				return [tryAgain, goHome];
			case 'not-found':
				return [goHome, goBack];
			case 'server':
				return [tryAgain, goBack];
			case 'session':
				return [{ label: t('error.signIn'), href: '/settings#account' }, { label: t('error.notNow'), onclick: back }];
			case 'access':
				return [{ label: t('error.signIn'), onclick: reload }, { label: t('error.backToApp'), href: '/' }];
			case 'crash':
				return [{ label: t('error.reload'), onclick: reload }, goHome];
			case 'update':
				return [{ label: t('error.updateNow'), onclick: reload }, undefined];
		}
	});
	const main = $derived(primary ?? defaults[0]);
	const second = $derived(secondary ?? defaults[1]);

	// Kinds that are about a bug show the id up front: a screenshot is a report.
	const showId = $derived(!!errorId && (kind === 'server' || kind === 'crash'));
	let open = $state(false);
	let busy = $state<'main' | 'second' | null>(null);
	let copied = $state(false);
	let note = $state('');
	let noteOpen = $state(false);
	let sending = $state(false);
	let sent = $state<boolean | null>(null);

	async function run(a: ErrorAction, which: 'main' | 'second') {
		if (!a.onclick) return;
		busy = which;
		try {
			await a.onclick();
		} finally {
			busy = null;
		}
	}
	const detailText = $derived(
		details ??
			[errorId && `Error ID: ${errorId}`, build && `Build: ${build}`, status != null && `Code: ${status}`, `Page: ${location.pathname}`, message && `Message: ${message}`]
				.filter(Boolean)
				.join('\n')
	);
	async function copy_() {
		try {
			await navigator.clipboard.writeText(detailText);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			open = true; // no clipboard (http, old Safari): show the text so it can be selected
		}
	}
	async function send() {
		if (!sendNote || !note.trim()) return;
		sending = true;
		try {
			sent = await sendNote(note.trim());
		} catch {
			sent = false;
		} finally {
			sending = false;
		}
	}
</script>

{#snippet face(mood: Mood, size: number)}
	<svg class="kuri" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
		<ellipse cx="60" cy="112" rx="34" ry="5" class="shadow" />
		<!-- ears -->
		<polygon points="22,50 30,12 52,38" class="fur" />
		<polygon points="98,50 90,12 68,38" class="fur" />
		<polygon points="29,42 33,22 45,37" class="inner" />
		<polygon points="91,42 87,22 75,37" class="inner" />
		<!-- head: low-poly facets -->
		<polygon points="20,52 40,32 60,30 80,32 100,52 98,78 82,98 60,104 38,98 22,78" class="fur" />
		<polygon points="60,30 80,32 100,52 60,56" class="fur-light" />
		<polygon points="22,78 38,98 60,104 60,70 34,64" class="cream" />
		<polygon points="98,78 82,98 60,104 60,70 86,64" class="cream-shade" />
		<polygon points="44,58 60,54 76,58 60,70" class="cream" />
		<!-- eyes -->
		{#if mood === 'sleepy'}
			<path d="M38 60 q6 5 12 0 M70 60 q6 5 12 0" class="line" />
		{:else if mood === 'happy'}
			<path d="M38 62 q6 -7 12 0 M70 62 q6 -7 12 0" class="line" />
		{:else}
			<circle cx="44" cy="60" r="4.5" class="eye" />
			<circle cx="76" cy="60" r="4.5" class="eye" />
			<circle cx="45.5" cy="58.5" r="1.4" class="glint" />
			<circle cx="77.5" cy="58.5" r="1.4" class="glint" />
		{/if}
		{#if mood === 'worried'}
			<path d="M36 50 l12 -4 M84 50 l-12 -4" class="line thin" />
		{/if}
		<!-- nose and mouth -->
		<polygon points="54,74 66,74 60,80" class="nose" />
		{#if mood === 'worried' || mood === 'puzzled'}
			<path d="M54 88 q6 -4 12 0" class="line thin" />
		{:else}
			<path d="M52 84 q4 5 8 0 q4 5 8 0" class="line thin" />
		{/if}
		<!-- mood mark -->
		{#if mood === 'sleepy'}
			<text x="96" y="26" class="mark">z</text><text x="106" y="14" class="mark small">z</text>
		{:else if mood === 'puzzled'}
			<text x="100" y="26" class="mark">?</text>
		{:else if mood === 'worried'}
			<path d="M102 40 q-5 8 0 10 q5 -2 0 -10z" class="drop" />
		{:else if mood === 'happy'}
			<path d="M102 14 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" class="spark" />
		{/if}
	</svg>
{/snippet}

{#snippet actions(stacked: boolean)}
	<div class="actions" class:stacked>
		{#if main}
			<Button variant="accent" size={stacked ? 'lg' : 'md'} block={stacked} href={main.href} busy={busy === 'main'} onclick={() => run(main, 'main')}>{main.label}</Button>
		{/if}
		{#if second && (stacked || secondary)}
			<Button variant="ghost" size={stacked ? 'lg' : 'md'} block={stacked} href={second.href} busy={busy === 'second'} onclick={() => run(second, 'second')}>{second.label}</Button>
		{/if}
	</div>
{/snippet}

{#snippet more()}
	{#if showId}
		<p class="caption idline">
			{t('error.idLine', { id: errorId ?? '' })}{#if build}<span>{' · '}{t('error.buildLine', { build })}</span>{/if}
		</p>
	{/if}
	<div class="links">
		<Button variant="link" onclick={copy_}>{copied ? t('error.copied') : t('error.copy')}</Button>
		<span class="caption" aria-hidden="true">·</span>
		<Button variant="link" onclick={() => (open = !open)} aria-expanded={open}>{open ? t('error.hideDetails') : t('error.showDetails')}</Button>
	</div>
	{#if sendNote && sent !== true && !noteOpen}
		<div class="links"><Button variant="link" onclick={() => (noteOpen = true)}>{t('error.addNote')}</Button></div>
	{/if}
	{#if open}
		<pre class="details mono">{detailText}</pre>
	{/if}
	{#if noteOpen && sent !== true}
		<div class="note stack" style:--gap="var(--space-2)">
			<TextArea label={t('error.noteLabel')} placeholder={t('error.notePlaceholder')} bind:value={note} autogrow />
			<div class="row" style:--gap="var(--space-2)">
				<Button size="md" busy={sending} disabled={!note.trim()} onclick={send}>{t('error.sendNote')}</Button>
				{#if sent === false}<span class="caption danger">{t('error.noteFailed')}</span>{/if}
			</div>
		</div>
	{/if}
	{#if sent === true}
		<Notice tone="success">{t('error.noteSent')}</Notice>
	{/if}
{/snippet}

{#if layout === 'page'}
	<section class="page-error" role={kind === 'offline' || kind === 'update' ? 'status' : 'alert'} data-kind={kind}>
		{#if kuri}{@render face(copy.mood, 132)}{/if}
		{#if status != null && kind !== 'offline'}<p class="eyebrow">{t('error.code', { code: String(status) })}</p>{/if}
		<h1 class="title-1">{t(copy.title)}</h1>
		<p class="body">{t(copy.body)}</p>
		{#if kind === 'offline' || kind === 'server' || kind === 'crash' || kind === 'session'}
			<p class="safe caption">{t('error.progressSafe')}</p>
		{/if}
		{@render actions(true)}
		{#if kind !== 'not-found' && kind !== 'update'}
			<div class="more">{@render more()}</div>
		{/if}
	</section>
{:else}
	<Card padding="md" class="inline-error">
		<div class="inline-row" role={kind === 'offline' ? 'status' : 'alert'} data-kind={kind}>
			{#if kuri}{@render face(copy.mood, 56)}{/if}
			<div class="stack text" style:--gap="var(--space-1)">
				<strong class="headline">{t(copy.title)}</strong>
				<p class="footnote">{t(copy.body)}</p>
			</div>
		</div>
		<div class="inline-foot stack" style:--gap="var(--space-2)">
			{@render actions(false)}
			{#if kind !== 'not-found' && kind !== 'update'}{@render more()}{/if}
		</div>
	</Card>
{/if}

<style>
	.page-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		max-width: 440px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4) var(--space-6);
	}
	.page-error .title-1 {
		text-wrap: balance;
	}
	.body {
		margin: 0;
		font-size: var(--text-body);
		color: var(--color-text-2);
		text-wrap: pretty;
	}
	.safe {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-success);
	}
	.safe::before {
		content: '✓';
		font-weight: var(--weight-bold);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.actions.stacked {
		flex-direction: column;
		align-self: stretch;
		margin-top: var(--space-3);
	}
	@media (min-width: 600px) {
		.actions.stacked {
			flex-direction: row;
			justify-content: center;
			align-self: center;
		}
		.actions.stacked :global(.btn) {
			min-width: 160px;
		}
	}
	.more {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		align-self: stretch;
	}
	.idline {
		margin: 0;
		font-family: var(--font-mono);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-footnote);
	}
	.details {
		margin: 0;
		align-self: stretch;
		text-align: left;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: var(--text-caption);
		padding: var(--space-3);
		border-radius: var(--radius-control);
		background: var(--color-fill);
		color: var(--color-text-2);
		user-select: text;
	}
	.note {
		align-self: stretch;
		text-align: left;
	}
	.danger {
		color: var(--color-danger);
	}
	.inline-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.inline-row .text {
		min-width: 0;
		flex: 1;
	}
	.inline-row p {
		margin: 0;
	}
	.inline-foot {
		margin-top: var(--space-3);
	}
	.inline-foot .links {
		justify-content: flex-start;
	}
	.inline-foot .idline {
		text-align: left;
	}
	.kuri {
		flex: none;
	}
	.kuri .fur {
		fill: #d9893f;
	}
	.kuri .fur-light {
		fill: #e49a52;
	}
	.kuri .inner {
		fill: #f3cfa6;
	}
	.kuri .cream {
		fill: #fbf1e3;
	}
	.kuri .cream-shade {
		fill: #efe2cf;
	}
	.kuri .eye,
	.kuri .nose {
		fill: #2a211c;
	}
	.kuri .glint {
		fill: #fff;
	}
	.kuri .line {
		fill: none;
		stroke: #2a211c;
		stroke-width: 3.5;
		stroke-linecap: round;
	}
	.kuri .line.thin {
		stroke-width: 2.5;
	}
	.kuri .shadow {
		fill: var(--color-text);
		opacity: 0.08;
	}
	.kuri .mark {
		fill: var(--color-text-3);
		font: var(--weight-bold) 18px var(--font-display);
	}
	.kuri .mark.small {
		font-size: 12px;
	}
	.kuri .drop {
		fill: var(--color-info);
	}
	.kuri .spark {
		fill: var(--color-warning);
	}
	@media (prefers-reduced-motion: no-preference) {
		.page-error .kuri {
			animation: bob 3.2s ease-in-out infinite;
		}
	}
	@keyframes bob {
		50% {
			transform: translateY(-4px);
		}
	}
</style>
