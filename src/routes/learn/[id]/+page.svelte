<!--
	Lesson loop (docs/PLAN.md §3):
	  MEET → TRACE (per kana) → RECOGNISE (pick 1 of 4) → RECALL (draw from memory) → SCHEDULE
-->
<script lang="ts">
	import { kuriReact } from '#lib/companion/kuri.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { c, scriptName, story } from '#lib/i18n/content.ts';
	import MnemonicHint from '#lib/components/MnemonicHint.svelte';
	import Romaji from '#lib/components/Romaji.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { lessonById, LESSONS, cardId } from '#lib/content/lessons.ts';
	import { speak, type Kana } from '#lib/content/kana.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';
	import { inferGrade, Again, Good, type Grade } from '#lib/srs/fsrs.ts';
	import { choicesFor, shuffle } from '#lib/quiz.ts';
	import { progress, haptic } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { confirmDestructive } from '#lib/ios/overlay.svelte.ts';
	import StrokeAnimator from '#lib/components/StrokeAnimator.svelte';
	import TracePad from '#lib/components/TracePad.svelte';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import RecallPad from '#lib/components/RecallPad.svelte';
	import { Button, Card, IconButton } from '#lib/ui/index.ts';

	type Phase = 'intro' | 'meet' | 'trace' | 'recognize' | 'recall' | 'done';

	const lesson = $derived(lessonById.get(page.params.id ?? ''));
	$effect(() => {
		if (lesson) ui.hue = lesson.hue;
	});

	let phase = $state<Phase>('intro');
	let idx = $state(0); // index into lesson.chars for meet/trace
	let queue = $state<Kana[]>([]); // quiz queue
	let qStart = 0;
	let choice = $state<string | null>(null);
	let options = $state<Kana[]>([]);
	let shaking = $state(false);
	let recallResult = $state<{ correct: boolean; guess?: string } | null>(null);
	let animKey = $state(0);
	let lastCorrect = true;
	/** Saving the reviews at the end of the lesson (busy on the button that started it). */
	let finishing = $state(false);

	interface Stat {
		wrong: number;
		hinted?: boolean;
		ms: number[];
		recallOk: boolean;
	}
	let stats: Record<string, Stat> = {};

	const chars = $derived(lesson?.chars ?? []);
	const current = $derived(phase === 'meet' || phase === 'trace' ? chars[idx] : queue[0]);
	const steps = $derived(chars.length * 2 + 2);
	const stepNow = $derived(
		phase === 'intro' ? 0 : phase === 'meet' ? idx * 2 + 1 : phase === 'trace' ? idx * 2 + 2 : phase === 'recognize' ? steps - 1 : steps
	);
	const earlier = $derived(
		LESSONS.filter((l) => l.script === lesson?.script && progress.completed.includes(l.id)).flatMap((l) => l.chars)
	);

	function start() {
		stats = Object.fromEntries(chars.map((k) => [k.char, { wrong: 0, ms: [], recallOk: false }]));
		idx = 0;
		phase = 'meet';
		if (progress.settings.autoplayAudio) speak(chars[0].char);
	}

	function nextFromMeet() {
		phase = 'trace';
	}

	function nextFromTrace() {
		if (idx < chars.length - 1) {
			idx++;
			phase = 'meet';
			if (progress.settings.autoplayAudio) speak(chars[idx].char);
		} else {
			beginQuiz('recognize');
		}
	}

	function beginQuiz(p: 'recognize' | 'recall') {
		queue = shuffle(chars);
		phase = p;
		prepQuestion();
	}

	function prepQuestion() {
		choice = null;
		recallResult = null;
		qStart = performance.now();
		if (phase === 'recognize' && queue[0]) options = choicesFor(queue[0], [...chars, ...earlier]);
		if (phase === 'recall' && queue[0]) speak(queue[0].char);
	}

	function pick(k: Kana) {
		if (choice) return;
		const target = queue[0];
		choice = k.char;
		stats[target.char].ms.push(performance.now() - qStart);
		lastCorrect = k.romaji === target.romaji;
		if (lastCorrect) {
			haptic('success');
			kuriReact('happy');
			speak(target.char);
			setTimeout(advance, 650);
		} else {
			stats[target.char].wrong++;
			haptic('error');
			kuriReact('encourage');
			shaking = true;
			setTimeout(() => (shaking = false), 480);
		}
	}

	function advance() {
		const [head, ...rest] = queue;
		// wrong answers come back at the end of the round
		queue = lastCorrect ? rest : [...rest, head];
		if (queue.length === 0) {
			if (phase === 'recognize') beginQuiz('recall');
			else finish();
			return;
		}
		prepQuestion();
	}

	function onRecall(r: { correct: boolean; guess?: string }) {
		const target = queue[0];
		recallResult = r;
		lastCorrect = r.correct;
		stats[target.char].ms.push(performance.now() - qStart);
		if (r.correct) {
			stats[target.char].recallOk = true;
			haptic('success');
			kuriReact('happy');
		} else {
			stats[target.char].wrong++;
			haptic('error');
			kuriReact('encourage');
			animKey++;
		}
	}

	async function finish() {
		finishing = true;
		try {
			for (const k of chars) {
				const s = stats[k.char];
				const avg = s.ms.reduce((a, b) => a + b, 0) / Math.max(1, s.ms.length);
				// The lesson counts as the card's first review, capped at Good: a kana
				// met minutes ago should go through the short learning steps, never
				// jump straight to a multi-week interval. Drawing is slower than
				// tapping, so the time is halved before grading.
				const grade = s.wrong > 0 ? Again : (Math.min(inferGrade(true, avg / 2, s.hinted), Good) as Grade);
				await progress.record(cardId(k), grade, avg);
			}
			await progress.completeLesson(lesson!.id);
		} finally {
			finishing = false;
		}
		phase = 'done';
		haptic('success');
	}

	const nextLesson = $derived(LESSONS.find((l) => !progress.completed.includes(l.id)));

	// Leaving mid-lesson loses it (cards are only scheduled at the end), so ask
	// first, with an iOS action sheet, for both swipe-back and the close button.
	const inProgress = $derived(phase !== 'intro' && phase !== 'done');
	$effect(() => {
		ui.backGuard = inProgress
			? () => confirmDestructive(t('lesson.leaveTitle'), t('lesson.leaveBody'), t('lesson.leave'))
			: null;
		return () => (ui.backGuard = null);
	});

	async function close() {
		if (ui.backGuard && !(await ui.backGuard())) return;
		ui.backGuard = null;
		goto('/learn');
	}
</script>

{#if !lesson}
	<main class="page stack"><h1 class="large-title">{t('lesson.notFound')}</h1><a href="/learn">{t('common.back')}</a></main>
{:else}
	<main class="lesson" style:--h={lesson.hue}>
		<header class="top">
			<IconButton label={t('lesson.close')} onclick={close}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
			</IconButton>
			<div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps} aria-valuenow={stepNow}><span style:width="{(stepNow / steps) * 100}%"></span></div>
			<div class="caption phase-label">{phase === 'intro' || phase === 'done' ? '' : t(`lesson.phase.${phase}` as MessageKey)}</div>
		</header>

		{#key phase + idx + (queue[0]?.char ?? '')}
			<section class="stage" in:fly={{ x: 40, duration: 420, easing: cubicOut, opacity: 0 }}>
				{#if phase === 'intro'}
					<div class="split">
						<div class="pane">
							<div class="hero-chars jp">
								{#each chars as k, i}
									<span class="rise hero-k" style:--i={i}><KanaGlyph char={k.char} size={64} /><Romaji text={k.char} /></span>
								{/each}
							</div>
						</div>
						<div class="pane text">
							<div class="eyebrow">{scriptName(lesson.script)} · {t('lesson.n', { n: lesson.id.slice(1) })}</div>
							<h1 class="large-title">{c(lesson.title)}</h1>
							{#if lesson.note}<p class="subhead note">{c(lesson.note)}</p>{/if}
							<p class="subhead">{t('lesson.introMeta', { n: chars.length })}</p>
						</div>
					</div>
				{:else if phase === 'meet' && current}
					{@const m = mnemonicFor(current.char)}
					<div class="split">
						<div class="pane">
							<div class="eyebrow">{t('lesson.newOf', { i: idx + 1, n: chars.length })}</div>
							<Card sheen padding="lg" radius="large" class="canvas">
								{#key animKey}
									<StrokeAnimator char={current.char} size="100%" scene={m.scene ? 1 : 0} />
								{/key}
							</Card>
						</div>
						<div class="pane text">
							<div class="romaji">{current.romaji}</div>
							<p class="story">{story(current.char)}</p>
							<div class="row" style="justify-content:center">
								<Button variant="ghost" size="sm" onclick={() => speak(current.char)}>🔊 {t('common.listen')}</Button>
								<Button variant="ghost" size="sm" onclick={() => animKey++}>↻ {t('lesson.replay')}</Button>
							</div>
						</div>
					</div>
				{:else if phase === 'trace' && current}
					<div class="split">
						<div class="pane">
							<TracePad char={current.char} mode="trace" size="var(--pad)" oncomplete={nextFromTrace} />
						</div>
						<div class="pane text">
							<div class="eyebrow">{t('lesson.traceTitle')}</div>
							<div class="romaji small">{current.romaji}</div>
							<p class="caption">{t('lesson.traceBody')}</p>
						</div>
					</div>
				{:else if phase === 'recognize' && current}
					<div class="split">
						<div class="pane">
							<div class="eyebrow">{t('lesson.whichSound')}</div>
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
							{#if choice && options.find((o) => o.char === choice)?.romaji !== current.romaji}
								<div class="feedback-wrap" in:scale={{ start: 0.9, duration: 300 }}><Card class="feedback">
									<div class="row">
										<KanaGlyph char={current.char} size={56} />
										<div class="stack" style:--gap="var(--space-px)">
											<b>{current.romaji}</b>
											<span class="caption">{story(current.char)}</span>
										</div>
									</div>
									<Button block onclick={advance}>{t('lesson.gotIt')}</Button>
								</Card></div>
							{/if}
						</div>
					</div>
				{:else if phase === 'recall' && current}
					<div class="split">
						<div class="pane">
							{#if !recallResult}
								<RecallPad char={current.char} size="var(--pad)" oncomplete={onRecall} />
							{:else}
								<div in:scale={{ start: 0.92, duration: 350 }}>
									<Card sheen padding="lg" radius="large" class="canvas">
										{#key animKey}<StrokeAnimator char={current.char} size="100%" speed={140} />{/key}
									</Card>
								</div>
							{/if}
						</div>
						<div class="pane text">
							<div class="eyebrow">{t('lesson.recallTitle')}</div>
							<div class="row" style="justify-content:center">
								<div class="romaji">{current.romaji}</div>
								<IconButton label={t('common.listen')} onclick={() => speak(current.char)}>🔊</IconButton>
							</div>
							{#if !recallResult}
								<MnemonicHint char={current.char} onuse={() => (stats[current.char].hinted = true)} />
							{/if}
							{#if recallResult}
								<p class="headline" style:color={recallResult.correct ? 'var(--success)' : 'var(--danger)'}>
									{recallResult.correct ? t('lesson.recallOk') : recallResult.guess ? t('lesson.recallLooked', { guess: recallResult.guess }) : t('lesson.recallWrong')}
								</p>
								<Button block busy={finishing} onclick={advance}>{t('common.continue')}</Button>
							{/if}
						</div>
					</div>
				{:else if phase === 'done'}
					<div class="split">
						<div class="pane">
							<div class="celebrate">
								{#each chars as k, i}
									<span style:--i={i} class="pop-in hero-k"><KanaGlyph char={k.char} size={54} color="var(--success)" /><Romaji text={k.char} /></span>
								{/each}
							</div>
						</div>
						<div class="pane text">
							<h1 class="large-title">{t('lesson.complete')}</h1>
							<p class="subhead">
								{t('lesson.completeBody', { n: chars.length })}
							</p>
						</div>
					</div>
				{/if}
			</section>
		{/key}

		<footer class="bottom">
			{#if phase === 'intro'}
				<Button variant="accent" block onclick={start}>{t('lesson.start')}</Button>
			{:else if phase === 'meet'}
				<Button variant="accent" block onclick={nextFromMeet}>{t('lesson.nowTrace')}</Button>
			{:else if phase === 'trace'}
				<Button variant="ghost" block onclick={nextFromTrace}>{t('lesson.skipTrace')}</Button>
			{:else if phase === 'done'}
				<div class="row" style="width:100%">
					<Button variant="ghost" block onclick={() => goto('/')}>{t('common.done')}</Button>
					{#if nextLesson}
						<Button variant="accent" block onclick={() => goto(`/learn/${nextLesson.id}`).then(() => (phase = 'intro'))}>{t('lesson.next')}</Button>
					{/if}
				</div>
			{/if}
		</footer>
	</main>
{/if}


<style>
	.lesson {
		--pad: min(78vw, 340px);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 560px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--space-4)) var(--gutter-l);
	}
	/* Unfolded iPhone Duo, landscape: visual left, interaction right */
	@media (min-width: 600px) and (orientation: landscape) {
		.lesson {
			--pad: min(42vw, 60dvh, 420px);
			max-width: 1040px;
		}
		.text {
			align-items: flex-start !important;
			text-align: left;
		}
		.bottom {
			width: 50%;
			margin-left: auto;
			padding-left: var(--space-4);
		}
		.lesson :global(.canvas) {
			width: var(--pad) !important;
		}
	}
	/* Unfolded iPhone Duo, portrait: stacked like compact, but with a larger canvas */
	@media (min-width: 600px) and (orientation: portrait) {
		.lesson {
			--pad: min(72vw, 44dvh, 480px);
			max-width: 680px;
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
	.phase-label {
		width: 70px;
		text-align: right;
		text-transform: capitalize;
	}
	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5) 0;
	}
	.hero-chars {
		display: flex;
		gap: var(--space-1h);
		flex-wrap: wrap;
		justify-content: center;
	}
	.hero-k {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		font-size: 1.25rem;
	}
	.note {
		max-width: 34ch;
	}
	.text {
		text-align: center;
	}
	.lesson :global(.canvas) {
		width: min(72vw, 300px);
		aspect-ratio: 1;
	}
	.romaji {
		font-family: var(--font-display);
		font-size: 44px;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.romaji.small {
		font-size: 28px;
		color: var(--ink-2);
	}
	.story {
		margin: 0;
		max-width: 30ch;
		font-size: 1.125rem;
	}
	.lesson :global(.big) {
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
	}
	.feedback-wrap :global(.feedback) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		text-align: left;
	}
	.celebrate {
		display: flex;
		gap: var(--space-1);
	}
	.pop-in {
		animation: rise 700ms var(--spring-bouncy) both;
		animation-delay: calc(var(--i) * 90ms);
	}
	.bottom {
		min-height: 50px;
	}
</style>
