<!--
	Thumbs up or down and "Report a problem" on a piece of content the app
	teaches: a lesson, a unit, a grammar point, a kanji or a word
	(docs/FEEDBACK.md). Job reads them in Fleet → Feedback.

	  <ContentFeedback subject="unit:n5-01" label="Greetings" />
	  <ContentFeedback subject={card.id} label={card.front} compact />

	The full bar is a row under the content, and "Report a problem" opens its
	form in place (so it also works inside a sheet); `compact` is one ••• button
	(for a row in a list) that opens the same choices in a sheet. Signed out, a tap
	says to sign in. `api`, `signedIn` and `accountId` default to the real ones;
	/design passes fakes.
-->
<script lang="ts">
	import { t, i18n, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Button, Chip, IconButton, Notice, Sheet, TextArea } from '#lib/ui/index.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { feedback } from '#lib/state/feedback.svelte.ts';
	import { feedbackApi, feedbackProblemKey, type FeedbackApi } from '#lib/feedback/client.ts';
	import { FEEDBACK_DETAIL_MAX, FEEDBACK_REASONS, type FeedbackReason } from '#lib/feedback/contract.ts';

	type Props = {
		subject: string;
		/** what the learner sees it called ("日", "Greetings"), shown in Fleet */
		label: string;
		compact?: boolean;
		api?: FeedbackApi;
		signedIn?: boolean;
		accountId?: number;
		class?: string;
	};
	let { subject, label, compact = false, api = feedbackApi, signedIn: signedInProp, accountId: accountProp, class: cls = '' }: Props = $props();
	const signedIn = $derived(signedInProp ?? ai.signedIn);
	const accountId = $derived(accountProp ?? ai.account?.id);

	$effect(() => {
		if (signedIn && accountId !== undefined) void feedback.ensure(accountId, api);
	});

	/** The compact sheet lives on <body>: inside a glass card (backdrop-filter) a fixed sheet would be trapped in the card. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	const mine = $derived(feedback.of(subject));
	let open = $state(false);
	let reporting = $state(false);
	let reason = $state<FeedbackReason | null>(null);
	let detail = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let error = $state<MessageKey | null>(null);

	function needSignIn() {
		if (signedIn) return false;
		toast(t('feedback.signIn'), '🔒', 2600);
		return true;
	}

	async function thumb(v: 1 | -1) {
		if (needSignIn()) return;
		const next = mine === v ? 0 : v;
		haptic('selection');
		try {
			await feedback.set(subject, label, next, api); // ui-ok: optimistic, the thumb lights at once and goes back with a toast if it fails
			if (next === -1 && !sent) {
				// a thumb down usually means something is off: offer to say what
				reporting = true;
			}
		} catch (e) {
			toast(t(feedbackProblemKey(e)), '⚠️', 2600);
		}
	}

	function openReport() {
		if (needSignIn()) return;
		reporting = true;
	}

	function openMenu() {
		open = true;
		reporting = false;
	}

	function close() {
		open = false;
		reporting = false;
		error = null;
	}

	async function send() {
		if (!reason) return;
		sending = true;
		error = null;
		try {
			await api.report(subject, label, reason, detail.trim(), i18n.locale);
			haptic('success');
			sent = true;
			reason = null;
			detail = '';
			close();
			toast(t('feedback.sent'), '✓', 2400);
		} catch (e) {
			const key = feedbackProblemKey(e);
			if (key === 'feedback.err.already_reported') {
				sent = true;
				close();
				toast(t(key), '✓', 2400);
			} else error = key;
		} finally {
			sending = false;
		}
	}
</script>

{#snippet thumbs()}
	<IconButton size="sm" label={t('feedback.up')} aria-pressed={mine === 1} class="fb-thumb {mine === 1 ? 'on' : ''}" onclick={() => thumb(1)}>👍</IconButton>
	<IconButton size="sm" label={t('feedback.down')} aria-pressed={mine === -1} class="fb-thumb {mine === -1 ? 'on' : ''}" onclick={() => thumb(-1)}>👎</IconButton>
{/snippet}

{#snippet form()}
	<div class="stack" style:--gap="var(--space-3)">
		<span class="headline">{t('feedback.why')}</span>
		<div class="chips" role="radiogroup" aria-label={t('feedback.why')}>
			{#each FEEDBACK_REASONS as r}
				<Chip selected={reason === r} onclick={() => (reason = r)}>{t(`feedback.reason.${r}` as MessageKey)}</Chip>
			{/each}
		</div>
		<TextArea bind:value={detail} rows={3} maxlength={FEEDBACK_DETAIL_MAX} placeholder={t('feedback.detail')} aria-label={t('feedback.detail')} />
		{#if error}<Notice tone="danger">{t(error)}</Notice>{/if}
		<div class="row" style:--gap="var(--space-2)">
			<Button size="sm" variant="accent" disabled={!reason} busy={sending} onclick={send}>{t('feedback.send')}</Button>
			<Button size="sm" variant="ghost" onclick={close}>{t('common.cancel')}</Button>
		</div>
	</div>
{/snippet}

{#if compact}
	<IconButton label={t('feedback.menu', { label })} class={cls} onclick={openMenu}>•••</IconButton>
	<div class="fb-portal" use:portal>
	<Sheet {open} label={t('feedback.title')} onclose={close}>
		{#snippet header()}
			<div class="head">
				<div class="stack" style:--gap="var(--space-px)">
					<div class="title-3" lang="ja">{label}</div>
					<div class="caption">{t('feedback.title')}</div>
				</div>
				<Button variant="plain" size="sm" onclick={close}>{t('common.done')}</Button>
			</div>
		{/snippet}
		<div class="stack" style:--gap="var(--space-4)">
			<div class="row" style:--gap="var(--space-2)">
				<span class="subhead ask">{t('feedback.ask')}</span>
				{@render thumbs()}
			</div>
			{#if !signedIn}
				<Notice>{t('feedback.signIn')}</Notice>
			{:else if sent}
				<Notice tone="success">{t('feedback.reported')}</Notice>
			{:else if reporting}
				{@render form()}
			{:else}
				<Button variant="ghost" block onclick={() => (reporting = true)}>⚑ {t('feedback.report')}</Button>
			{/if}
		</div>
	</Sheet>
	</div>
{:else}
	<div class="feedback stack {cls}" style:--gap="var(--space-3)">
		<div class="bar">
			<span class="caption ask">{t('feedback.ask')}</span>
			{@render thumbs()}
			<span class="spacer"></span>
			{#if sent}
				<span class="caption">✓ {t('feedback.reported')}</span>
			{:else if !reporting}
				<Button size="sm" variant="ghost" onclick={openReport}>⚑ {t('feedback.report')}</Button>
			{/if}
		</div>
		{#if reporting && !sent}{@render form()}{/if}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.ask {
		color: var(--ink-2);
	}
	.spacer {
		flex: 1;
	}
	:global(.icon-btn.fb-thumb:not(.on)) {
		filter: grayscale(1);
		opacity: 0.7;
	}
	:global(.icon-btn.fb-thumb.on) {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-1) var(--space-3);
	}
	.row {
		display: flex;
		align-items: center;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
