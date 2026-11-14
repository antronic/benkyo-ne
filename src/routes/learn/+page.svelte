<script lang="ts">
	import Romaji from '#lib/components/Romaji.svelte';
	import { LESSONS } from '#lib/content/lessons.ts';
	import { cardId } from '#lib/content/lessons.ts';
	import { retrievability } from '#lib/srs/fsrs.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import JapanglishConverter from '#lib/components/JapanglishConverter.svelte';
	import { COURSES, courseTag } from '#lib/content/courses.ts';
	import { lessonPacks } from '#lib/state/lessonPacks.svelte.ts';
	import { onMount } from 'svelte';
	import { words } from '#lib/state/words.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	type Filter = string;
	onMount(() => lessonPacks.load());
	const FILTERS = $derived<{ id: Filter; label: string }[]>([
		{ id: 'all', label: 'All' },
		{ id: 'fundamentals', label: '🔤 Fundamentals' },
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
	const shownCourses = $derived(lessonPacks.courses.filter((c) => filter === 'all' || filter === c.id));

	/** Cards added from a unit (by hidden course tag). */
	const addedIn = (course: string, unit: string) => words.list.filter((c) => c.tags.includes(courseTag(course, unit))).length;

	ui.hue = 30;
	const nextId = $derived(LESSONS.find((l) => !progress.completed.includes(l.id))?.id);

	/** Average predicted recall for a lesson's kana (0..1), null if unstarted. */
	function strength(id: string): number | null {
		const l = LESSONS.find((x) => x.id === id)!;
		const cs = l.chars.map((k) => progress.cards[cardId(k)]).filter(Boolean);
		if (!cs.length) return null;
		const now = Date.now();
		return cs.reduce((a, c) => a + (c.lastReview ? retrievability((now - c.lastReview) / 864e5, Math.max(c.stability, 0.01)) : 0), 0) / l.chars.length;
	}
</script>

<main class="page stack" style:--gap="10px">
	<LargeTitle title="Learn" />
	<div class="filters" role="tablist" aria-label="Filter lessons">
		{#each FILTERS as f}
			<button role="tab" aria-selected={filter === f.id} class="chip" class:on={filter === f.id} onclick={() => choose(f.id)}>{f.label}</button>
		{/each}
	</div>

	{#if filter === 'all' || filter === 'fundamentals'}
	<p class="subhead rise" style="margin:0 0 4px">Kana first: one row at a time, up to five new characters a lesson.</p>
	<div class="columns">
	{#each ['hiragana', 'katakana'] as script, si}
		<section>
		<h2 class="eyebrow section rise" style:--i={si * 8}>{script} · <span class="jp">{script === 'hiragana' ? 'ひらがな' : 'カタカナ'}</span></h2>
		<ol class="path">
			{#each LESSONS.filter((l) => l.script === script) as l, i}
				{@const done = progress.completed.includes(l.id)}
				{@const s = strength(l.id)}
				<li class="rise" style:--i={si * 8 + i + 1}>
					<a href="/learn/{l.id}" class="glass sheen lesson" class:next={l.id === nextId} class:done style:--h={l.hue}>
						<span class="badge">{done ? '✓' : i + 1}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{l.title}</span>
							<span class="jp kana">{l.subtitle}<Romaji text={l.subtitle} /></span>
						</span>
						<span class="spacer"></span>
						{#if s !== null}
							<span class="meter" title="Predicted recall"><span style:width="{Math.round(s * 100)}%"></span></span>
						{:else if l.id === nextId}
							<span class="start">Start</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
		</section>
	{/each}
	</div>
	{/if}

	{#each shownCourses as c, ci (c.id)}
		<section class="course rise" style:--i={ci + 1} style:--h={c.hue}>
			<h2 class="eyebrow section">{c.emoji} {c.title}</h2>
			<p class="caption blurb">{c.blurb}</p>
			{#if c.id === 'japanglish'}<JapanglishConverter />{/if}
			<div class="units">
				{#each c.units as u, ui (u.id)}
					{@const n = addedIn(c.id, u.id)}
					<a class="unit glass sheen" href="/learn/course/{c.id}/{u.id}" class:done={n >= u.items.length}>
						<span class="badge">{n >= u.items.length ? '✓' : ui + 1}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{u.title}</span>
							<span class="jp kana">{u.items.slice(0, 3).map((i) => i.reading).join('・')}…</span>
						</span>
						<span class="spacer"></span>
						<span class="caption">{n}/{u.items.length}</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</main>

<style>
	.filters {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin: 0 calc(-1 * var(--gutter-r)) 6px calc(-1 * var(--gutter-l));
		padding: 2px var(--gutter-r) 6px var(--gutter-l);
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		scroll-snap-type: x proximity;
	}
	.filters::-webkit-scrollbar {
		display: none;
	}
	.chip {
		flex: none;
		scroll-snap-align: start;
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		border-radius: 999px;
		padding: 0 16px;
		min-height: 40px;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 220ms,
			color 220ms,
			transform 300ms var(--spring);
	}
	.chip:active {
		transform: scale(0.95);
	}
	.chip.on {
		background: var(--ink);
		color: var(--bg);
	}
	.course {
		margin-top: 8px;
	}
	.blurb {
		margin: -2px 4px 8px;
	}
	.units {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
	}
	@media (min-width: 600px) {
		.units {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.unit {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		min-height: 56px;
		text-decoration: none;
		color: inherit;
		transition: transform 450ms var(--spring);
	}
	.unit:active {
		transform: scale(0.97);
	}
	.unit.done .badge {
		background: var(--success);
	}
	/* Unfolded: hiragana and katakana paths side by side */
	@media (min-width: 600px) {
		.columns {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px;
			align-items: start;
		}
	}
	.lesson {
		min-height: 56px;
	}
	.section {
		margin: 18px 4px 4px;
	}
	.path {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.lesson {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		text-decoration: none;
		color: inherit;
		transition: transform 450ms var(--spring);
	}
	.lesson:active {
		transform: scale(0.97);
	}
	.lesson.next {
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
	.done .badge {
		background: var(--success);
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
