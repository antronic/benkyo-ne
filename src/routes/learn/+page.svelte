<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { c as tc, scriptName } from '#lib/i18n/content.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { LESSONS } from '#lib/content/lessons.ts';
	import { cardId } from '#lib/content/lessons.ts';
	import { retrievability } from '#lib/srs/fsrs.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { Card, Chip, LargeTitle } from '#lib/ui/index.ts';
	import JapanglishConverter from '#lib/components/JapanglishConverter.svelte';
	import { COURSES, courseTag } from '#lib/content/courses.ts';
	import { lessonPacks } from '#lib/state/lessonPacks.svelte.ts';
	import { onMount } from 'svelte';
	import { words } from '#lib/state/words.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { DRILLS, drillCounts } from '#lib/practice/drills.ts';
	import { KANJI_LESSONS, kanjiCardId } from '#lib/content/kanji.ts';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';

	type Filter = string;
	onMount(() => lessonPacks.load());
	const FILTERS = $derived<{ id: Filter; label: string }[]>([
		{ id: 'all', label: 'All' },
		{ id: 'fundamentals', label: '🔤 Fundamentals' },
		{ id: 'practice', label: '🎯 Practice' },
		{ id: 'kanji', label: '⛰️ Kanji' },
		...lessonPacks.courses.map((c) => ({ id: c.id as Filter, label: `${c.emoji} ${c.title}` }))
	]);
	const saved = (() => {
		try {
			return (localStorage.getItem('learn.filter') as Filter) || 'all';
		} catch {
			return 'all';
		}
	})();
	let filter = $state<Filter>(saved);
	function choose(f: Filter) {
		filter = f;
		haptic('selection');
		try {
			localStorage.setItem('learn.filter', f);
		} catch {}
	}
	/** Filter chip text in the interface language (labels above stay the English source). */
	function filterLabel(f: { id: Filter; label: string }) {
		if (f.id === 'all') return t('learn.all');
		if (f.id === 'fundamentals') return `🔤 ${t('learn.fundamentals')}`;
		if (f.id === 'practice') return `🎯 ${t('learn.practice')}`;
		if (f.id === 'kanji') return `⛰️ ${t('learn.kanjiFilter')}`;
		const course = lessonPacks.courses.find((c) => c.id === f.id);
		return course ? `${course.emoji} ${tc(course.title)}` : f.label;
	}
	const shownCourses = $derived(lessonPacks.courses.filter((c) => filter === 'all' || filter === c.id));

	/** Cards added from a unit (by hidden course tag). */
	const addedIn = (course: string, unit: string) => words.list.filter((c) => c.tags.includes(courseTag(course, unit))).length;

	/** Lessons left per script, for the placement check cards. */
	const left = (script: 'hiragana' | 'katakana') => LESSONS.filter((l) => l.script === script && !progress.completed.includes(l.id)).length;
	const counts = $derived(drillCounts(progress.cards, (id) => !!words.cards[id] && !words.cards[id].deleted));
	/** Drills appear once there is something to practise (all of them under the Practice filter). */
	const anyDrill = $derived(Object.values(counts).some((n) => n > 0));

	ui.hue = 30;
	const nextId = $derived(LESSONS.find((l) => !progress.completed.includes(l.id))?.id);

	const nextKanjiId = $derived(KANJI_LESSONS.find((l) => !progress.completed.includes(l.id))?.id);

	/** Average predicted recall over card ids (0..1), null if unstarted. */
	function recall(ids: string[]): number | null {
		const cs = ids.map((id) => progress.cards[id]).filter(Boolean);
		if (!cs.length) return null;
		const now = Date.now();
		return cs.reduce((a, c) => a + (c.lastReview ? retrievability((now - c.lastReview) / 864e5, Math.max(c.stability, 0.01)) : 0), 0) / ids.length;
	}
	const strength = (id: string) => recall(LESSONS.find((x) => x.id === id)!.chars.map(cardId));
	const kanjiStrength = (id: string) => recall(KANJI_LESSONS.find((x) => x.id === id)!.chars.map(kanjiCardId));
</script>

<main class="page stack" style:--gap="var(--space-3)">
	<LargeTitle title={t('nav.learn')} />
	<div class="filters" role="group" aria-label={t('learn.filter')}>
		{#each FILTERS as f}
			<Chip selected={filter === f.id} onclick={() => choose(f.id)}>{filterLabel(f)}</Chip>
		{/each}
	</div>

{#snippet practiceSection()}
		<section class="practice rise" style:--h={265}>
			<h2 class="eyebrow section">🎯 {t('learn.practice')} · <span class="jp">れんしゅう</span></h2>
			<p class="caption blurb">{t('learn.practiceBlurb')}</p>
			<div class="units">
				{#each ['hiragana', 'katakana'] as const as script}
					{@const n = left(script)}
					<Card sheen class="unit {n === 0 ? 'done' : ''}" href="/learn/placement/{script}" style="--h: {script === 'hiragana' ? 8 : 220}">
						<span class="badge">{n === 0 ? '✓' : script === 'hiragana' ? 'あ' : 'ア'}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{t('learn.testOut', { script: scriptName(script) })}</span>
							<span class="caption">{n === 0 ? t('learn.allLessonsDone') : tn('learn.placementSkip', n)}</span>
						</span>
					</Card>
				{/each}
				{#each anyDrill || filter === 'practice' ? DRILLS : [] as d (d.id)}
					{@const n = counts[d.id]}
					<Card sheen class="unit {n === 0 ? 'empty' : ''}" href="/review?practice={d.id}" disabled={n === 0}>
						<span class="badge">{d.emoji}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{tc(d.title)}</span>
							<span class="caption">{n ? tc(d.blurb) : t('learn.nothingYet')}</span>
						</span>
						<span class="spacer"></span>
						{#if n}<span class="caption">{Math.min(n, 20)}</span>{/if}
					</Card>
				{/each}
			</div>
		</section>
	{/snippet}

	{#if filter === 'all' || filter === 'practice'}{@render practiceSection()}{/if}

	{#if filter === 'all' || filter === 'fundamentals'}
	<p class="subhead rise" style="margin:0 0 var(--space-1)">{t('learn.kanaFirst')}</p>
	<div class="columns">
	{#each ['hiragana', 'katakana'] as script, si}
		<section>
		<h2 class="eyebrow section rise" style:--i={si * 8}>{scriptName(script)} · <span class="jp">{script === 'hiragana' ? 'ひらがな' : 'カタカナ'}</span></h2>
		<ol class="path">
			{#each LESSONS.filter((l) => l.script === script) as l, i}
				{@const done = progress.completed.includes(l.id)}
				{@const s = strength(l.id)}
				<li class="rise" style:--i={si * 8 + i + 1}>
					<Card sheen href="/learn/{l.id}" class="lesson {l.id === nextId ? 'next' : ''} {done ? 'done' : ''}" style="--h: {l.hue}">
						<span class="badge">{done ? '✓' : i + 1}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{tc(l.title)}</span>
							<span class="jp kana">{l.subtitle}<Romaji text={l.subtitle} /></span>
						</span>
						<span class="spacer"></span>
						{#if s !== null}
							<span class="meter" title={t('learn.predicted')}><span style:width="{Math.round(s * 100)}%"></span></span>
						{:else if l.id === nextId}
							<span class="start">{t('learn.start')}</span>
						{/if}
					</Card>
				</li>
			{/each}
		</ol>
		</section>
	{/each}
	</div>
	{/if}

	{#if filter === 'all' || filter === 'kanji'}
	<section class="kanji-sec">
		<h2 class="eyebrow section rise">{t('learn.kanji')} · <span class="jp">漢字</span></h2>
		<p class="caption blurb rise">{t('learn.kanjiBlurb')}</p>
		<ol class="path kanji-path">
			{#each KANJI_LESSONS as l, i}
				{@const done = progress.completed.includes(l.id)}
				{@const s = kanjiStrength(l.id)}
				<li class="rise" style:--i={i + 1}>
					<Card sheen href="/learn/kanji/{l.id}" class="lesson {l.id === nextKanjiId ? 'next' : ''} {done ? 'done' : ''}" style="--h: {l.hue}">
						<span class="badge">{done ? '✓' : i + 1}</span>
						<span class="stack" style:--gap="var(--space-px)">
							<span class="headline">{tc(l.title)}</span>
							<span class="glyphs">
								{#each l.chars as k}<KanaGlyph char={k.char} size={22} weight={7} />{/each}
							</span>
						</span>
						<span class="spacer"></span>
						{#if s !== null}
							<span class="meter" title={t('learn.predicted')}><span style:width="{Math.round(s * 100)}%"></span></span>
						{:else if l.id === nextKanjiId}
							<span class="start">{t('learn.start')}</span>
						{/if}
					</Card>
				</li>
			{/each}
		</ol>
	</section>
	{/if}

	{#each shownCourses as c, ci (c.id)}
		<section class="course rise" style:--i={ci + 1} style:--h={c.hue}>
			<h2 class="eyebrow section">{c.emoji} {tc(c.title)}</h2>
			<p class="caption blurb">{tc(c.blurb)}</p>
			{#if c.id === 'japanglish'}<JapanglishConverter />{/if}
			<div class="units">
				{#each c.units as u, ui (u.id)}
					{@const n = addedIn(c.id, u.id)}
					<Card sheen class="unit {n >= u.items.length ? 'done' : ''}" href="/learn/course/{c.id}/{u.id}">
						<span class="badge">{n >= u.items.length ? '✓' : ui + 1}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{tc(u.title)}</span>
							<span class="jp kana">{u.items.slice(0, 3).map((i) => i.reading).join('・')}…</span>
						</span>
						<span class="spacer"></span>
						<span class="caption">{n}/{u.items.length}</span>
					</Card>
				{/each}
			</div>
		</section>
	{/each}
</main>

<style>
	.filters {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		margin: 0 calc(-1 * var(--gutter-r)) var(--space-1h) calc(-1 * var(--gutter-l));
		padding: var(--space-px) var(--gutter-r) var(--space-1h) var(--gutter-l);
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		scroll-snap-type: x proximity;
	}
	.filters::-webkit-scrollbar {
		display: none;
	}
	.filters :global(.chip) {
		flex: none;
		scroll-snap-align: start;
		white-space: nowrap;
	}
	.course {
		margin-top: var(--space-2);
	}
	.blurb {
		margin: calc(-1 * var(--space-px)) var(--space-1) var(--space-2);
	}
	.units {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3);
	}
	@media (min-width: 600px) {
		.units {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.units :global(.unit) {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-height: 56px;
	}
	.units :global(.unit.empty) {
		opacity: 0.55;
		pointer-events: none;
	}
	.practice {
		margin-top: var(--space-1);
	}
	/* Unfolded: hiragana and katakana paths side by side */
	@media (min-width: 600px) {
		.columns {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-6);
			align-items: start;
		}
	}
	.section {
		margin: var(--space-5) var(--space-1) var(--space-1);
	}
	.path {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.path :global(.lesson) {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-height: 56px;
	}
	.path :global(.lesson.next) {
		box-shadow:
			0 0 0 2px hsl(var(--h) 80% 55%),
			var(--glass-shadow);
	}
	.badge {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(150deg, hsl(var(--h) 85% 60%), hsl(calc(var(--h) + 330) 70% 45%));
	}
	:global(.done) .badge {
		background: var(--success);
	}
	.glyphs {
		display: flex;
		gap: var(--space-1);
		color: var(--ink-2);
	}
	@media (min-width: 600px) {
		.kanji-path {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.kana {
		color: var(--ink-2);
		letter-spacing: 0.15em;
	}
	.meter {
		width: 56px;
		height: 6px;
		border-radius: 3px;
		background: var(--hairline);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--success);
		border-radius: 3px;
	}
	.start {
		font-weight: 600;
		color: hsl(var(--h) 80% 50%);
	}
</style>
