<!-- Words hub: reading packs, card maker, tags, and your word/phrase cards. -->
<script lang="ts">
	import { t as tr, tn } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import { Button, Card, Chip, FieldRow, LargeTitle, ListGroup, ListRow, Sheet, Skeleton, TextField } from '#lib/ui/index.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { onMount } from 'svelte';
import WordCardView from '#lib/components/WordCardView.svelte';
	import type { UserCard } from '#lib/ai/contract.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { unknownKanaIn } from '#lib/dict/readable.ts';
	import { NOW_TAG } from '#lib/content/courses.ts';
	import { ensurePacks, listPacks, MIN_KANA, type Pack } from '#lib/words/packs.ts';
	import { processOutbox } from '#lib/words/maker.ts';
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
	let tagInput = $state('');

	const ready = $derived(packs.filter((p) => p.status === 'ready'));
	const shown = $derived(
		words.list.filter(
			(c) =>
				(!filterTag || c.tags.includes(filterTag)) &&
				(!query.trim() ||
					[c.front, c.kanji ?? '', c.gloss, c.gloss2 ?? ''].some((s) => s.toLowerCase().includes(query.trim().toLowerCase())))
		)
	);

	async function refresh() {
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

	async function addTag() {
		if (!open || !tagInput.trim()) return;
		await words.setTags(open.id, [...open.tags, tagInput.trim()]);
		open = words.cards[open.id];
		tagInput = '';
		haptic('selection');
	}
	async function removeTag(t: string) {
		if (!open) return;
		await words.setTags(open.id, open.tags.filter((x) => x !== t));
		open = words.cards[open.id];
	}
	async function learnNow() {
		if (!open) return;
		await words.setTags(open.id, [...open.tags, NOW_TAG]);
		open = words.cards[open.id];
		haptic('success');
		toast(tr('words.addedToday'), '✓');
	}
	async function removeCard() {
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

	{#if !ai.available && ai.checked && ai.reason}
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
</main>

<Sheet open={!!open} label={tr('words.card')} onclose={() => (open = null)}>
	{#if open}
		<WordCardView card={open} />
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

<style>
	.hint {
		margin: 0;
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
