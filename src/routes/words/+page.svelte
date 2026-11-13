<!-- Words hub: reading packs, card maker, tags, and your word/phrase cards. -->
<script lang="ts">
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
		if (words.isParked(c) && !s) return { label: 'parked', title: 'Uses kana you haven’t learned yet' };
		if (!s || s.state === 'new') return { label: 'new', title: 'Not introduced yet' };
		return { label: s.state === 'review' ? 'learning ✓' : 'learning', title: '' };
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
	async function removeCard() {
		if (!open) return;
		if (!(await confirmDestructive('Delete this card?', `“${open.front}” and its review history stop appearing.`, 'Delete Card'))) return;
		await words.remove(open.id);
		open = null;
		toast('Card deleted');
	}
</script>

<main class="page stack" style:--gap="14px">
	<LargeTitle title="Words">
		{#snippet trailing()}
			<button class="btn accent small" onclick={() => goto('/words/new')}>＋ Make card</button>
		{/snippet}
	</LargeTitle>

	{#if !ai.available && ai.checked && ai.reason}
		<p class="caption hint">✨ {ai.reason} Dictionary features still work.</p>
	{/if}

	<section class="stack" style:--gap="8px">
		<h2 class="eyebrow">Words you can read</h2>
		{#if progress.knownKana.size < MIN_KANA}
			<div class="glass card">Finish the first two kana lessons to unlock reading packs with real words.</div>
		{:else if ready.length}
			<div class="packs">
				{#each ready as p, i (p.id)}
					<a class="pack glass sheen rise" style:--i={i} href="/words/pack/{p.id}">
						<span class="jp words">{p.items.slice(0, 3).map((x) => x.reading).join(' · ')}<Romaji text={p.items.slice(0, 3).map((x) => x.reading).join(' · ')} /></span>
						<span class="headline">{p.theme?.en ?? `${p.items.length} words`}</span>
						{#if p.theme?.second}<span class="caption">{p.theme.second}</span>{/if}
						{#if !p.enriched}<span class="caption">dictionary only</span>{/if}
					</a>
				{/each}
			</div>
		{:else}
			<div class="glass card caption">{preparing ? 'Preparing packs…' : 'No packs yet. They appear as you learn more kana.'}</div>
		{/if}
	</section>

	{#if words.tags.length}
		<section class="stack" style:--gap="8px">
			<h2 class="eyebrow">Tags · tap to drill</h2>
			<div class="chips">
				{#each words.tags as t}
					<span class="chip-wrap">
						<button class="chip" class:on={filterTag === t.tag} onclick={() => (filterTag = filterTag === t.tag ? null : t.tag)}>
							{t.tag} <span class="count">{t.count}</span>
						</button>
						{#if filterTag === t.tag}
							<a class="chip drill" href="/review?tag={encodeURIComponent(t.tag)}">Drill ›</a>
						{/if}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="stack" style:--gap="8px">
		<div class="row">
			<h2 class="eyebrow">Your cards · {words.list.length}</h2>
			<span class="spacer"></span>
			{#if words.newQueue.length}<span class="caption">{words.newQueue.length} ready to learn</span>{/if}
		</div>
		{#if words.list.length > 6}
			<input type="text" placeholder="Search cards" bind:value={query} aria-label="Search cards" />
		{/if}
		<div class="glass list">
			{#each shown as c (c.id)}
				{@const st = status(c)}
				<button class="item" onclick={() => (open = c)}>
					<span class="stack" style:--gap="0">
						<span><span class="jp">{c.front}</span>{#if c.kanji}<span class="jp kanji"> {c.kanji}</span>{/if}<Romaji text={c.front} inline /></span>
						<span class="caption">{c.gloss}</span>
					</span>
					<span class="spacer"></span>
					{#if !c.verified}<span class="pill warn" title="Not in the dictionary">?</span>{/if}
					<span class="pill" title={st.title}>{st.label}</span>
				</button>
			{:else}
				<div class="item caption">No cards yet. Tap “＋ Make card” to add a word or phrase from English, Japanese, romaji, a screenshot or a scenario.</div>
			{/each}
		</div>
	</section>
</main>

<Sheet open={!!open} label="Card" onclose={() => (open = null)}>
	{#if open}
		<WordCardView card={open} />
		{#if words.isParked(open) && !progress.cards[open.id]}
			<p class="caption">⏸ Parked: it joins your reviews once you’ve learned all the kana in <span class="jp">{open.front}</span><Romaji text={open.front} inline />.</p>
		{/if}
		<div class="chips">
			{#each open.tags as t}<button class="chip on" onclick={() => removeTag(t)}>{t} ✕</button>{/each}
		</div>
		<div class="row">
			<input type="text" placeholder="Add tag, e.g. ramen shop" bind:value={tagInput} onkeydown={(e) => e.key === 'Enter' && addTag()} />
			<button class="btn ghost small" onclick={addTag}>Add</button>
		</div>
		<button class="btn ghost block danger" onclick={removeCard}>Delete card</button>
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
	.kanji {
		color: var(--ink-2);
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
	.danger {
		color: var(--danger);
	}
</style>
