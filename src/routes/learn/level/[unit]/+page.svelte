<!--
	A level unit (lib/content/levels): its kanji, three grammar points with
	examples, a short reading with questions, and its words to add to the
	learner's cards. "Test out" skips it in three questions. Drafts (not yet
	checked by a reviewer) say so at the top.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { i18n } from '#lib/i18n/index.svelte.ts';
	import { et, gloss } from '#lib/i18n/content.ts';
	import { Badge, Button, Card, IconButton, Notice, SectionHeader, Skeleton } from '#lib/ui/index.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Romaji from '#lib/components/Romaji.svelte';
	import ContentFeedback from '#lib/components/ContentFeedback.svelte';
	import { speak } from '#lib/content/kana.ts';
	import { LEVELS, isDraft, levelById, thaiUnchecked, type LevelUnit } from '#lib/content/levels/index.ts';
	import { levels } from '#lib/state/levels.svelte.ts';
	import { levelCandidate, saveLevelWords, type LevelCandidate } from '#lib/words/levelCards.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import type { Kanji } from '@johnmorrisdotca/jisho';

	const id = $derived(page.params.unit ?? '');
	const levelId = $derived(levelById(id.split('-')[0] ?? ''));

	let unit = $state<LevelUnit | undefined>();
	let index = $state(0);
	let loading = $state(true);
	let kanjiRows = $state<Kanji[] | null>(null);
	let cands = $state<LevelCandidate[]>([]);
	let saving = $state(false);
	let finishing = $state(false);
	let showTranslation = $state(false);
	let answers = $state<Record<number, number>>({});

	const hue = $derived(levelId?.hue ?? 150);
	$effect(() => {
		ui.hue = hue;
	});

	onMount(async () => {
		const info = levelId ?? LEVELS[0];
		const list = await levels.load(info.id);
		unit = list.find((u) => u.id === id);
		index = list.findIndex((u) => u.id === id);
		loading = false;
		if (!unit) return;
		const u = unit;
		// opened from the grammar index: scroll to that point once it is drawn
		const hash = decodeURIComponent(location.hash.slice(1));
		if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
		const [{ readKanji }, { KANJI }] = await Promise.all([import('@johnmorrisdotca/jisho'), import('@johnmorrisdotca/jisho/kanji')]);
		const all = readKanji(KANJI);
		kanjiRows = u.kanji.map((k) => all.find((r) => r.kanji === k)).filter((r): r is Kanji => !!r);
		cands = await Promise.all(u.words.map((w) => levelCandidate(u, w)));
	});

	const toAdd = $derived(cands.filter((c) => !words.cards[c.key] || words.cards[c.key].deleted));
	const done = $derived(!!unit && progress.completed.includes(unit.id));

	async function addAll() {
		if (!unit || !toAdd.length) return;
		saving = true;
		try {
			const saved = await saveLevelWords(unit, toAdd, true);
			haptic('success');
			toast(t('unit.added', { n: saved.length }), '✓', 2200);
		} catch (e) {
			toast(e instanceof Error ? e.message : t('unit.addFailed'), '⚠️');
		} finally {
			saving = false;
		}
	}

	async function finish() {
		if (!unit) return;
		finishing = true;
		try {
			await progress.completeLesson(unit.id);
			haptic('success');
		} finally {
			finishing = false;
		}
	}

	function answer(qi: number, ci: number) {
		if (answers[qi] !== undefined || !unit) return;
		answers[qi] = ci;
		haptic(unit.reading.questions[qi].answer === ci ? 'success' : 'error');
	}

	const showThaiNote = $derived(!!unit && i18n.locale === 'th' && thaiUnchecked(unit));
</script>

{#if loading}
	<main class="page stack"><Skeleton variant="row" count={4} label={t('levels.loading', { level: levelId?.id ?? '' })} /></main>
{:else if !unit}
	<main class="page stack"><h1 class="large-title">{t('unit.notFound')}</h1><a href="/learn">{t('unit.backToLearn')}</a></main>
{:else}
	<main class="unit-page stack" style:--h={hue} style:--gap="var(--space-4)">
		<header class="top">
			<IconButton label={t('common.back')} onclick={() => goto('/learn')}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</IconButton>
			<div class="stack" style:--gap="0">
				<span class="eyebrow">📗 {t('levels.unitOf', { level: unit.level, n: index + 1 })}</span>
				<h1 class="title-2">{et(unit.title)}</h1>
			</div>
		</header>

		<p class="subhead goal">{et(unit.goal)}</p>
		<div class="row badges" style:--gap="var(--space-2)">
			{#if isDraft(unit)}<Badge tone="warning">{t('levels.draft')}</Badge>{/if}
			{#if showThaiNote}<Badge>{t('levels.aiThai')}</Badge>{/if}
			{#if done}<Badge tone="success">✓ {t('levels.done')}</Badge>{/if}
		</div>
		{#if isDraft(unit)}<Notice tone="warning">{t('levels.draftNotice')}</Notice>{/if}
		{#if showThaiNote}<Notice>{t('levels.aiThaiNotice')}</Notice>{/if}
		{#if !done}<Button href="/learn/level/{unit.id}/test">🎯 {t('levels.testOut')}</Button>{/if}

		<section class="stack" style:--gap="var(--space-2)">
			<SectionHeader title={t('levels.kanji')} />
			{#if !kanjiRows}
				<Skeleton variant="row" count={unit.kanji.length} label={t('levels.kanjiLoading')} />
			{:else}
				<div class="kanji-grid">
					{#each kanjiRows as k (k.kanji)}
						<Card sheen class="kanji-card" href="/learn/browse/kanji/{encodeURIComponent(k.kanji)}">
							<span class="jp glyph" lang="ja">{k.kanji}</span>
							<span class="stack" style:--gap="var(--space-px)">
								<span class="headline">{k.meanings.slice(0, 3).join(', ')}</span>
								{#if k.on.length}<span class="caption"><b>{t('levels.on')}</b> <span class="jp" lang="ja">{k.on.slice(0, 3).join('・')}</span></span>{/if}
								{#if k.kun.length}<span class="caption"><b>{t('levels.kun')}</b> <span class="jp" lang="ja">{k.kun.slice(0, 3).join('・')}</span></span>{/if}
							</span>
						</Card>
					{/each}
				</div>
				<p class="caption credit">{t('levels.creditKanji')}</p>
			{/if}
		</section>

		<section class="stack" style:--gap="var(--space-3)">
			<SectionHeader title={t('levels.grammar')} />
			{#each unit.grammar as g (g.id)}
				<Card id={g.id} class="grammar stack" style="--gap: var(--space-2)">
					<span class="jp pattern" lang="ja">{g.pattern}</span>
					<span class="caption formation" lang="ja">{g.formation}</span>
					<span class="headline">{et(g.meaning)}</span>
					{#if g.note}<p class="subhead note">{et(g.note)}</p>{/if}
					<ul class="examples">
						{#each g.examples as e (e.ja)}
							<li>
								<IconButton class="say" label={t('a11y.listenTo', { text: e.ja })} onclick={() => speak(e.ja)}>🔊</IconButton>
								<span class="stack" style:--gap="0">
									<span class="jp" lang="ja">{e.ja}</span>
									<span class="caption">{i18n.locale === 'th' ? e.th : e.en}</span>
								</span>
							</li>
						{/each}
					</ul>
					<ContentFeedback subject="grammar:{g.id}" label={g.pattern} />
				</Card>
			{/each}
		</section>

		<section class="stack" style:--gap="var(--space-3)">
			<SectionHeader title={t('levels.reading')} />
			<Card class="stack" style="--gap: var(--space-2)">
				<span class="headline">{et(unit.reading.title)}</span>
				<ul class="examples">
					{#each unit.reading.lines as l (l.ja)}
						<li>
							<IconButton class="say" label={t('a11y.listenTo', { text: l.ja })} onclick={() => speak(l.ja)}>🔊</IconButton>
							<span class="stack" style:--gap="0">
								<span class="jp" lang="ja">{l.ja}</span>
								{#if showTranslation}<span class="caption">{i18n.locale === 'th' ? l.th : l.en}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
				<Button variant="ghost" size="sm" onclick={() => (showTranslation = !showTranslation)}>
					{showTranslation ? t('levels.hideTranslation') : t('levels.showTranslation')}
				</Button>
			</Card>
			{#each unit.reading.questions as q, qi}
				{@const picked = answers[qi]}
				<Card class="stack" style="--gap: var(--space-2)">
					<span class="headline">{et(q.q)}</span>
					<div class="choices">
						{#each q.choices as c, ci}
							<Card
								padding="sm"
								class="choice {picked !== undefined && ci === q.answer ? 'right' : ''} {picked === ci && ci !== q.answer ? 'wrong' : ''}"
								onclick={() => answer(qi, ci)}
								disabled={picked !== undefined && picked !== ci && ci !== q.answer}
							>
								{et(c)}
							</Card>
						{/each}
					</div>
					{#if picked !== undefined}
						<p class="caption" role="status">{picked === q.answer ? t('levels.right') : t('levels.wrong', { answer: et(q.choices[q.answer]) })}</p>
					{/if}
				</Card>
			{/each}
		</section>

		<section class="stack" style:--gap="var(--space-3)">
			<SectionHeader title={t('levels.words')} />
			{#if !cands.length}
				<Skeleton variant="row" count={unit.words.length} label={t('unit.checking')} />
			{:else}
				<ul class="items">
					{#each cands as c (c.key)}
						{@const have = !!words.cards[c.key] && !words.cards[c.key].deleted}
						<Card as="li" padding="none" class="item {have ? 'have' : ''}">
							<IconButton class="say" label={t('a11y.listenTo', { text: c.reading })} onclick={() => speak(c.reading)}>🔊</IconButton>
							<div class="body">
								<div class="row" style:--gap="var(--space-2)">
									<span class="jp reading" lang="ja">{c.reading}</span>
									{#if c.kind === 'phrase'}<Badge variant="tag">{t('card.phrase')}</Badge>{/if}
									{#if !c.verified}<Badge variant="tag" tone="warning">{t('card.unverified')}</Badge>{/if}
								</div>
								<Romaji text={c.reading} />
								{#if c.written[0]}<span class="jp kanji" lang="ja">{c.written[0]}</span>{/if}
								<span class="gloss">{i18n.locale === 'th' ? c.word.gloss.th : gloss(c.gloss)}</span>
							</div>
							{#if have}<span class="check" aria-label={t('unit.addedOne')}>✓</span>{/if}
							<ContentFeedback compact class="say" subject={c.key} label={c.written[0] ?? c.reading} />
						</Card>
					{/each}
				</ul>
			{/if}
			{#if toAdd.length}
				<Button variant="accent" block onclick={addAll} busy={saving} disabled={!cands.length}>
					{saving ? t('unit.adding') : t('unit.addN', { n: toAdd.length })}
				</Button>
			{:else if cands.length && !done}
				<Button variant="accent" block onclick={finish} busy={finishing}>{t('levels.finish')}</Button>
			{:else if done}
				<Button variant="accent" block onclick={() => goto('/review')}>{t('unit.practise')}</Button>
			{/if}
			{#if toAdd.length && !done}<p class="caption center">{t('levels.finishFirst')}</p>{/if}
		</section>

		<Card padding="sm"><ContentFeedback subject="unit:{unit.id}" label={et(unit.title)} /></Card>
		<p class="caption credit">{t('levels.creditLevels')}</p>
	</main>
{/if}

<style>
	.unit-page {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--space-8)) var(--gutter-l);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.goal {
		margin: 0;
	}
	.badges:empty {
		display: none;
	}
	.kanji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-3);
	}
	.kanji-grid :global(.kanji-card) {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.glyph {
		font-size: 3rem;
		line-height: 1;
		font-weight: 600;
	}
	.credit {
		margin: 0;
		color: var(--ink-2);
	}
	.pattern {
		font-size: 1.5rem;
		font-weight: 700;
	}
	.formation {
		font-family: var(--font-mono, monospace);
	}
	.note {
		margin: 0;
		color: var(--ink-2);
	}
	.examples {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.examples li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.unit-page :global(.say) {
		flex: none;
		width: 44px;
		height: 44px;
		background: var(--glass-strong);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
	}
	.choices :global(.choice) {
		min-height: 48px;
		text-align: left;
	}
	.choices :global(.choice:disabled) {
		opacity: 0.45;
	}
	.choices :global(.choice.right) {
		background: color-mix(in srgb, var(--success) 85%, transparent);
		color: #fff;
	}
	.choices :global(.choice.wrong) {
		background: color-mix(in srgb, var(--danger) 85%, transparent);
		color: #fff;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.items :global(.item) {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
	}
	.items :global(.item.have) {
		box-shadow:
			0 0 0 1.5px color-mix(in srgb, var(--success) 60%, transparent),
			var(--glass-shadow);
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
	}
	.reading {
		font-size: 1.375rem;
		font-weight: 600;
	}
	.kanji {
		color: var(--ink-2);
	}
	.check {
		flex: none;
		color: var(--success);
		font-weight: 700;
		font-size: 1.25rem;
	}
	.center {
		text-align: center;
		margin: 0;
	}
</style>
