<!--
	Placement check (lib/practice/placement.ts): a few kana from each lesson you
	haven't done. Pass a lesson to skip it; it's marked done and its kana are
	scheduled for review. Stops after two missed lessons in a row.
-->
<script lang="ts">
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { c, scriptName } from '#lib/i18n/content.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { speak, type Kana, type Script } from '#lib/content/kana.ts';
	import { LESSONS } from '#lib/content/lessons.ts';
	import { choicesFor } from '#lib/quiz.ts';
	import { buildPlacement, PER_LESSON, scorePlacement, shouldStop, type Answer, type PlacementBlock, type PlacementOutcome } from '#lib/practice/placement.ts';
	import { progress, haptic } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive } from '#lib/ios/overlay.svelte.ts';
	import { Button, Card, IconButton } from '#lib/ui/index.ts';

	type Phase = 'intro' | 'quiz' | 'done';

	const script = $derived((page.params.script === 'katakana' ? 'katakana' : page.params.script === 'hiragana' ? 'hiragana' : null) as Script | null);
	const hue = $derived(script === 'katakana' ? 220 : 8);
	$effect(() => {
		ui.hue = hue;
	});

	let phase = $state<Phase>('intro');
	let blocks = $state<PlacementBlock[]>([]);
	let bi = $state(0); // block index
	let qi = $state(0); // question index in block
	let answers = $state<Record<string, Answer>>({});
	let options = $state<Kana[]>([]);
	let choice = $state<string | null>(null);
	let shaking = $state(false);
	let outcome = $state<PlacementOutcome | null>(null);
	let saving = $state(false);
	let t0 = 0;

	const todo = $derived(script ? LESSONS.filter((l) => l.script === script && !progress.completed.includes(l.id)) : []);
	const block = $derived(blocks[bi]);
	const current = $derived(block?.questions[qi]);
	const total = $derived(blocks.reduce((a, b) => a + b.questions.length, 0));
	const asked = $derived(Object.keys(answers).length);
	const scriptPool = $derived(script ? LESSONS.filter((l) => l.script === script).flatMap((l) => l.chars) : []);

	function start() {
		if (!script) return;
		blocks = buildPlacement(script, progress.completed);
		answers = {};
		bi = 0;
		qi = 0;
		phase = 'quiz';
		prep();
	}

	function prep() {
		choice = null;
		t0 = performance.now();
		if (current) options = choicesFor(current, [...block.lesson.chars, ...scriptPool]);
	}

	function pick(k: Kana) {
		if (choice || !current) return;
		choice = k.char;
		const correct = k.romaji === current.romaji;
		answers[current.char] = { correct, ms: performance.now() - t0 };
		if (correct) {
			haptic('success');
			speak(current.char);
			setTimeout(advance, 600);
		} else {
			haptic('error');
			shaking = true;
			setTimeout(() => (shaking = false), 480);
		}
	}

	function advance() {
		// one miss fails the lesson, so skip its remaining questions
		const missed = !answers[current!.char]?.correct;
		if (!missed && qi < block.questions.length - 1) {
			qi++;
		} else {
			if (bi >= blocks.length - 1 || shouldStop(blocks, answers)) return finish();
			bi++;
			qi = 0;
		}
		prep();
	}

	async function finish() {
		if (saving) return;
		saving = true;
		const seen = new Set(Object.values(progress.cards).filter((c) => c.state !== 'new').map((c) => c.id));
		const out = scorePlacement(blocks, answers, seen);
		for (const [id, grade, ms] of out.grades) await progress.record(id, grade, ms);
		for (const id of out.passed) await progress.completeLesson(id);
		outcome = out;
		saving = false;
		phase = 'done';
		haptic('success');
	}

	const nextLesson = $derived(script ? LESSONS.find((l) => l.script === script && !progress.completed.includes(l.id)) : undefined);

	const inProgress = $derived(phase === 'quiz');
	$effect(() => {
		ui.backGuard = inProgress
			? () => confirmDestructive(t('placement.stopTitle'), t('placement.stopBody'), t('placement.stop'))
			: null;
		return () => (ui.backGuard = null);
	});

	async function close() {
		if (ui.backGuard && !(await ui.backGuard())) return;
		ui.backGuard = null;
		goto('/learn');
	}
</script>

{#if !script}
	<main class="page stack"><h1 class="large-title">{t('placement.notFound')}</h1><a href="/learn">{t('unit.backToLearn')}</a></main>
{:else}
	<main class="placement" style:--h={hue}>
		<header class="top">
			<IconButton label={t('placement.close')} onclick={close}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
			</IconButton>
			<div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={phase === 'done' ? total : asked}>
				<span style:width="{phase === 'done' ? 100 : total ? (asked / total) * 100 : 0}%"></span>
			</div>
			<div class="caption count">{phase === 'quiz' ? `${asked}/${total}` : ''}</div>
		</header>

		{#key phase + bi + '-' + qi}
			<section class="stage" in:fly={{ x: 40, duration: 380, easing: cubicOut, opacity: 0 }}>
				{#if phase === 'intro'}
					<div class="text stack" style:--gap="var(--space-3)">
						<div class="eyebrow">{scriptName(script)} · {t('placement.eyebrow')}</div>
						<h1 class="large-title">{t('placement.title', { script: scriptName(script) })}</h1>
						{#if todo.length}
							<p class="subhead">{t('placement.body', { n: PER_LESSON })}</p>
							<p class="caption">{tn('placement.meta', todo.length)}</p>
						{:else}
							<p class="subhead">{t('placement.allDone', { script: scriptName(script) })}</p>
						{/if}
					</div>
				{:else if phase === 'quiz' && current}
					<div class="split">
						<div class="pane">
							<div class="eyebrow">{t('placement.checking', { lesson: c(block.lesson.title), i: qi + 1, n: block.questions.length })}</div>
							<Card sheen padding="none" radius="large" class="big {shaking ? 'shake' : ''}">
								<KanaGlyph char={current.char} size={150} />
								<Romaji text={current.char} hide={!choice} />
							</Card>
						</div>
						<div class="pane">
							<div class="choices">
								{#each options as o (o.char)}
									<Card
										padding="none"
										class="choice {choice && o.romaji === current.romaji ? 'right' : ''} {choice === o.char && o.romaji !== current.romaji ? 'wrong' : ''}"
										onclick={() => pick(o)}
										disabled={!!choice && choice !== o.char && o.romaji !== current.romaji}
									>
										{o.romaji}
									</Card>
								{/each}
							</div>
							{#if choice && !answers[current.char]?.correct}
								<div class="feedback-wrap" in:scale={{ start: 0.9, duration: 300 }}>
									<Card class="feedback">
										<p style="margin:0">{@html t('placement.itsAnswer', { romaji: `<b>${current.romaji}</b>`, lesson: c(block.lesson.title) })}</p>
										<Button block busy={saving} onclick={advance}>{t('common.continue')}</Button>
									</Card>
								</div>
							{/if}
						</div>
					</div>
				{:else if phase === 'done' && outcome}
					<div class="text stack" style:--gap="var(--space-3)">
						<h1 class="large-title">{outcome.passed.length ? tn('placement.skipped', outcome.passed.length) : t('placement.startLessons')}</h1>
						<p class="subhead">
							{outcome.passed.length
								? t('placement.passedBody', { n: outcome.grades.length })
								: t('placement.noneBody')}
						</p>
						<ul class="results">
							{#each blocks as b (b.lesson.id)}
								{@const ok = outcome.passed.includes(b.lesson.id)}
								{@const bad = outcome.failed.includes(b.lesson.id)}
								<Card as="li" padding="none" class="result {ok ? 'ok' : ''} {bad ? 'bad' : ''}">
									<span class="mark">{ok ? '✓' : bad ? '✗' : '·'}</span>
									<span class="headline">{c(b.lesson.title)}</span>
									<span class="jp caption sub">{b.lesson.subtitle}</span>
									<span class="caption">{ok ? t('placement.rSkipped') : bad ? t('placement.rTake') : t('placement.rNotChecked')}</span>
								</Card>
							{/each}
						</ul>
					</div>
				{/if}
			</section>
		{/key}

		<footer class="bottom">
			{#if phase === 'intro'}
				{#if todo.length}
					<Button variant="accent" block onclick={start}>{t('placement.start')}</Button>
				{:else}
					<Button variant="accent" block onclick={() => goto('/learn')}>{t('unit.backToLearn')}</Button>
				{/if}
			{:else if phase === 'quiz'}
				<Button variant="ghost" block onclick={finish} busy={saving}>{t('placement.stopKeep')}</Button>
			{:else if phase === 'done'}
				<div class="row" style="width:100%">
					<Button variant="ghost" block onclick={() => goto('/learn')}>{t('common.done')}</Button>
					{#if nextLesson}
						<Button variant="accent" block onclick={() => goto(`/learn/${nextLesson.id}`)}>{t('placement.startLesson', { lesson: c(nextLesson.title) })}</Button>
					{/if}
				</div>
			{/if}
		</footer>
	</main>
{/if}

<style>
	.placement {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 560px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--space-4)) var(--gutter-l);
	}
	@media (min-width: 600px) and (orientation: landscape) {
		.placement {
			max-width: 1040px;
		}
		.bottom {
			width: 50%;
			margin-left: auto;
			padding-left: var(--space-4);
		}
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
		max-width: 520px;
		width: 100%;
	}
	.placement :global(.big) {
		padding: var(--space-6);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		width: 100%;
	}
	.choices :global(.choice) {
		min-height: 64px;
		text-align: center;
		font-size: 1.375rem;
		font-weight: 600;
		transition:
			transform 380ms var(--spring),
			background 200ms,
			opacity 200ms;
	}
	.choices :global(.choice:active) {
		transform: scale(0.95);
	}
	.choices :global(.choice:disabled) {
		opacity: 0.4;
	}
	.choices :global(.choice.right) {
		background: color-mix(in srgb, var(--success) 85%, transparent);
		color: #fff;
		animation: pop 420ms var(--spring-bouncy);
	}
	.choices :global(.choice.wrong) {
		background: color-mix(in srgb, var(--danger) 85%, transparent);
		color: #fff;
	}
	.feedback-wrap {
		width: 100%;
		margin-top: var(--space-3);
	}
	.feedback-wrap :global(.feedback) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.results {
		list-style: none;
		margin: var(--space-1h) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
		max-height: 46dvh;
		overflow-y: auto;
	}
	.results :global(.result) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
	}
	.mark {
		width: 22px;
		text-align: center;
		font-weight: 700;
		color: var(--ink-3, var(--ink-2));
	}
	:global(.result.ok) .mark {
		color: var(--success);
	}
	:global(.result.bad) .mark {
		color: var(--danger);
	}
	.sub {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.result) .headline {
		white-space: nowrap;
	}
	.bottom {
		min-height: 50px;
	}
</style>
