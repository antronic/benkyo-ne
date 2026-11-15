<!--
	A topic unit (Travel / Make friends / Japanglish): preview the items with
	romaji and audio, then add them to your cards. "Learn now with romaji"
	skips waiting for the kana lessons (cards aren't parked).
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { c as tc, gloss } from '#lib/i18n/content.ts';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import Romaji from '#lib/components/Romaji.svelte';
	import { courseTag, NOW_TAG, type CourseItem } from '#lib/content/courses.ts';
	import { lessonPacks } from '#lib/state/lessonPacks.svelte.ts';
	import { speak } from '#lib/content/kana.ts';
	import { verifyItem } from '#lib/dict/dict.ts';
	import { unknownKanaIn } from '#lib/dict/readable.ts';
	import { saveCandidates, type Candidate } from '#lib/words/maker.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	const params = $derived(page.params as Record<string, string | undefined>);
	const course = $derived(lessonPacks.courses.find((c) => c.id === params.course));
	const unit = $derived(course?.units.find((u) => u.id === params.unit));
	const tag = $derived(course && unit ? courseTag(course.id, unit.id) : '');

	let cands = $state<(Candidate & { note?: string })[]>([]);
	let learnNow = $state(true);
	let saving = $state(false);

	$effect(() => {
		if (course) ui.hue = course.hue;
	});

	async function toCandidate(i: CourseItem): Promise<Candidate & { note?: string }> {
		const v = await verifyItem({ text: i.kanji ?? i.reading, reading: i.reading });
		const hit = v.hit;
		return {
			key: hit ? `${i.kind}:${hit.id}` : `${i.kind}:custom:${course!.id}-${i.reading}`,
			text: i.kanji ?? i.reading,
			reading: i.reading,
			written: i.kanji ? [i.kanji] : [],
			kind: i.kind,
			gloss: i.gloss,
			verified: v.verified || !v.available,
			wordId: hit?.id ?? null,
			note: null,
			...(i.note ? { note: i.note } : {})
		} as Candidate & { note?: string };
	}

	onMount(async () => {
		await lessonPacks.load();
		if (unit) cands = await Promise.all(unit.items.map(toCandidate));
	});

	const added = $derived(cands.filter((c) => words.cards[c.key] && !words.cards[c.key].deleted));
	const toAdd = $derived(cands.filter((c) => !words.cards[c.key] || words.cards[c.key].deleted));
	const needsKana = $derived(cands.some((c) => unknownKanaIn(c.reading, progress.knownKana).length));

	async function addAll() {
		if (!toAdd.length) return;
		saving = true;
		try {
			const tags = [tag, ...(learnNow ? [NOW_TAG] : [])];
			const saved = await saveCandidates(toAdd, { tags, source: 'user' });
			// course notes become usage lines when AI didn't write one
			for (const c of saved) {
				const note = toAdd.find((x) => x.key === c.id)?.note;
				if (note && !words.cards[c.id].usage) await words.save({ ...words.cards[c.id], usage: { en: note, second: null } });
			}
			haptic('success');
			toast(`${t('unit.added', { n: saved.length })} · ${learnNow || !needsKana ? t('unit.ready') : t('unit.parked')}`, '✓', 2600);
		} catch (e) {
			toast(e instanceof Error ? e.message : t('unit.addFailed'), '⚠️');
		} finally {
			saving = false;
		}
	}
</script>

{#if !course || !unit}
	<main class="page"><h1 class="large-title">{t('unit.notFound')}</h1><a href="/learn">{t('unit.backToLearn')}</a></main>
{:else}
	<main class="unit-page" style:--h={course.hue}>
		<header class="top">
			<button class="icon-btn" aria-label={t('common.back')} onclick={() => goto('/learn')}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			<div class="stack" style:--gap="0">
				<span class="eyebrow">{course.emoji} {tc(course.title)}</span>
				<h1 class="title-2">{tc(unit.title)}</h1>
			</div>
		</header>

		{#if !cands.length}
			<Skeleton variant="row" count={unit.items.length} label={t('unit.checking')} />
		{/if}
		<ul class="items">
			{#each cands as c, i (c.key)}
				{@const have = !!words.cards[c.key] && !words.cards[c.key].deleted}
				<li class="glass item rise" style:--i={i} class:have>
					<button class="say" aria-label={t('a11y.listenTo', { text: c.reading })} onclick={() => speak(c.reading)}>🔊</button>
					<div class="body">
						<div class="row" style:--gap="8px">
							<span class="jp reading">{c.reading}</span>
							{#if c.kind === 'phrase'}<span class="tag">{t('card.phrase')}</span>{/if}
							{#if !c.verified}<span class="tag warn">{t('card.unverified')}</span>{/if}
						</div>
						<Romaji text={c.reading} />
						{#if c.written[0]}<span class="jp kanji">{c.written[0]}</span>{/if}
						<span class="gloss">{gloss(c.gloss)}</span>
						{#if c.note}<span class="caption">💬 {tc(c.note)}</span>{/if}
					</div>
					{#if have}<span class="check" aria-label={t('unit.addedOne')}>✓</span>{/if}
				</li>
			{/each}
		</ul>

		<footer class="bottom glass glass-strong" in:fly={{ y: 40, duration: 400 }}>
			{#if toAdd.length}
				{#if needsKana}
					<label class="now">
						<span class="stack" style:--gap="0">
							<span>{t('unit.learnNow')}</span>
							<span class="caption">{t('unit.learnNowBody')}</span>
						</span>
						<input type="checkbox" class="switch" bind:checked={learnNow} />
					</label>
				{/if}
				<button class="btn accent block" onclick={addAll} disabled={saving || !cands.length}>
					{saving ? t('unit.adding') : t('unit.addN', { n: toAdd.length })}
				</button>
				{#if ai.available}<p class="caption center">✨ {t('unit.aiNote')}</p>{/if}
			{:else}
				<p class="caption center">{tn('unit.allIn', added.length)}</p>
				<button class="btn accent block" onclick={() => goto('/review')}>{t('unit.practise')}</button>
			{/if}
		</footer>
	</main>
{/if}

<style>
	.unit-page {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + 200px) var(--gutter-l);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--r-m);
	}
	.item.have {
		box-shadow:
			0 0 0 1.5px color-mix(in srgb, var(--success) 60%, transparent),
			var(--glass-shadow);
	}
	.say {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		cursor: pointer;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.reading {
		font-size: 1.375rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.kanji {
		color: var(--ink-2);
	}
	.gloss {
		font-size: 0.9375rem;
	}
	.check {
		flex: none;
		color: var(--success);
		font-weight: 700;
		font-size: 1.25rem;
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--hairline);
	}
	.tag.warn {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
	}
	.bottom {
		position: fixed;
		z-index: 30;
		left: calc(var(--safe-left) + 12px);
		right: calc(var(--safe-right) + 12px);
		bottom: calc(var(--safe-bottom) + 12px);
		max-width: 560px;
		margin: 0 auto;
		padding: 12px;
		border-radius: var(--r-l);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.now {
		display: flex;
		align-items: center;
		gap: 12px;
		justify-content: space-between;
	}
	.center {
		text-align: center;
		margin: 0;
	}
	.switch {
		appearance: none;
		flex: none;
		width: 51px;
		height: 31px;
		border-radius: 16px;
		background: var(--hairline);
		position: relative;
		cursor: pointer;
		margin: 0;
		transition: background 250ms;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 3px 8px rgb(0 0 0 / 0.15);
		transition: transform 450ms var(--spring-bouncy);
	}
	.switch:checked {
		background: var(--success);
	}
	.switch:checked::after {
		transform: translateX(20px);
	}
</style>
