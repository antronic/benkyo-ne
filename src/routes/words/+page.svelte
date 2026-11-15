<!-- Words hub: reading packs, card maker, tags, and your word/phrase cards. -->
<script lang="ts">
	import { t as tr, tn } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import Romaji from '#lib/components/Romaji.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
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

<main class="page stack" style:--gap="14px">
	<LargeTitle title={tr('nav.words')}>
		{#snippet trailing()}
			<button class="btn accent small" onclick={() => goto('/words/new')}>{tr('words.make')}</button>
		{/snippet}
	</LargeTitle>

	{#if !ai.available && ai.checked && ai.reason}
		<p class="caption hint">✨ {ai.reason} {tr('words.dictStillWorks')}</p>
	{/if}

	<section class="stack" style:--gap="8px">
		<h2 class="eyebrow">{tr('words.canRead')}</h2>
		{#if progress.knownKana.size < MIN_KANA}
			<div class="glass card">{tr('words.unlock')}</div>
		{:else if ready.length}
			<div class="packs">
				{#each ready as p, i (p.id)}
					<a class="pack glass sheen rise" style:--i={i} href="/words/pack/{p.id}">
						<span class="jp words">{p.items.slice(0, 3).map((x) => x.reading).join(' · ')}<Romaji text={p.items.slice(0, 3).map((x) => x.reading).join(' · ')} /></span>
						<span class="headline">{p.theme?.en ?? tn('words.nWords', p.items.length)}</span>
						{#if p.theme?.second}<span class="caption">{p.theme.second}</span>{/if}
						{#if !p.enriched}<span class="caption">{tr('words.dictOnly')}</span>{/if}
					</a>
				{/each}
			</div>
		{:else if preparing}
			<Skeleton variant="tile" count={3} label={tr('words.preparing')} />
		{:else}
			<div class="glass card caption">{tr('words.noPacks')}</div>
		{/if}
	</section>

	{#if words.tags.length}
		<section class="stack" style:--gap="8px">
			<h2 class="eyebrow">{tr('words.tags')}</h2>
			<div class="chips">
				{#each words.tags as t}
					<span class="chip-wrap">
						<button class="chip" class:on={filterTag === t.tag} onclick={() => (filterTag = filterTag === t.tag ? null : t.tag)}>
							{t.tag} <span class="count">{t.count}</span>
						</button>
						{#if filterTag === t.tag}
							<a class="chip drill" href="/review?tag={encodeURIComponent(t.tag)}">{tr('words.drill')}</a>
						{/if}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="stack" style:--gap="8px">
		<div class="row">
			<h2 class="eyebrow">{tr('words.yourCards', { n: words.list.length })}</h2>
			<span class="spacer"></span>
			{#if words.newQueue.length}<span class="caption">{tr('words.readyN', { n: words.newQueue.length })}</span>{/if}
		</div>
		{#if words.list.length > 6}
			<input type="text" placeholder={tr('words.search')} bind:value={query} aria-label={tr('words.search')} />
		{/if}
		<div class="glass list">
			{#each shown as c (c.id)}
				{@const st = status(c)}
				<button class="item" onclick={() => (open = c)}>
					<span class="stack" style:--gap="0">
						<span class="jp">{c.front}</span>
						<Romaji text={c.front} />
						{#if c.kanji}<span class="jp kanji">{c.kanji}</span>{/if}
						<span class="caption">{gloss(c.gloss)}</span>
					</span>
					<span class="spacer"></span>
					{#if !c.verified}<span class="pill warn" title={tr('card.unverifiedTitle')}>?</span>{/if}
					<span class="pill" title={st.title}>{st.label}</span>
				</button>
			{:else}
				<div class="item caption">{tr('words.empty')}</div>
			{/each}
		</div>
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
			<button class="btn ghost small" onclick={learnNow}>{tr('words.learnAnyway')}</button>
		{/if}
		<div class="chips">
			{#each open.tags.filter((t) => !t.startsWith('~')) as t}<button class="chip on" onclick={() => removeTag(t)}>{t} ✕</button>{/each}
		</div>
		<div class="row">
			<input type="text" placeholder={tr('words.addTagPlaceholder')} bind:value={tagInput} onkeydown={(e) => e.key === 'Enter' && addTag()} />
			<button class="btn ghost small" onclick={addTag}>{tr('words.add')}</button>
		</div>
		<button class="btn ghost block danger" onclick={removeCard}>{tr('words.deleteCard')}</button>
	{/if}
</Sheet>

<style>
	.hint {
		margin: 0;
	}
	.card {
		padding: 16px;
		border-radius: var(--r-m);
	}
	.packs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.pack {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px;
		border-radius: var(--r-m);
		text-decoration: none;
		color: inherit;
		min-height: 104px;
		transition: transform 380ms var(--spring);
	}
	.pack:active {
		transform: scale(0.96);
	}
	.words {
		font-size: 1.25rem;
		color: var(--accent-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip-wrap {
		display: inline-flex;
		gap: 4px;
	}
	.chip {
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		border-radius: 999px;
		padding: 8px 14px;
		min-height: 36px;
		font-size: 0.9375rem;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.chip.on {
		background: var(--accent-2);
		color: #fff;
	}
	.chip.drill {
		background: var(--accent);
		color: #fff;
		font-weight: 600;
	}
	.count {
		opacity: 0.6;
		font-size: 0.8125rem;
	}
	.list {
		border-radius: var(--r-m);
		overflow: hidden;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 12px 16px;
		min-height: 56px;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.item + .item {
		border-top: 0.5px solid var(--hairline);
	}
	.item .jp {
		font-size: 1.125rem;
	}
	.item .kanji {
		color: var(--ink-2);
		font-size: 0.9375rem;
	}
	.item > .stack {
		min-width: 0;
	}
	.pill {
		font-size: 0.75rem;
		padding: 3px 8px;
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
		gap: 6px;
	}
	.need {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-width: 34px;
		padding: 4px 6px;
		border-radius: 10px;
		background: var(--glass-strong);
		border: 0.5px solid var(--hairline);
		font-size: 1.125rem;
		color: var(--ink);
	}
	.danger {
		color: var(--danger);
	}
</style>
