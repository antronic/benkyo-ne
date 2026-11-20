<!--
	Community home (docs/COMMUNITY.md): every note learners shared, on every
	word, kana, kanji and unit, newest or most liked (last 30 days) first.
	Tapping the item a note is about opens that item's sheet: your own note and
	all the shared notes on it, where you can share yours. Signed in only.
-->
<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { Button, Card, LargeTitle, Notice, Segmented, Sheet, Skeleton } from '#lib/ui/index.ts';
	import CommunityPost from '#lib/components/CommunityPost.svelte';
	import CommunityNotes from '#lib/components/CommunityNotes.svelte';
	import NoteCard from '#lib/components/NoteCard.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { community } from '#lib/state/community.svelte.ts';
	import { notes } from '#lib/state/notes.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { communityApi, CommunityRequestError } from '#lib/community/client.ts';
	import type { FeedSort, Post } from '#lib/community/contract.ts';
	import { subjectKind } from '#lib/notes/contract.ts';

	ui.hue = 330;
	const api = communityApi;

	let sort = $state<FeedSort>('new');
	let posts = $state<Post[] | null>(null);
	let next = $state<number | null>(null);
	let failed = $state<MessageKey | null>(null);
	let more = $state(false);
	let canReply = $state(false);
	let open = $state<{ subject: string; label: string } | null>(null);

	async function load(s: FeedSort) {
		failed = null;
		posts = null;
		try {
			const id = ai.account?.id;
			const [f, m] = await Promise.all([api.getFeed(s), id !== undefined ? community.ensure(id, api.communityMe).catch(() => null) : null]);
			posts = f.posts;
			next = f.next;
			canReply = !!m?.canPost;
		} catch (e) {
			failed = e instanceof CommunityRequestError && (e.problem === 'offline' || e.problem === 'network') ? 'community.offline' : 'community.loadFailedHint';
		}
	}

	async function loadMore() {
		if (next === null) return;
		more = true;
		try {
			const f = await api.getFeed(sort, next);
			posts = [...(posts ?? []), ...f.posts.filter((p) => !posts?.some((x) => x.id === p.id))];
			next = f.next;
		} catch {
			failed = 'community.loadFailedHint';
		} finally {
			more = false;
		}
	}

	$effect(() => {
		const s = sort;
		if (ai.signedIn) void load(s);
	});

	const KIND: Record<string, MessageKey> = {
		word: 'community.kind.word',
		phrase: 'community.kind.word',
		kana: 'community.kind.kana',
		kanji: 'community.kind.kanji',
		unit: 'community.kind.unit',
		lesson: 'community.kind.lesson',
		pack: 'community.kind.pack'
	};
	const kindOf = (subject: string) => t(KIND[subjectKind(subject)] ?? 'community.kind.word');

	function blocked(h: string) {
		if (posts) posts = posts.filter((p) => p.handle !== h);
	}
</script>

<svelte:head><title>{t('nav.community')} · Benkyo</title></svelte:head>

<main class="page stack" style:--gap="var(--space-4)">
	<LargeTitle title={t('nav.community')} />
	<p class="subhead lede">{t('community.homeLede')}</p>

	{#if !ai.checked}
		<Skeleton variant="card" count={2} label={t('community.loading')} />
	{:else if !ai.signedIn}
		<Card padding="lg" class="stack" style="--gap: var(--space-3)">
			<span>{t('community.signIn')}</span>
			<div><Button size="sm" href="/settings">{t('community.signInGo')}</Button></div>
		</Card>
	{:else}
		<Segmented
			label={t('community.sort')}
			bind:value={sort}
			options={[
				{ value: 'new', label: t('community.sortNew') },
				{ value: 'top', label: t('community.sortTop') }
			]}
		/>
		{#if failed && !posts}
			<Notice tone="warning" title={t('community.loadFailed')}>
				{#snippet action()}<Button size="sm" variant="ghost" onclick={() => load(sort)}>{t('boot.retry')}</Button>{/snippet}
				{t(failed)}
			</Notice>
		{:else if !posts}
			<Skeleton variant="card" count={3} label={t('community.loading')} />
		{:else if !posts.length}
			<Card padding="lg"><span class="caption">{sort === 'top' ? t('community.homeEmptyTop') : t('community.homeEmpty')}</span></Card>
		{:else}
			<Card padding="md" class="feed">
				{#each posts as p (p.id)}
					<div class="item">
						<Button variant="plain" size="sm" class="about" onclick={() => (open = { subject: p.subject!, label: p.label })} aria-label={t('community.openItem', { label: p.label })}>
							<span class="jp label">{p.label}</span>
							<span class="caption">{kindOf(p.subject ?? '')} ›</span>
						</Button>
						<CommunityPost kind="post" item={p} {api} {canReply} canTranslate={ai.available} onblocked={blocked} onremoved={() => (posts = posts!.filter((x) => x.id !== p.id))} />
					</div>
				{/each}
			</Card>
			{#if failed}<Notice tone="warning">{t(failed)}</Notice>{/if}
			{#if next !== null}
				<div><Button variant="ghost" busy={more} onclick={loadMore}>{t('community.loadMore')}</Button></div>
			{/if}
		{/if}
	{/if}
</main>

<Sheet open={!!open} label={open?.label ?? ''} onclose={() => (open = null)}>
	{#if open}
		{#key open.subject}
			{@const it = open}
			<h2 class="jp sheet-title">{it.label}</h2>
			<span class="caption">{kindOf(it.subject)}</span>
			<NoteCard value={notes.text(it.subject)} loading={!notes.ready} onsave={(b) => notes.save(it.subject, it.label, b)} />
			<CommunityNotes subject={it.subject} label={it.label} note={notes.text(it.subject)} />
		{/key}
	{/if}
</Sheet>

<style>
	.lede {
		margin: 0;
		color: var(--color-text-2);
	}
	:global(.feed) {
		display: flex;
		flex-direction: column;
	}
	.item {
		display: flex;
		flex-direction: column;
	}
	.item + .item {
		margin-top: var(--space-2);
	}
	:global(.about) {
		align-self: flex-start;
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.label {
		font-size: var(--text-title-3);
		font-weight: 600;
	}
	.sheet-title {
		margin: 0;
		font-size: var(--text-title-1);
	}
</style>
