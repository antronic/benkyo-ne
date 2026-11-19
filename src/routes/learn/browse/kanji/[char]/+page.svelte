<!--
	One kanji from the gallery: watch it being written (the origin picture first
	for the kanji lessons), its meaning and readings, then trace it or write it
	from memory, where it is taught, and words that use it.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { et, gloss } from '#lib/i18n/content.ts';
	import { Button, Card, IconButton, Notice, SectionHeader, Segmented, Skeleton } from '#lib/ui/index.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import StrokeAnimator from '#lib/components/StrokeAnimator.svelte';
	import ContentFeedback from '#lib/components/ContentFeedback.svelte';
	import TracePad from '#lib/components/TracePad.svelte';
	import KanjiOrigin from '#lib/components/KanjiOrigin.svelte';
	import KanjiInfo from '#lib/components/KanjiInfo.svelte';
	import { kanjiByChar } from '#lib/content/kanji.ts';
	import { loadLevelStrokes, partColors, strokesOf } from '#lib/content/strokes.ts';
	import { kanjiIndex } from '#lib/state/kanjiIndex.svelte.ts';
	import { levels } from '#lib/state/levels.svelte.ts';
	import { LEVELS, isDraft, visibleUnits } from '#lib/content/levels/index.ts';
	import { progress, haptic } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { speak } from '#lib/content/kana.ts';

	type Mode = 'watch' | 'trace' | 'write';

	const char = $derived(decodeURIComponent(page.params.char ?? ''));
	let ready = $state(false);
	let strokesFailed = $state(false);
	let mode = $state<Mode>('watch');
	let animKey = $state(0);
	let result = $state<{ correct: boolean } | null>(null);

	$effect(() => {
		ui.hue = 25;
	});

	onMount(async () => {
		await Promise.all([
			kanjiIndex.load().catch(() => {}),
			loadLevelStrokes().catch(() => {
				strokesFailed = true;
			})
		]);
		ready = true;
	});

	const k = $derived(kanjiIndex.byChar(char));
	const lessonKanji = $derived(kanjiByChar.get(char));
	const list = $derived(kanjiIndex.list ?? []);
	const at = $derived(list.findIndex((x) => x.char === char));
	const prev = $derived(at > 0 ? list[at - 1] : undefined);
	const next = $derived(at >= 0 && at < list.length - 1 ? list[at + 1] : undefined);
	const hasStrokes = $derived(ready && !!strokesOf(char));
	const meaning = $derived(k ? (k.lesson ? gloss(k.meaning) : k.meaning) : '');

	/** The unit that teaches it, when the learner can open it (drafts only with the setting on). */
	const unit = $derived(k?.unit ? levels.unit(k.unit.id) : undefined);
	const unitOpen = $derived(!!unit && (!isDraft(unit) || progress.settings.showDraftUnits));
	/** Words that use it, from the level units the learner can see. */
	const usedIn = $derived(
		LEVELS.flatMap((l) => visibleUnits(levels.units[l.id] ?? [], progress.settings.showDraftUnits))
			.flatMap((u) => u.words.filter((w) => w.kanji?.includes(char)).map((w) => ({ w, u })))
			.slice(0, 12)
	);

	function go(c: string | undefined) {
		if (!c) return;
		mode = 'watch';
		result = null;
		animKey++;
		void goto(`/learn/browse/kanji/${encodeURIComponent(c)}`, { replaceState: true });
	}
	function done(r: { correct: boolean }) {
		result = r;
		haptic(r.correct ? 'success' : 'error');
	}
	function setMode(m: Mode) {
		mode = m;
		result = null;
		animKey++;
	}
</script>

<main class="page stack" style:--gap="var(--space-4)">
	<header class="top">
		<IconButton label={t('common.back')} onclick={() => goto('/learn/browse/kanji')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</IconButton>
		<div class="stack grow" style:--gap="0">
			<span class="eyebrow">⛰️ {t('browse.kanjiTitle')}{k?.level ? ` · ${k.level}` : ''}{k?.strokes ? ` · ${t('browse.strokes', { n: k.strokes })}` : ''}</span>
			<h1 class="title-2"><span class="jp" lang="ja">{char}</span>{meaning ? ` · ${meaning}` : ''}</h1>
		</div>
	</header>

	{#if !ready}
		<Skeleton variant="card" label={t('browse.loading')} />
	{:else if !k}
		<Notice tone="warning">{t('browse.notFound')}</Notice>
		<Button href="/learn/browse/kanji">{t('browse.backToGallery')}</Button>
	{:else}
		<div class="stage">
			<Card sheen radius="large" class="board">
				{#if !hasStrokes}
					<span class="jp glyph-big" lang="ja">{char}</span>
				{:else if mode === 'watch'}
					{#key animKey + char}
						{#if lessonKanji}
							<KanjiOrigin {char} size="100%" />
						{:else}
							<StrokeAnimator {char} size="100%" speed={140} scene={0.5} numbers colors={partColors(char)} />
						{/if}
					{/key}
				{:else}
					{#key animKey + char + mode}
						<TracePad {char} mode={mode === 'trace' ? 'trace' : 'recall'} size="100%" oncomplete={done} />
					{/key}
				{/if}
			</Card>
		</div>
		{#if strokesFailed}<Notice tone="warning">{t('browse.strokesFailed')}</Notice>{/if}

		{#if hasStrokes}
			<Segmented
				label={t('browse.practise')}
				value={mode}
				onchange={setMode}
				options={[
					{ value: 'watch', label: t('browse.watch') },
					{ value: 'trace', label: t('browse.trace') },
					{ value: 'write', label: t('browse.write') }
				]}
			/>
			<p class="caption hint">
				{#if result}{result.correct ? t('browse.writeRight') : t('browse.writeWrong')}
				{:else if mode === 'watch'}{t('browse.watchHint')}
				{:else if mode === 'trace'}{t('browse.traceHint')}
				{:else}{t('browse.writeHint', { meaning })}{/if}
			</p>
			<div class="row actions" style:--gap="var(--space-2)">
				<Button variant="ghost" onclick={() => setMode(mode)}>↻ {t('browse.again')}</Button>
				<Button variant="ghost" onclick={() => speak(k.kun[0]?.replace(/[.\-]/g, '') || k.on[0] || char)}>🔊 {t('browse.listen')}</Button>
			</div>
		{/if}

		{#if lessonKanji}
			<KanjiInfo kanji={lessonKanji} />
		{:else}
			<Card class="stack" style="--gap: var(--space-1)">
				<span class="headline">{k.meaning}</span>
				{#if k.on.length}<span class="caption"><b>{t('levels.on')}</b> <span class="jp" lang="ja">{k.on.slice(0, 4).join('・')}</span></span>{/if}
				{#if k.kun.length}<span class="caption"><b>{t('levels.kun')}</b> <span class="jp" lang="ja">{k.kun.slice(0, 4).join('・')}</span></span>{/if}
			</Card>
		{/if}
		<ContentFeedback subject="kanji:{k.char}" label={k.char} />

		<section class="stack" style:--gap="var(--space-2)">
			<SectionHeader title={t('browse.taughtIn')} />
			{#if k.lesson}
				<Card sheen href="/learn/kanji/{k.lesson.id}" class="row link"><span>⛰️</span><span class="headline">{t('browse.kanjiLesson', { title: k.lesson.title })}</span></Card>
			{/if}
			{#if k.unit}
				{#if unitOpen}
					<Card sheen href="/learn/level/{k.unit.id}" class="row link"><span>📗</span><span class="headline">{t('levels.unitOf', { level: k.level ?? 'N5', n: k.unit.n })} · {et(k.unit.title)}</span></Card>
				{:else}
					<Card class="row link"><span>📗</span><span class="stack" style:--gap="0"><span class="headline">{t('levels.unitOf', { level: k.level ?? 'N5', n: k.unit.n })} · {et(k.unit.title)}</span><span class="caption">{t('browse.unitDraft')}</span></span></Card>
				{/if}
			{/if}
		</section>

		{#if usedIn.length}
			<section class="stack" style:--gap="var(--space-2)">
				<SectionHeader title={t('browse.words')} />
				<div class="words">
					{#each usedIn as { w, u } (u.id + w.reading)}
						<Card padding="sm" class="word" onclick={() => speak(w.reading)}>
							<span class="jp" lang="ja">{w.kanji}</span>
							<span class="caption jp" lang="ja">{w.reading}</span>
							<span class="caption">{et(w.gloss)}</span>
						</Card>
					{/each}
				</div>
			</section>
		{/if}

		<div class="row nav" style:--gap="var(--space-2)">
			<Button variant="ghost" block disabled={!prev} onclick={() => go(prev?.char)}>← <span class="jp" lang="ja">{prev?.char ?? ''}</span></Button>
			<Button variant="ghost" block disabled={!next} onclick={() => go(next?.char)}><span class="jp" lang="ja">{next?.char ?? ''}</span> →</Button>
		</div>
		<p class="caption credit">{t('browse.kanjiCredit')}</p>
	{/if}
</main>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.stage {
		display: flex;
		justify-content: center;
	}
	.stage :global(.board) {
		width: min(100%, 320px);
		aspect-ratio: 1;
		display: grid;
		place-items: center;
	}
	.glyph-big {
		font-size: 8rem;
		line-height: 1;
	}
	.hint {
		text-align: center;
		min-height: 1.4em;
	}
	.actions {
		justify-content: center;
	}
	.page :global(.link) {
		align-items: center;
		gap: var(--space-3);
	}
	.words {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-2);
	}
	.words :global(.word) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-px);
		text-align: left;
	}
	.credit {
		color: var(--ink-3);
	}
</style>
