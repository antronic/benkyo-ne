<!--
	Kanji gallery: every kanji the app teaches in one grid (lib/content/kanjiIndex.ts),
	filtered by where it is taught and searchable by meaning or reading.
	A tile opens the kanji page (watch the strokes, trace, write from memory).
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import { Card, Chip, IconButton, Notice, Skeleton, TextField } from '#lib/ui/index.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { leave } from '#lib/state/leave.ts';
	import { kanjiIndex } from '#lib/state/kanjiIndex.svelte.ts';
	import { matchesKanji, type GalleryKanji } from '#lib/content/kanjiIndex.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	type Filter = 'all' | 'lessons' | 'N5';
	let filter = $state<Filter>('all');
	let query = $state('');

	$effect(() => {
		ui.hue = 25;
	});
	onMount(() => void kanjiIndex.load().catch(() => {}));

	const FILTERS: { id: Filter; key: 'browse.all' | 'browse.lessons' | 'browse.level' }[] = [
		{ id: 'all', key: 'browse.all' },
		{ id: 'lessons', key: 'browse.lessons' },
		{ id: 'N5', key: 'browse.level' }
	];
	const inFilter = (k: GalleryKanji) => filter === 'all' || (filter === 'lessons' ? !!k.lesson : k.level === filter);
	const shown = $derived((kanjiIndex.list ?? []).filter((k) => inFilter(k) && matchesKanji(k, query)));
	/** Learned: its lesson card has been reviewed, or its unit is done. */
	const learned = (k: GalleryKanji) =>
		(!!k.lesson && (progress.cards[`kanji:${k.char}`]?.state ?? 'new') !== 'new') || (!!k.unit && progress.completed.includes(k.unit.id));
	const meaning = (k: GalleryKanji) => (k.lesson ? gloss(k.meaning) : k.meaning);
</script>

<main class="page stack" style:--gap="var(--space-3)">
	<header class="top">
		<IconButton label={t('common.back')} onclick={() => leave('/learn')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</IconButton>
		<div class="stack" style:--gap="0">
			<span class="eyebrow">⛰️ {t('browse.eyebrow')}</span>
			<h1 class="title-2">{t('browse.kanjiTitle')} · <span class="jp" lang="ja">漢字</span></h1>
		</div>
	</header>
	<p class="subhead">{t('browse.kanjiBlurb')}</p>

	<TextField bind:value={query} type="search" placeholder={t('browse.kanjiSearch')} aria-label={t('browse.kanjiSearch')} />
	<div class="filters" role="group" aria-label={t('learn.filter')}>
		{#each FILTERS as f (f.id)}
			<Chip selected={filter === f.id} onclick={() => (filter = f.id)}>{t(f.key, { level: 'N5' })}</Chip>
		{/each}
	</div>

	{#if kanjiIndex.failed}
		<Notice tone="warning">{t('browse.loadFailed')}</Notice>
	{:else if !kanjiIndex.list}
		<Skeleton variant="row" count={4} label={t('browse.loading')} />
	{:else}
		<p class="caption">{tn('browse.kanjiCount', shown.length)}</p>
		{#if shown.length === 0}
			<Notice>{t('browse.noMatch')}</Notice>
		{:else}
			<div class="grid">
				{#each shown as k (k.char)}
					<Card sheen padding="sm" href="/learn/browse/kanji/{encodeURIComponent(k.char)}" class="tile {learned(k) ? 'learned' : ''}" aria-label="{k.char}, {meaning(k)}">
						{#if learned(k)}<span class="tick" aria-hidden="true">✓</span>{/if}
						<span class="jp glyph" lang="ja">{k.char}</span>
						<span class="caption meaning">{meaning(k)}</span>
					</Card>
				{/each}
			</div>
		{/if}
		<p class="caption credit">{t('browse.kanjiCredit')}</p>
	{/if}
</main>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.filters {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: var(--space-2);
	}
	.grid :global(.tile) {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		text-align: center;
		min-width: 0;
	}
	.glyph {
		font-size: 2.25rem;
		font-weight: 600;
		line-height: 1.1;
	}
	.meaning {
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tick {
		position: absolute;
		top: var(--space-1);
		right: var(--space-2);
		font-size: 0.75rem;
		color: var(--success);
		font-weight: 700;
	}
	.credit {
		color: var(--ink-3);
	}
</style>
