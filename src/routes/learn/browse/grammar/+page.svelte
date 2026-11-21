<!--
	Grammar index: every grammar point of the level units the learner can see,
	unit by unit, searchable by pattern or meaning. A row opens the point in its unit.
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { et } from '#lib/i18n/content.ts';
	import { Button, Card, IconButton, Notice, SectionHeader, Skeleton, TextField } from '#lib/ui/index.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { leave } from '#lib/state/leave.ts';
	import { LEVELS, isDraft, visibleUnits } from '#lib/content/levels/index.ts';
	import { levels } from '#lib/state/levels.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	let loading = $state(true);
	let query = $state('');
	$effect(() => {
		ui.hue = 150;
	});
	onMount(async () => {
		await Promise.all(LEVELS.map((l) => levels.load(l.id)));
		loading = false;
	});

	const q = $derived(query.trim().toLowerCase());
	const hit = (s: string) => s.toLowerCase().includes(q);
	const groups = $derived(
		LEVELS.map((l) => {
			const all = levels.units[l.id] ?? [];
			const units = visibleUnits(all, progress.settings.showDraftUnits)
				.map((u) => ({ u, n: all.indexOf(u) + 1, points: u.grammar.filter((g) => !q || hit(g.pattern) || hit(g.meaning.en) || hit(g.meaning.th) || hit(g.formation)) }))
				.filter((x) => x.points.length);
			return { l, units, hidden: all.length - visibleUnits(all, progress.settings.showDraftUnits).length };
		})
	);
	const total = $derived(groups.reduce((s, g) => s + g.units.reduce((a, x) => a + x.points.length, 0), 0));
	const hiddenAll = $derived(groups.every((g) => g.units.length === 0) && groups.some((g) => g.hidden > 0) && !q);
</script>

<main class="page stack" style:--gap="var(--space-3)">
	<header class="top">
		<IconButton label={t('common.back')} onclick={() => leave('/learn')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</IconButton>
		<div class="stack" style:--gap="0">
			<span class="eyebrow">📐 {t('browse.eyebrow')}</span>
			<h1 class="title-2">{t('browse.grammarTitle')} · <span class="jp" lang="ja">文法</span></h1>
		</div>
	</header>
	<p class="subhead">{t('browse.grammarBlurb')}</p>

	{#if loading}
		<Skeleton variant="row" count={4} label={t('browse.loading')} />
	{:else if hiddenAll}
		<Notice>{t('browse.grammarDrafts')}</Notice>
		<Button href="/settings">{t('levels.openSettings')}</Button>
	{:else}
		<TextField bind:value={query} type="search" placeholder={t('browse.grammarSearch')} aria-label={t('browse.grammarSearch')} />
		<p class="caption">{tn('browse.grammarCount', total)}</p>
		{#if total === 0}<Notice>{t('browse.noMatch')}</Notice>{/if}
		{#each groups as g (g.l.id)}
			{#each g.units as { u, n, points } (u.id)}
				<section class="stack" style:--gap="var(--space-2)">
					<SectionHeader title="📗 {t('levels.unitOf', { level: u.level, n })} · {et(u.title)}{isDraft(u) ? ` · ${t('levels.draft')}` : ''}" level={3} />
					{#each points as p (p.id)}
						<Card sheen href="/learn/level/{u.id}#{p.id}" class="point">
							<span class="jp pattern" lang="ja">{p.pattern}</span>
							<span class="caption">{et(p.meaning)}</span>
						</Card>
					{/each}
				</section>
			{/each}
		{/each}
	{/if}
</main>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.page :global(.point) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-px);
		text-align: left;
	}
	.pattern {
		font-size: 1.0625rem;
		font-weight: 600;
	}
</style>
