<!--
	One shared note or reply in Community notes (docs/COMMUNITY.md): the handle,
	the text, a heart, and a ••• menu to report or block the author (or delete
	your own). A note also opens its replies here, one level deep. Everything
	happens in place (no sheet), so it works inside the card sheet too.

	文A translates someone else's note or reply into your interface language
	with your AI (icon only, the tooltip says Translate). It shows when
	`canTranslate` is set and the text is in another language; the result is
	kept on this device (#lib/community/translations.ts).

	  <CommunityPost kind="post" item={post} {api} canReply canTranslate onremoved={…} onblocked={…} />
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { t, tn, fmtDate, i18n, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Avatar, Badge, Button, Chip, IconButton, Notice, Skeleton, Spinner, TextArea, TextField } from '#lib/ui/index.ts';
	import { AiRequestError } from '#lib/ai/client.ts';
	import { cachedTranslation, saveTranslation, translationKey } from '#lib/community/translations.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { problemKey, type CommunityApi } from '#lib/community/client.ts';
	import { guessLang, REPLY_MAX, REPORT_DETAIL_MAX, REPORT_REASONS, type Post, type Reply, type ReportReason } from '#lib/community/contract.ts';
	import Self from './CommunityPost.svelte';

	type Props = {
		kind: 'post' | 'reply';
		item: Post | Reply;
		api: CommunityApi;
		/** you have a handle and may write replies */
		canReply?: boolean;
		/** AI is set up and reachable: offer 文A on other people's text */
		canTranslate?: boolean;
		/** your note or reply was deleted */
		onremoved?: () => void;
		/** you blocked the author: hide everything of theirs */
		onblocked?: (handle: string) => void;
	};
	let { kind, item, api, canReply = false, canTranslate = false, onremoved, onblocked }: Props = $props();

	// local copies so a heart or a new reply shows at once
	// (rows are keyed by id, so the first value is the one to start from)
	let liked = $state(untrack(() => item.liked));
	let likes = $state(untrack(() => item.likes));
	let replyCount = $state(untrack(() => (kind === 'post' ? (item as Post).replies : 0)));
	let liking = $state(false);

	let menu = $state(false);
	let reporting = $state(false);
	let reason = $state<ReportReason | null>(null);
	let detail = $state('');
	let reported = $state(false);
	let confirmDelete = $state(false);
	let busy = $state<'report' | 'block' | 'delete' | 'reply' | null>(null);
	let error = $state<MessageKey | null>(null);

	let open = $state(false);
	let replies = $state<Reply[] | null>(null);
	let repliesFailed = $state(false);
	let draft = $state('');

	// Translate (文A): into the interface language, cached on the device
	const to = $derived(i18n.locale);
	const trKey = $derived(translationKey(kind, item.id, ('editedAt' in item ? item.editedAt : null) ?? item.createdAt, to));
	let translation = $state<string | null>(null);
	let showOriginal = $state(false);
	let translating = $state(false);
	let trError = $state<string | null>(null);
	const offerTranslate = $derived(canTranslate && !item.mine && item.lang !== to);

	async function translate() {
		if (translation) {
			showOriginal = !showOriginal;
			return;
		}
		const hit = cachedTranslation(trKey);
		if (hit) {
			translation = hit;
			showOriginal = false;
			return;
		}
		translating = true;
		trError = null;
		try {
			translation = await api.translate(kind, item.id, to);
			saveTranslation(trKey, translation);
			showOriginal = false;
		} catch (e) {
			trError = e instanceof AiRequestError ? e.message : t('community.translateFailed');
		} finally {
			translating = false;
		}
	}

	const STATUS: Record<string, MessageKey> = { hidden: 'community.status.hidden', removed: 'community.status.removed' };

	async function toggleLike() {
		if (liking) return;
		const on = !liked;
		liked = on;
		likes += on ? 1 : -1;
		liking = true;
		try {
			const r = await api.setLike(kind, item.id, on);
			liked = r.liked;
			likes = r.likes;
			if (on) haptic('selection');
		} catch (e) {
			liked = !on;
			likes += on ? -1 : 1;
			error = problemKey(e) as MessageKey;
		} finally {
			liking = false;
		}
	}

	async function loadReplies() {
		repliesFailed = false;
		replies = null;
		try {
			replies = (await api.getThread(item.id)).replies;
		} catch {
			repliesFailed = true;
		}
	}

	function toggleReplies() {
		open = !open;
		if (open && replies === null) void loadReplies();
	}

	async function sendReply() {
		const body = draft.trim();
		if (!body) return;
		busy = 'reply';
		error = null;
		try {
			const r = await api.postReply(item.id, body, guessLang(body));
			replies = [...(replies ?? []), r];
			replyCount += 1;
			draft = '';
			haptic('success');
		} catch (e) {
			error = problemKey(e) as MessageKey;
		} finally {
			busy = null;
		}
	}

	async function sendReport() {
		if (!reason) return;
		busy = 'report';
		error = null;
		try {
			await api.report(kind, item.id, reason, detail.trim());
			reported = true;
			reporting = false;
			menu = false;
		} catch (e) {
			error = problemKey(e) as MessageKey;
		} finally {
			busy = null;
		}
	}

	async function blockAuthor() {
		busy = 'block';
		error = null;
		try {
			await api.block(kind, item.id);
			onblocked?.(item.handle);
		} catch (e) {
			error = problemKey(e) as MessageKey;
		} finally {
			busy = null;
		}
	}

	async function remove() {
		busy = 'delete';
		error = null;
		try {
			if (kind === 'post') await api.deletePost(item.id);
			else await api.deleteReply(item.id);
			onremoved?.();
		} catch (e) {
			error = problemKey(e) as MessageKey;
		} finally {
			busy = null;
		}
	}
</script>

<article class="cp {kind}" aria-label={t('community.by', { handle: item.handle })}>
	<header class="row">
		<Avatar person={item.avatar} name={item.handle} size={kind === 'reply' ? 24 : 32} label="" />
		<span class="handle">@{item.handle}</span>
		<span class="caption">{fmtDate(item.createdAt, { day: 'numeric', month: 'short' })}</span>
		{#if item.mine}<Badge tone="neutral">{t('community.you')}</Badge>{/if}
		{#if STATUS[item.status]}<Badge tone="warning">{t(STATUS[item.status])}</Badge>{/if}
		<span class="end">
			<IconButton size="sm" label={t('community.more')} aria-expanded={menu} onclick={() => ((menu = !menu), (reporting = false), (confirmDelete = false))}>•••</IconButton>
		</span>
	</header>
	{#if translation && !showOriginal}
		<p class="body" lang={to}>{translation}</p>
		<p class="caption">{t('community.translated')}</p>
	{:else}
		<p class="body" lang={item.lang}>{item.body}</p>
	{/if}

	<div class="row actions">
		<Button variant="ghost" size="sm" busy={liking} aria-pressed={liked} onclick={toggleLike} disabled={item.status !== 'published'}>
			<span class:on={liked}>{liked ? '♥' : '♡'}</span> {likes}
			<span class="sr">{t('community.like')}</span>
		</Button>
		{#if kind === 'post'}
			<Button variant="ghost" size="sm" aria-expanded={open} onclick={toggleReplies}>💬 {tn('community.replies', replyCount)}</Button>
		{/if}
		{#if offerTranslate}
			<span class="end">
				{#if translating}
					<Spinner size="sm" label={t('community.translating')} />
				{:else}
					<IconButton
						size="sm"
						label={translation && !showOriginal ? t('community.showOriginal') : t('community.translate')}
						aria-pressed={!!translation && !showOriginal}
						onclick={translate}><span class="tr" aria-hidden="true">文A</span></IconButton
					>
				{/if}
			</span>
		{/if}
	</div>

	{#if trError}
		<Notice tone="warning">{trError}</Notice>
	{/if}

	{#if reported}
		<Notice tone="success">{t('community.reported')}</Notice>
	{/if}

	{#if menu}
		<div class="menu">
			{#if item.mine}
				{#if confirmDelete}
					<p class="caption">{kind === 'post' ? t('community.deleteNoteAsk') : t('community.deleteReplyAsk')}</p>
					<div class="row">
						<Button size="sm" variant="danger" busy={busy === 'delete'} onclick={remove}>{t('community.delete')}</Button>
						<Button size="sm" variant="ghost" onclick={() => (confirmDelete = false)}>{t('common.cancel')}</Button>
					</div>
				{:else}
					<Button size="sm" variant="ghost-danger" onclick={() => (confirmDelete = true)}>{kind === 'post' ? t('community.deleteNote') : t('community.deleteReply')}</Button>
				{/if}
			{:else if reporting}
				<p class="caption">{t('community.reportWhy')}</p>
				<div class="chips" role="radiogroup" aria-label={t('community.reportWhy')}>
					{#each REPORT_REASONS as r}
						<Chip selected={reason === r} onclick={() => (reason = r)}>{t(`community.reason.${r}` as MessageKey)}</Chip>
					{/each}
				</div>
				<TextField size="sm" bind:value={detail} maxlength={REPORT_DETAIL_MAX} placeholder={t('community.reportDetail')} aria-label={t('community.reportDetail')} />
				<div class="row">
					<Button size="sm" variant="danger" disabled={!reason} busy={busy === 'report'} onclick={sendReport}>{t('community.reportSend')}</Button>
					<Button size="sm" variant="ghost" onclick={() => (reporting = false)}>{t('common.cancel')}</Button>
				</div>
			{:else}
				<div class="row">
					{#if !reported}<Button size="sm" variant="ghost" onclick={() => (reporting = true)}>⚑ {t('community.report')}</Button>{/if}
					<Button size="sm" variant="ghost" busy={busy === 'block'} onclick={blockAuthor}>{t('community.block', { handle: item.handle })}</Button>
				</div>
				<p class="caption">{t('community.blockHint')}</p>
			{/if}
		</div>
	{/if}

	{#if error}
		<Notice tone="danger">{t(error)}</Notice>
	{/if}

	{#if kind === 'post' && open}
		<div class="replies">
			{#if repliesFailed}
				<Notice tone="warning" title={t('community.loadFailed')}>
					{#snippet action()}<Button size="sm" variant="ghost" onclick={loadReplies}>{t('boot.retry')}</Button>{/snippet}
					{t('community.loadFailedHint')}
				</Notice>
			{:else if replies === null}
				<Skeleton variant="line" count={2} label={t('community.loadingReplies')} />
			{:else}
				{#each replies as r (r.id)}
					<Self
						kind="reply"
						item={r}
						{api}
						{canTranslate}
						onremoved={() => ((replies = replies!.filter((x) => x.id !== r.id)), (replyCount = Math.max(0, replyCount - 1)))}
						onblocked={(h) => (replies = replies!.filter((x) => x.handle !== h))}
					/>
				{:else}
					<p class="caption">{t('community.noReplies')}</p>
				{/each}
				{#if canReply && item.status === 'published'}
					<TextArea bind:value={draft} rows={2} autogrow maxRows={6} maxlength={REPLY_MAX} placeholder={t('community.replyPlaceholder')} aria-label={t('community.reply')} />
					<div class="row">
						<span class="end"><Button size="sm" disabled={!draft.trim()} busy={busy === 'reply'} onclick={sendReply}>{t('community.reply')}</Button></span>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</article>

<style>
	.cp {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) 0;
		border-top: var(--hairline-w) solid var(--color-border);
		text-align: left;
	}
	.cp.reply {
		padding: var(--space-2) 0 var(--space-2) var(--space-3);
		border-top: 0;
		border-left: 2px solid var(--color-border);
	}
	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.actions {
		margin-left: calc(-1 * var(--space-2));
	}
	.end {
		margin-left: auto;
	}
	.handle {
		font-weight: 600;
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: var(--leading-normal);
	}
	.on {
		color: var(--color-accent);
	}
	.tr {
		font-size: var(--text-caption);
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.menu,
	.replies {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
