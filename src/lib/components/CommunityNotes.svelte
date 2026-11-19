<!--
	Community notes under "My note" on a study item (docs/COMMUNITY.md): notes
	other learners shared on the same word, kana, kanji or unit, most liked first,
	and a Share button that publishes a copy of your own note. The first share
	asks for a public handle and the community guidelines. Signed in only.

	  <CommunityNotes subject="kana:あ" label="あ" note={notes.text('kana:あ')} />

	`api`, `signedIn`, `accountId` and `canTranslate` default to the real ones; /design passes fakes.
-->
<script lang="ts">
	import { t, tn, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Button, Card, Checkbox, Notice, Segmented, Skeleton, TextField } from '#lib/ui/index.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { community } from '#lib/state/community.svelte.ts';
	import { communityApi, CommunityRequestError, problemKey, type CommunityApi } from '#lib/community/client.ts';
	import { guessLang, HANDLE_RE, POST_MAX, type Lang, type Me, type Post, type SubjectNotes } from '#lib/community/contract.ts';
	import CommunityPost from './CommunityPost.svelte';

	type Props = {
		subject: string;
		label: string;
		/** your private note on this item */
		note: string;
		api?: CommunityApi;
		signedIn?: boolean;
		accountId?: number;
		/** offer 文A Translate (defaults to: AI is available) */
		canTranslate?: boolean;
		class?: string;
	};
	let { subject, label, note, api = communityApi, signedIn: signedInProp, accountId: accountProp, canTranslate: translateProp, class: cls = '' }: Props = $props();
	const signedIn = $derived(signedInProp ?? ai.signedIn);
	const accountId = $derived(accountProp ?? ai.account?.id);
	const canTranslate = $derived(translateProp ?? ai.available);

	const SHOWN = 3;
	let data = $state<SubjectNotes | null>(null);
	let failed = $state<MessageKey | null>(null);
	let me = $state<Me | null>(null);
	let all = $state(false);

	let sharing = $state(false);
	let handle = $state('');
	let agreed = $state(false);
	let lang = $state<Lang>('en');
	let busy = $state(false);
	let shareError = $state<MessageKey | null>(null);
	let shared = $state(false);

	const body = $derived(note.trim());
	const mine = $derived(data?.mine ?? null);
	const changed = $derived(!!mine && !!body && body !== mine.body);
	const posts = $derived(data ? (all ? data.posts : data.posts.slice(0, SHOWN)) : []);
	const needsProfile = $derived(!me?.canPost && (!me?.profile || me.profile.status === 'active'));
	const handleOk = $derived(HANDLE_RE.test(handle.trim().replace(/^@/, '').toLowerCase()));

	async function load() {
		failed = null;
		data = null;
		try {
			const meLoad = api === communityApi && accountId !== undefined ? community.ensure(accountId, api.communityMe) : api.communityMe();
			const [d, m] = await Promise.all([api.subjectNotes(subject), meLoad]);
			data = d;
			me = m;
		} catch (e) {
			failed = e instanceof CommunityRequestError && (e.problem === 'offline' || e.problem === 'network') ? 'community.offline' : 'community.loadFailedHint';
		}
	}

	$effect(() => {
		void subject;
		if (signedIn) void load();
	});

	function openShare() {
		sharing = true;
		shared = false;
		shareError = null;
		lang = guessLang(body);
		handle = me?.profile?.handle ?? '';
	}

	async function share() {
		if (!body) return;
		busy = true;
		shareError = null;
		try {
			if (needsProfile) {
				me = api === communityApi ? await community.join(handle, me!.guidelinesVersion, api.setProfile) : await api.setProfile(handle, me!.guidelinesVersion);
			}
			const post: Post = await api.shareNote(subject, label, body, mine && !sharing ? mine.lang : lang);
			data = { ...data!, mine: post };
			sharing = false;
			shared = true;
			haptic('success');
		} catch (e) {
			shareError = problemKey(e) as MessageKey;
		} finally {
			busy = false;
		}
	}

	function blocked(h: string) {
		if (!data) return;
		const left = data.posts.filter((p) => p.handle !== h);
		data = { ...data, posts: left, total: data.total - (data.posts.length - left.length) };
	}
</script>

<Card padding="md" class="community-notes {cls}" aria-label={t('community.title')}>
	<div class="head">
		<span class="headline">{t('community.title')}</span>
		{#if data}<span class="caption">{data.total}</span>{/if}
	</div>

	{#if !signedIn}
		<p class="caption">{t('community.signIn')}</p>
	{:else if failed}
		<Notice tone="warning" title={t('community.loadFailed')}>
			{#snippet action()}<Button size="sm" variant="ghost" onclick={load}>{t('boot.retry')}</Button>{/snippet}
			{t(failed)}
		</Notice>
	{:else if !data || !me}
		<Skeleton variant="line" count={2} label={t('community.loading')} />
	{:else}
		{#if mine}
			<CommunityPost kind="post" item={mine} {api} canReply={me.canPost} onremoved={() => (data = { ...data!, mine: null })} />
			{#if changed}
				<div class="row">
					<span class="caption">{t('community.changed')}</span>
					<span class="end"><Button size="sm" variant="ghost" {busy} onclick={share}>{t('community.update')}</Button></span>
				</div>
			{/if}
		{:else if sharing}
			<div class="share">
				{#if me.profile && me.profile.status !== 'active'}
					<Notice tone="warning">{t(me.profile.status === 'muted' ? 'community.err.muted' : 'community.err.banned')}</Notice>
				{:else}
					{#if needsProfile}
						<p class="caption">{t('community.firstTime')}</p>
						<TextField
							label={t('community.handle')}
							hint={t('community.handleHint')}
							bind:value={handle}
							maxlength={21}
							autocomplete="off"
							autocapitalize="off"
							spellcheck={false}
							placeholder="sakura_learns"
						/>
						<div class="rules">
							<p class="label">{t('community.guidelines')}</p>
							<ul>
								<li>{t('community.rule.kind')}</li>
								<li>{t('community.rule.own')}</li>
								<li>{t('community.rule.private')}</li>
								<li>{t('community.rule.public')}</li>
								<li>{t('community.rule.keep')}</li>
							</ul>
							<Checkbox bind:checked={agreed}>{t('community.agree')}</Checkbox>
						</div>
					{/if}
					<p class="label">{t('community.preview')}</p>
					<div class="preview">
						<span class="handle">@{needsProfile ? handle.trim().replace(/^@/, '').toLowerCase() || '…' : me.profile?.handle}</span>
						<p class="body">{body.slice(0, POST_MAX)}</p>
					</div>
					<Segmented
						label={t('community.lang')}
						bind:value={lang}
						options={[
							{ value: 'en', label: 'English' },
							{ value: 'th', label: 'ไทย' },
							{ value: 'ja', label: '日本語' }
						]}
					/>
					<p class="caption">{t('community.shareHint')}</p>
					<div class="row">
						<Button size="sm" {busy} disabled={needsProfile && (!handleOk || !agreed)} onclick={share}>{t('community.share')}</Button>
						<Button size="sm" variant="ghost" onclick={() => (sharing = false)}>{t('common.cancel')}</Button>
					</div>
				{/if}
			</div>
		{:else if body}
			<div class="row">
				<span class="caption">{t('community.shareAsk')}</span>
				<span class="end"><Button size="sm" variant="ghost" onclick={openShare}>↗ {t('community.shareMine')}</Button></span>
			</div>
		{:else}
			<p class="caption">{t('community.writeFirst')}</p>
		{/if}

		{#if shareError}
			<Notice tone="danger">{t(shareError)}</Notice>
		{:else if shared}
			<Notice tone="success">{t('community.sharedNow')}</Notice>
		{/if}

		{#each posts as p (p.id)}
			<CommunityPost kind="post" item={p} {api} canReply={me.canPost} {canTranslate} onblocked={blocked} />
		{:else}
			<p class="caption">{t('community.empty')}</p>
		{/each}
		{#if !all && data.posts.length > SHOWN}
			<div><Button size="sm" variant="ghost" onclick={() => (all = true)}>{tn('community.showAll', data.posts.length)}</Button></div>
		{/if}
	{/if}
</Card>

<style>
	:global(.community-notes) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		text-align: left;
	}
	.head,
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-sm);
	}
	.end {
		margin-left: auto;
	}
	.share {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.label {
		margin: 0;
		font-weight: 600;
		font-size: var(--text-footnote);
	}
	.rules ul {
		margin: var(--space-1) 0 var(--space-2);
		padding-left: var(--space-5);
		color: var(--color-text-2);
		font-size: var(--text-footnote);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border-radius: var(--radius-control);
		background: var(--color-fill);
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
</style>
