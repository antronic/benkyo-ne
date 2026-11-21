<!--
	Test out of one level unit (lib/practice/testOut.ts): three questions.
	All right → the unit is marked done and its words go into the learner's
	cards as known (Good). One wrong → the unit opens as usual.
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { et } from '#lib/i18n/content.ts';
	import { Button, Card, IconButton, Skeleton } from '#lib/ui/index.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { leave } from '#lib/state/leave.ts';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { speak } from '#lib/content/kana.ts';
	import { LEVELS, levelById, type LevelUnit } from '#lib/content/levels/index.ts';
	import { levels } from '#lib/state/levels.svelte.ts';
	import { buildTestOut, testOutPassed, type TestQuestion } from '#lib/practice/testOut.ts';
	import { levelCandidate, saveLevelWords } from '#lib/words/levelCards.ts';
	import { progress, haptic } from '#lib/state/progress.svelte.ts';
	import { Good } from '#lib/srs/fsrs.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	type Phase = 'intro' | 'quiz' | 'done';

	const id = $derived(page.params.unit ?? '');
	const levelId = $derived(levelById(id.split('-')[0] ?? ''));

	let unit = $state<LevelUnit | undefined>();
	let units = $state<LevelUnit[]>([]);
	let loading = $state(true);
	let phase = $state<Phase>('intro');
	let qs = $state<TestQuestion[]>([]);
	let qi = $state(0);
	let picked = $state<(number | null)[]>([]);
	let passed = $state(false);
	let added = $state(0);
	let saving = $state(false);
	let t0 = 0;
	const times: number[] = [];

	$effect(() => {
		ui.hue = levelId?.hue ?? 150;
	});

	onMount(async () => {
		units = await levels.load((levelId ?? LEVELS[0]).id);
		unit = units.find((u) => u.id === id);
		loading = false;
	});

	const current = $derived(qs[qi]);

	function start() {
		if (!unit) return;
		qs = buildTestOut(unit, units);
		picked = qs.map(() => null);
		qi = 0;
		phase = 'quiz';
		t0 = performance.now();
	}

	function choose(ci: number) {
		if (!current || picked[qi] !== null) return;
		picked[qi] = ci;
		times[qi] = performance.now() - t0;
		const right = ci === current.answer;
		haptic(right ? 'success' : 'error');
		if (current.kind !== 'word' || right) speak(current.prompt);
		setTimeout(next, right ? 650 : 1400);
	}

	function next() {
		const missed = picked[qi] !== qs[qi]?.answer;
		if (missed || qi >= qs.length - 1) return void finish();
		qi++;
		t0 = performance.now();
	}

	async function finish() {
		if (!unit || saving) return;
		passed = testOutPassed(qs, picked);
		saving = true;
		try {
			if (passed) {
				const u = unit;
				const cands = await Promise.all(u.words.map((w) => levelCandidate(u, w)));
				const saved = await saveLevelWords(u, cands, true);
				const ms = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
				const seen = new Set(Object.values(progress.cards).filter((c) => c.state !== 'new').map((c) => c.id));
				for (const c of saved) if (!seen.has(c.id)) await progress.record(c.id, Good, ms);
				await progress.completeLesson(u.id);
				added = saved.length;
			}
			phase = 'done';
		} catch (e) {
			toast(e instanceof Error ? e.message : t('testOut.saveFailed'), '⚠️');
		} finally {
			saving = false;
		}
	}

	const asked = $derived(phase === 'done' ? qs.length : qi);
	const prompt = $derived(current?.kind === 'kanji' ? t('testOut.qKanji') : current?.kind === 'word' ? t('testOut.qWord') : t('testOut.qGrammar'));
</script>

{#if loading}
	<main class="page stack"><Skeleton variant="row" count={3} label={t('levels.loading', { level: levelId?.id ?? '' })} /></main>
{:else if !unit}
	<main class="page stack"><h1 class="large-title">{t('testOut.notFound')}</h1><a href="/learn">{t('unit.backToLearn')}</a></main>
{:else}
	<main class="test-out">
		<header class="top">
			<IconButton label={t('testOut.close')} onclick={() => goto(`/learn/level/${unit!.id}`)}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
			</IconButton>
			<div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length || 3} aria-valuenow={asked}>
				<span style:width="{qs.length ? (asked / qs.length) * 100 : 0}%"></span>
			</div>
			<div class="caption count">{phase === 'quiz' ? `${qi + 1}/${qs.length}` : ''}</div>
		</header>

		{#key phase + qi}
			<section class="stage" in:fly={{ x: 40, duration: 380, easing: cubicOut, opacity: 0 }}>
				{#if phase === 'intro'}
					<div class="text stack" style:--gap="var(--space-3)">
						<div class="eyebrow">📗 {unit.level} · {t('testOut.eyebrow')}</div>
						<h1 class="large-title">{t('testOut.title', { unit: et(unit.title) })}</h1>
						<p class="subhead">{t('testOut.body')}</p>
					</div>
				{:else if phase === 'quiz' && current}
					<div class="text stack" style:--gap="var(--space-4)">
						<div class="eyebrow">{prompt}</div>
						<Card sheen radius="large" class="big">
							<span class="jp prompt" lang="ja">{current.prompt}</span>
						</Card>
						<div class="choices">
							{#each current.choices as c, ci}
								<Card
									padding="sm"
									class="choice {current.kind === 'kanji' ? 'jp' : ''} {picked[qi] !== null && ci === current.answer ? 'right' : ''} {picked[qi] === ci && ci !== current.answer ? 'wrong' : ''}"
									onclick={() => choose(ci)}
									disabled={picked[qi] !== null && picked[qi] !== ci && ci !== current.answer}
								>
									{et(c)}
								</Card>
							{/each}
						</div>
					</div>
				{:else if phase === 'done'}
					<div class="text stack" style:--gap="var(--space-3)">
						<h1 class="large-title">{passed ? t('testOut.passed') : t('testOut.failed')}</h1>
						<p class="subhead">{passed ? tn('testOut.passedBody', added) : t('testOut.failedBody')}</p>
					</div>
				{/if}
			</section>
		{/key}

		<footer class="bottom">
			{#if phase === 'intro'}
				<Button variant="accent" block onclick={start}>{t('testOut.start')}</Button>
			{:else if phase === 'quiz'}
				{#if saving}<Button variant="ghost" block busy>{t('testOut.saving')}</Button>{/if}
			{:else}
				<div class="row" style="width:100%">
					<Button variant="ghost" block onclick={() => leave('/learn')}>{t('common.done')}</Button>
					<Button variant="accent" block onclick={() => goto(`/learn/level/${unit!.id}`)}>{t('testOut.openUnit')}</Button>
				</div>
			{/if}
		</footer>
	</main>
{/if}

<style>
	.test-out {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 560px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--space-4)) var(--gutter-l);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.bar {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: var(--hairline);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: linear-gradient(90deg, hsl(var(--h) 85% 58%), hsl(calc(var(--h) + 30) 90% 60%));
		transition: width 600ms var(--spring);
	}
	.count {
		width: 50px;
		text-align: right;
	}
	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5) 0;
	}
	.text {
		width: 100%;
	}
	.test-out :global(.big) {
		text-align: center;
	}
	.prompt {
		font-size: 2rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3);
	}
	.choices :global(.choice) {
		min-height: 56px;
		text-align: center;
		font-size: 1.0625rem;
		font-weight: 600;
	}
	.choices :global(.choice:disabled) {
		opacity: 0.4;
	}
	.choices :global(.choice.right) {
		background: color-mix(in srgb, var(--success) 85%, transparent);
		color: #fff;
	}
	.choices :global(.choice.wrong) {
		background: color-mix(in srgb, var(--danger) 85%, transparent);
		color: #fff;
	}
	.bottom {
		min-height: 50px;
	}
</style>
