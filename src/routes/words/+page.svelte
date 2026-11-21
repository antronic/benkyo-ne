<!-- Words hub: reading packs, card maker, tags, and your word/phrase cards. -->
<script lang="ts">
	import { firstRun } from '#lib/state/firstRun.svelte.ts';
	import { t as tr, tn, fmtDate } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import { Badge, Button, Card, Chip, FieldRow, LargeTitle, ListGroup, ListRow, Segmented, Sheet, Skeleton, TextField } from '#lib/ui/index.ts';
	import NoteCard from '#lib/components/NoteCard.svelte';
	import CommunityNotes from '#lib/components/CommunityNotes.svelte';
	import ContentFeedback from '#lib/components/ContentFeedback.svelte';
	import { notes } from '#lib/state/notes.svelte.ts';
	import { subjectKind, type Note } from '#lib/notes/contract.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { onMount } from 'svelte';
import WordCardView from '#lib/components/WordCardView.svelte';
import CardPoliteness from '#lib/components/CardPoliteness.svelte';
	import type { SightingVia, UserCard } from '#lib/ai/contract.ts';
	import { filterCounts, rankPhrasebook, viasOf, type PhrasebookFilter } from '#lib/words/phrasebook.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { unknownKanaIn } from '#lib/dict/readable.ts';
	import { NOW_TAG } from '#lib/content/courses.ts';
	import { ensurePacks, listPacks, MIN_KANA, type Pack } from '#lib/words/packs.ts';
	import { processOutbox } from '#lib/words/maker.ts';
	import { cardFocus } from '#lib/ai/threads.ts';
	import AskPeek from '#lib/components/AskPeek.svelte';
	import type { AskFocus } from '#lib/ai/contract.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	ui.hue = 285;
	let packs = $state<Pack[]>([]);
	/** false until the first read of the saved packs, so the shelf shows a skeleton, not "no packs" */
	let loaded = $state(false);
	let preparing = $state(false);
	let query = $state('');
	let filterTag = $state<string | null>(null);
	let open = $state<UserCard | null>(null);
	/** the word the Ask AI peek is about (over the card), or null when closed */
	let askAbout = $state<AskFocus | null>(null);
	let tagInput = $state('');
	/** Cards, your phrasebook (what comes up in your life), or every note you wrote (on cards, kana, kanji, units) */
	let view = $state<'cards' | 'phrasebook' | 'notes'>('cards');
	let pbFilter = $state<PhrasebookFilter>('all');
	const phrasebook = $derived(rankPhrasebook(words.list, pbFilter));
	const pbCounts = $derived(filterCounts(words.list));
	const PB_FILTERS: PhrasebookFilter[] = ['all', 'photo', 'lookup', 'writing'];
	const sources = (c: UserCard) => viasOf(c).map((v) => tr(`phrasebook.src.${v}`)).join(' · ');
	const viaIcon: Record<SightingVia, string> = { photo: '📷', lookup: '🔎', writing: '✍️', add: '＋' };
	let noteQuery = $state('');
	let openNote = $state<Note | null>(null);

	const shownNotes = $derived(
		notes.list.filter((n) => {
			const q = noteQuery.trim().toLowerCase();
			return !q || n.label.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
		})
	);
	const viewOptions = $derived([
		{ value: 'cards' as const, label: tr('notes.filterAll') },
		{ value: 'phrasebook' as const, label: tr('words.viewPhrasebook', { n: pbCounts.all }) },
		{ value: 'notes' as const, label: `${tr('notes.filter')} · ${notes.list.length}` }
	]);

	function openFromNote(n: Note) {
		const card = words.cards[n.subject];
		if (card && !card.deleted) {
			open = card;
			return;
		}
		openNote = n;
	}
	/** Where a note's item lives, when it has its own screen. */
	function noteHref(n: Note): string | null {
		if (subjectKind(n.subject) === 'unit') return `/learn/course/${n.subject.slice(5)}`;
		return null;
	}

	const ready = $derived(packs.filter((p) => p.status === 'ready'));
	const shown = $derived(
		words.list.filter(
			(c) =>
				(!filterTag || c.tags.includes(filterTag)) &&
				(!query.trim() ||
					[c.front, c.kanji ?? '', c.gloss, c.gloss2 ?? ''].some((s) => s.toLowerCase().includes(query.trim().toLowerCase())))
		)
	);

	async function refresh() { // ui-ok: instant local IndexedDB read; the first load shows the skeleton (loaded)
		packs = await listPacks();
	}

	onMount(async () => {
		await refresh();
		loaded = true;
		if (progress.knownKana.size >= MIN_KANA) {
			preparing = true;
			try {
				await ensurePacks();
				await processOutbox();
			} finally {
				preparing = false;
				await refresh();
			}
		}
	});

	function status(c: UserCard) {
		const s = progress.cards[c.id];
		if (words.isParked(c) && !s) return { label: tr('words.parked'), title: tr('words.parkedTitle') };
		if (!s || s.state === 'new') return { label: tr('words.new'), title: tr('words.newTitle') };
		return { label: s.state === 'review' ? tr('words.learningDone') : tr('words.learning'), title: '' };
	}

	async function addTag() { // ui-ok: instant local IndexedDB write
		if (!open || !tagInput.trim()) return;
		await words.setTags(open.id, [...open.tags, tagInput.trim()]);
		open = words.cards[open.id];
		tagInput = '';
		haptic('selection');
	}
	async function removeTag(t: string) { // ui-ok: instant local IndexedDB write
		if (!open) return;
		await words.setTags(open.id, open.tags.filter((x) => x !== t));
		open = words.cards[open.id];
	}
	async function learnNow() { // ui-ok: instant local IndexedDB write
		if (!open) return;
		await words.setTags(open.id, [...open.tags, NOW_TAG]);
		open = words.cards[open.id];
		haptic('success');
		toast(tr('words.addedToday'), '✓');
	}
	async function removeCard() { // ui-ok: instant local IndexedDB write
		if (!open) return;
		if (!(await confirmDestructive(tr('words.deleteTitle'), tr('words.deleteBody', { text: open.front }), tr('words.deleteConfirm')))) return;
		await words.remove(open.id);
		open = null;
		toast(tr('words.deleted'));
	}
</script>

<main class="page stack" style:--gap="var(--space-4)">
	<LargeTitle title={tr('nav.words')}>
		{#snippet trailing()}
			<Button variant="accent" size="sm" href="/words/new">{tr('words.make')}</Button>
		{/snippet}
	</LargeTitle>

	<!-- Ask AI and Community live under Words (docs/UX-FLOW.md, phase 4) -->
	<nav class="places" aria-label={tr('words.more')}>
		<Card sheen padding="sm" href="/ai" class="place" style="--h: 265">
			<span class="place-icon" aria-hidden="true">✨</span>
			<span class="stack" style:--gap="1px"><span class="headline">{tr('nav.ai')}</span><span class="caption">{tr('words.aiBody')}</span></span>
		</Card>
		<Card sheen padding="sm" href="/community" class="place" style="--h: 150">
			<span class="place-icon" aria-hidden="true">💬</span>
			<span class="stack" style:--gap="1px"><span class="headline">{tr('nav.community')}</span><span class="caption">{tr('words.communityBody')}</span></span>
		</Card>
	</nav>

	<!-- no AI notice for an account without AI, or a new one whose consent comes after its first lesson -->
	{#if !ai.available && ai.checked && ai.reason && ai.reasonKind !== 'noAi' && !(ai.reasonKind === 'consent' && firstRun.consentLater)}
		<p class="caption hint">✨ {ai.reason} {tr('words.dictStillWorks')}</p>
	{/if}

	<section class="stack" style:--gap="var(--space-2)">
		<h2 class="eyebrow">{tr('words.canRead')}</h2>
		{#if progress.knownKana.size < MIN_KANA}
			<Card>{tr('words.unlock')}</Card>
		{:else if ready.length}
			<div class="packs">
				{#each ready as p, i (p.id)}
					<Card sheen class="pack rise" style="--i: {i}" href="/words/pack/{p.id}">
						<span class="jp words">{p.items.slice(0, 3).map((x) => x.reading).join(' · ')}<Romaji text={p.items.slice(0, 3).map((x) => x.reading).join(' · ')} /></span>
						<span class="headline">{p.theme?.en ?? tn('words.nWords', p.items.length)}</span>
						{#if p.theme?.second}<span class="caption">{p.theme.second}</span>{/if}
						{#if !p.enriched}<span class="caption">{tr('words.dictOnly')}</span>{/if}
					</Card>
				{/each}
			</div>
		{:else if preparing || !loaded}
			<Skeleton variant="tile" count={3} label={tr('words.preparing')} />
		{:else}
			<Card><span class="caption">{tr('words.noPacks')}</span></Card>
		{/if}
	</section>

	{#if words.tags.length}
		<section class="stack" style:--gap="var(--space-2)">
			<h2 class="eyebrow">{tr('words.tags')}</h2>
			<div class="chips">
				{#each words.tags as t}
					<span class="chip-wrap">
						<Chip selected={filterTag === t.tag} count={t.count} onclick={() => (filterTag = filterTag === t.tag ? null : t.tag)}>{t.tag}</Chip>
						{#if filterTag === t.tag}
							<Chip tone="accent" href="/review?tag={encodeURIComponent(t.tag)}">{tr('words.drill')}</Chip>
						{/if}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<Segmented options={viewOptions} value={view} label={tr('nav.words')} onchange={(v) => (view = v)} />

	{#if view === 'phrasebook'}
	<section class="stack" style:--gap="var(--space-2)">
		<h2 class="eyebrow">{tr('phrasebook.title')}</h2>
		<p class="caption hint">{tr('phrasebook.intro')}</p>
		<div class="chips">
			{#each PB_FILTERS as f (f)}
				<Chip selected={pbFilter === f} count={pbCounts[f]} onclick={() => (pbFilter = f)}>{f === 'all' ? tr('phrasebook.all') : tr(`phrasebook.via.${f}`)}</Chip>
			{/each}
		</div>
		<ListGroup class="cards">
			{#each phrasebook as c, i (c.id)}
				{@const n = c.seen?.count ?? 0}
				<ListRow class="item" onclick={() => (open = c)}>
					{#snippet leading()}<span class="rank">{i + 1}</span>{/snippet}
					<span class="jp front">{c.kanji ?? c.front}</span>
					{#if c.kanji}<span class="jp kanji">{c.front}</span>{/if}
					<Romaji text={c.front} />
					<span class="caption">{gloss(c.gloss)}{n ? ` · ${sources(c)}` : ''}</span>
					{#snippet trailing()}
						{#if n}<span title={tr('phrasebook.seenTitle', { n })}><Badge tone="accent">{tr('phrasebook.seenN', { n })}</Badge></span>
						{:else}<span class="pill">{tr('phrasebook.notYet')}</span>{/if}
					{/snippet}
				</ListRow>
			{:else}
				<ListRow class="item"><span class="caption">{pbFilter === 'all' ? tr('phrasebook.empty') : tr('phrasebook.emptyFilter')}</span></ListRow>
			{/each}
		</ListGroup>
	</section>
	{:else if view === 'notes'}
	<section class="stack" style:--gap="var(--space-2)">
		<h2 class="eyebrow">{tr('notes.count', { n: notes.list.length })}</h2>
		{#if notes.list.length > 4}
			<TextField type="search" placeholder={tr('notes.search')} bind:value={noteQuery} aria-label={tr('notes.search')} />
		{/if}
		{#if !notes.ready}
			<Skeleton variant="row" count={3} label={tr('notes.loading')} />
		{:else}
			<ListGroup class="cards">
				{#each shownNotes as n (n.subject)}
					<ListRow class="item" onclick={() => openFromNote(n)}>
						<span class="note-row">
							<span class="row" style:--gap="var(--space-2)">
								<span class="jp front">{n.label}</span>
								<span class="pill">{tr(`notes.kind.${subjectKind(n.subject)}`)}</span>
							</span>
							<span class="caption snippet">{n.body}</span>
						</span>
					</ListRow>
				{:else}
					<ListRow class="item">
						<span class="caption">{noteQuery.trim() ? tr('notes.noMatch', { q: noteQuery.trim() }) : tr('notes.empty')}</span>
					</ListRow>
				{/each}
			</ListGroup>
		{/if}
	</section>
	{:else}
	<section class="stack" style:--gap="var(--space-2)">
		<div class="row">
			<h2 class="eyebrow">{tr('words.yourCards', { n: words.list.length })}</h2>
			<span class="spacer"></span>
			{#if words.newQueue.length}<span class="caption">{tr('words.readyN', { n: words.newQueue.length })}</span>{/if}
		</div>
		{#if words.list.length > 6}
			<TextField type="search" placeholder={tr('words.search')} bind:value={query} aria-label={tr('words.search')} />
		{/if}
		<ListGroup class="cards">
			{#each shown as c (c.id)}
				{@const st = status(c)}
				<ListRow class="item" onclick={() => (open = c)}>
					<span class="jp front">{c.front}</span>
					<Romaji text={c.front} />
					{#if c.kanji}<span class="jp kanji">{c.kanji}</span>{/if}
					<span class="caption">{gloss(c.gloss)}</span>
					{#snippet trailing()}
						{#if !c.verified}<span class="pill warn" title={tr('card.unverifiedTitle')}>?</span>{/if}
						<span class="pill" title={st.title}>{st.label}</span>
					{/snippet}
				</ListRow>
			{:else}
				<ListRow class="item"><span class="caption">{tr('words.empty')}</span></ListRow>
			{/each}
		</ListGroup>
	</section>
	{/if}
</main>

<Sheet open={!!open} label={tr('words.card')} onclose={() => (open = null)}>
	{#if open}
		<WordCardView card={open} />
		<CardPoliteness id={open.id} written={open.kanji ?? open.front} />
		<!-- no AI on this account (no package, no key) is normal: no Ask button to nag about it -->
		{#if ai.reasonKind !== 'noAi'}
			<Button variant="ghost" block onclick={() => (askAbout = cardFocus(open!))}>💬 {tr('words.askAi')}</Button>
			{#if ai.checked && !ai.available && ai.reason}<p class="caption ask-hint">✨ {ai.reason}</p>{/if}
		{/if}
		{#if open.seen?.count}
			<section class="stack where" style:--gap="var(--space-1h)">
				<h3 class="eyebrow">{tr('phrasebook.where')}</h3>
				<span class="caption">{tr('phrasebook.whereCount', { n: open.seen.count })}</span>
				{#each open.seen.recent as s (s.at + s.via)}
					<span class="row met" style:--gap="var(--space-2)">
						<span aria-hidden="true">{viaIcon[s.via]}</span>
						<span class="met-text">
							<span class="caption">{tr(`phrasebook.src.${s.via}`)} · {fmtDate(s.at, { day: 'numeric', month: 'short' })}</span>
							{#if s.ctx}<span class="jp ctx">{s.ctx}</span>{/if}
						</span>
					</span>
				{/each}
			</section>
		{/if}
		{#key open.id}
			{@const card = open}
			<NoteCard value={notes.text(card.id)} loading={!notes.ready} onsave={(b) => notes.save(card.id, card.front, b)} />
			<ContentFeedback subject={card.id} label={card.front} />
			<CommunityNotes subject={card.id} label={card.front} note={notes.text(card.id)} />
		{/key}
		{#if words.isParked(open) && !progress.cards[open.id]}
			{@const missing = unknownKanaIn(open.front, progress.knownKana)}
			<p class="caption parked">
				⏸ {tr('words.parkedUntil')}
				{#each missing as k}<span class="jp need">{k}<Romaji text={k} /></span>{/each}
				{tr('words.parkedThen')}
			</p>
			<Button variant="ghost" size="sm" onclick={learnNow}>{tr('words.learnAnyway')}</Button>
		{/if}
		<div class="chips">
			{#each open.tags.filter((t) => !t.startsWith('~')) as t}<Chip selected onclick={() => removeTag(t)}>{t} ✕</Chip>{/each}
		</div>
		<FieldRow as="form" onsubmit={addTag}>
			<TextField grow placeholder={tr('words.addTagPlaceholder')} bind:value={tagInput} aria-label={tr('words.addTagPlaceholder')} enterkeyhint="done" />
			<Button type="submit" variant="ghost">{tr('words.add')}</Button>
		</FieldRow>
		<Button variant="ghost-danger" block onclick={removeCard}>{tr('words.deleteCard')}</Button>
	{/if}
</Sheet>

<AskPeek focus={askAbout} back="/words" onclose={() => (askAbout = null)} />

<Sheet open={!!openNote} label={tr('notes.mine')} onclose={() => (openNote = null)}>
	{#if openNote}
		{@const n = openNote}
		<div class="row" style:--gap="var(--space-2)">
			<span class="jp title-2">{n.label}</span>
			<span class="pill">{tr(`notes.kind.${subjectKind(n.subject)}`)}</span>
		</div>
		<NoteCard value={notes.text(n.subject)} onsave={(b) => notes.save(n.subject, n.label, b)} />
		{#if noteHref(n)}<Button variant="ghost" block href={noteHref(n) ?? undefined}>{tr('notes.open')}</Button>{/if}
	{/if}
</Sheet>

<style>
	.places {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.places :global(.place) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.place-icon {
		font-size: 1.375rem;
		line-height: 1.2;
	}
	.note-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.snippet {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		white-space: pre-wrap;
	}
	.hint,
	.ask-hint {
		margin: 0;
	}
	.rank {
		display: inline-grid;
		place-items: center;
		min-width: 28px;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.where .met {
		align-items: flex-start;
	}
	.met-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.ctx {
		overflow-wrap: anywhere;
	}
.packs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	.packs :global(.pack) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		border-radius: var(--r-m);
		min-height: 104px;
	}
	.words {
		font-size: 1.25rem;
		color: var(--accent-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip-wrap {
		display: inline-flex;
		gap: var(--space-1);
	}
	section :global(.cards) {
		padding: 0;
		border-radius: var(--r-m);
	}
	section :global(.item) {
		min-height: 56px;
	}
	.front {
		font-size: 1.125rem;
	}
	.kanji {
		color: var(--ink-2);
		font-size: 0.9375rem;
	}
	.pill {
		font-size: 0.75rem;
		padding: var(--space-1) var(--space-2);
		border-radius: 999px;
		background: var(--hairline);
		color: var(--ink-2);
		white-space: nowrap;
	}
	.pill.warn {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
		color: var(--ink);
	}
	.parked {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1h);
	}
	.need {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-width: 34px;
		padding: var(--space-1) var(--space-1h);
		border-radius: 10px;
		background: var(--glass-strong);
		border: 0.5px solid var(--hairline);
		font-size: 1.125rem;
		color: var(--ink);
	}
</style>
