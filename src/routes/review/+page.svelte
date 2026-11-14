<!--
	Review session. Cards are tested harder as they get stronger:
	  learning, or stability < 3 d → pick the reading (recognition)
	  3 – 21 d          → type the reading (cued recall)
	  > 21 d            → hear/see the reading, draw the kana (production)
	Grades are inferred from correctness, time and hint use (PLAN §5.2).
-->
<script lang="ts">
	import MnemonicHint from '#lib/components/MnemonicHint.svelte';
	import Romaji from '#lib/components/Romaji.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { byChar, romajiMatches, speak, type Kana } from '#lib/content/kana.ts';
	import { mnemonicFor } from '#lib/content/mnemonics.ts';
	import { confusablesOf } from '#lib/content/confusables.ts';
	import { Good, inferGrade, type Grade } from '#lib/srs/fsrs.ts';
	import { choicesFor } from '#lib/quiz.ts';
	import { progress, haptic } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import StrokeAnimator from '#lib/components/StrokeAnimator.svelte';
	import RecallPad from '#lib/components/RecallPad.svelte';
	import ProgressRing from '#lib/components/ProgressRing.svelte';
	import WordQuiz from '#lib/components/WordQuiz.svelte';

	ui.hue = 220;

	type Mode = 'choose' | 'type' | 'draw';
	const SESSION_MAX = 50;

	/**
	 * A session entry. Kana and word/phrase cards share the FSRS log by id.
	 *   isNew: first introduction of a word card (grade capped at Good)
	 *   drill: tag drill of a card that isn't due — practised, not rescheduled (D21)
	 */
	interface Entry {
		id: string;
		isNew: boolean;
		drill: boolean;
	}

	const tag = page.url.searchParams.get('tag');
	const now = Date.now();

	function buildQueue(): Entry[] {
		if (tag) {
			return words
				.byTag(tag)
				.filter((c) => !words.isParked(c))
				.map((c) => {
					const s = progress.cards[c.id];
					const due = !!s && s.state !== 'new' && s.due <= now;
					return { id: c.id, isNew: !s || s.state === 'new', drill: !due && !!s && s.state !== 'new' };
				})
				.slice(0, SESSION_MAX);
		}
		const due = progress.due.slice(0, SESSION_MAX).map((c) => ({ id: c.id, isNew: false, drill: false }));
		const fresh = words.newQueue.slice(0, Math.max(0, SESSION_MAX - due.length)).map((c) => ({ id: c.id, isNew: true, drill: false }));
		return [...due, ...fresh];
	}

	const initial = buildQueue();
	const total = initial.length;
	let queue = $state<Entry[]>(initial);
	let done = $state(0);
	let correctCount = $state(0);
	let lastCorrect = true;

	let answer = $state('');
	let result = $state<null | { correct: boolean; guess?: string }>(null);
	let usedHint = $state(false);
	let options = $state<Kana[]>([]);
	let shaking = $state(false);
	let t0 = performance.now();

	const entry = $derived(queue[0]);
	const card = $derived(entry ? progress.cards[entry.id] : undefined);
	const kana = $derived(entry?.id.startsWith('kana:') ? byChar.get(entry.id.slice(5)) : undefined);
	const wordCard = $derived(entry && !kana ? words.cards[entry.id] : undefined);
	const mode = $derived<Mode>(
		!card || card.state !== 'review' || card.stability < 3 ? 'choose' : card.stability < 21 ? 'type' : 'draw'
	);

	function prep() {
		answer = '';
		result = null;
		usedHint = false;
		t0 = performance.now();
		if (kana && mode === 'choose') options = choicesFor(kana);
		if (kana && mode === 'draw') speak(kana.char);
	}
	prep();

	/** Record an answer for the current entry (shared by kana and word cards). */
	async function record(correct: boolean, ms: number, scaledMs: number, hint: boolean) {
		if (!entry) return;
		lastCorrect = correct;
		if (correct) correctCount++;
		if (entry.drill) return; // practice only: don't reschedule a card that isn't due
		let grade: Grade = inferGrade(correct, scaledMs, hint);
		if (entry.isNew && grade > Good) grade = Good; // first exposure goes through learning steps
		const wasNew = !progress.cards[entry.id] || progress.cards[entry.id].state === 'new';
		await progress.record(entry.id, grade, ms);
		if (wasNew && words.cards[entry.id]?.source === 'pack') await words.notePackIntroduced();
	}

	async function submit(correct: boolean, guess?: string) {
		if (!card || !kana || result) return;
		const ms = performance.now() - t0;
		result = { correct, guess };
		if (correct) {
			haptic('success');
			speak(kana.char);
		} else {
			haptic('error');
			shaking = true;
			setTimeout(() => (shaking = false), 480);
		}
		// drawing takes longer than tapping, so scale the time before grading
		const scaled = mode === 'draw' ? ms / 3 : mode === 'type' ? ms / 1.5 : ms;
		await record(correct, ms, scaled, usedHint);
		if (correct && mode === 'choose') setTimeout(next, 700);
	}

	async function onWordAnswer(r: { correct: boolean; ms: number; hint: boolean }) {
		haptic(r.correct ? 'success' : 'error');
		await record(r.correct, r.ms, r.ms / 1.5, r.hint);
	}

	function next() {
		const [head, ...rest] = queue;
		done++;
		// a missed card comes back once more at the end of this session
		queue = lastCorrect ? rest : [...rest, { ...head, isNew: false }];
		lastCorrect = true;
		prep();
	}

	function onKey(e: KeyboardEvent) {
		if (!kana || e.key !== 'Enter') return;
		if (result) next();
		else if (mode === 'type' && answer.trim()) submit(romajiMatches(kana, answer));
	}
</script>

<svelte:window onkeydown={onKey} />

<main class="review">
	<header class="top">
		<button class="icon-btn" aria-label="End session" onclick={() => goto('/')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
		</button>
		<div class="bar"><span style:width="{total ? (Math.min(done, total) / total) * 100 : 100}%"></span></div>
		<div class="caption count">{Math.min(done, total)}/{total}</div>
	</header>

	{#if tag}
		<div class="tagline caption">Drilling <b>{tag}</b>. Cards that aren’t due are practised without changing their schedule.</div>
	{/if}

	{#if !entry || (!kana && !wordCard)}
		<section class="stage" in:scale={{ start: 0.94, duration: 400 }}>
			<div class="stack center" style:--gap="16px">
				<ProgressRing value={total ? correctCount / Math.max(done, 1) : 1} size={140}>
					<div>
						<div class="big-num">{total ? Math.round((correctCount / Math.max(done, 1)) * 100) : 100}%</div>
						<div class="caption">recalled</div>
					</div>
				</ProgressRing>
				<h1 class="large-title">{total ? 'Session complete' : tag ? 'Nothing to drill' : 'All caught up'}</h1>
				<p class="subhead">
					{total
						? 'Each card is now scheduled for the day your memory of it is predicted to dip to your target.'
						: 'Nothing is due right now. New reviews will appear as their dates come round.'}
				</p>
				<button class="btn accent" onclick={() => goto('/')}>Done</button>
			</div>
		</section>
	{:else if wordCard}
		{#key wordCard.id + done}
			<section class="stage" in:fly={{ y: 30, duration: 450, easing: cubicOut, opacity: 0 }}>
				<WordQuiz card={wordCard} fsrs={card} isNew={entry.isNew} drill={entry.drill} onanswer={onWordAnswer} onnext={next} />
			</section>
		{/key}
	{:else if kana}
		{#key entry.id + done}
			<section class="stage" in:fly={{ y: 30, duration: 450, easing: cubicOut, opacity: 0 }}>
				<div class="split">
				<div class="pane">
					<div class="eyebrow">
						{mode === 'choose' ? 'Which sound?' : mode === 'type' ? 'Type the reading' : 'Write this sound'}
						· {kana.script}
					</div>

					{#if mode === 'draw' && !result}
						<div class="row" style="justify-content:center">
							<div class="romaji">{kana.romaji}</div>
							<button class="icon-btn" aria-label="Listen" onclick={() => speak(kana.char)}>🔊</button>
						</div>
						<RecallPad char={kana.char} size="var(--pad)" oncomplete={(r) => submit(r.correct, r.guess)} />
					{:else}
						<div class="flip" class:flipped={!!result}>
							<div class="face front glass sheen" class:shake={shaking}>
								<KanaGlyph char={kana.char} size={150} scene={usedHint ? 0.9 : 0} />
								<Romaji text={kana.char} hide={!result} />
							</div>
							<div class="face back glass sheen">
								{#if result?.correct === false}
									<StrokeAnimator char={kana.char} size={150} speed={150} numbers={false} />
								{:else}
									<KanaGlyph char={kana.char} size={110} color="var(--success)" />
								{/if}
								<div class="romaji">{kana.romaji}</div>
							</div>
						</div>
					{/if}
				</div>
				<div class="pane answer">
					{#if mode === 'draw' && !result}
						<MnemonicHint char={kana.char} onuse={() => (usedHint = true)} />
					{:else if usedHint && !result}
						<p class="story" in:fly={{ y: 10, duration: 300 }}>{mnemonicFor(kana.char).story}</p>
					{/if}

					{#if !result}
						{#if mode === 'choose'}
							<div class="choices">
								{#each options as o (o.char)}
									<button class="glass choice" onclick={() => submit(o.romaji === kana.romaji)}>{o.romaji}</button>
								{/each}
							</div>
						{:else if mode === 'type'}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								bind:value={answer}
								placeholder="romaji…"
								aria-label="Reading in romaji"
								autocomplete="off"
								autocapitalize="off"
								autocorrect="off"
								spellcheck="false"
								inputmode="text"
								enterkeyhint="done"
								onfocus={(e) => setTimeout(() => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
								autofocus
							/>
							<button class="btn block" disabled={!answer.trim()} onclick={() => submit(romajiMatches(kana, answer))}>Check</button>
						{/if}
						{#if mode !== 'draw'}
							<button class="btn ghost small" onclick={() => (usedHint = true)} disabled={usedHint}>💡 Hint</button>
						{/if}
					{:else}
						{#if !result.correct}
							<div class="glass feedback" in:scale={{ start: 0.9, duration: 300 }}>
								<p style="margin:0">{mnemonicFor(kana.char).story}</p>
								{#if result.guess && result.guess !== kana.char}
									<p class="caption" style="margin:6px 0 0">You drew something closer to <span class="jp">{result.guess}</span><Romaji text={result.guess} inline />.</p>
								{/if}
								{#if confusablesOf(kana.char).length}
									<div class="row confuse">
										<span class="caption">Don't confuse with</span>
										{#each confusablesOf(kana.char).slice(0, 3) as c}
											<span class="pair"><KanaGlyph char={c} size={34} /><span class="caption">{byChar.get(c)?.romaji}</span></span>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
						{#if !(result.correct && mode === 'choose')}
							<button class="btn block {result.correct ? '' : 'accent'}" onclick={next}>Continue</button>
						{/if}
					{/if}
				</div>
				</div>
			</section>
		{/key}
	{/if}
</main>

<style>
	.answer {
		max-width: 440px;
	}
	/* Keep the answer field above the iOS keyboard */
	:global(html.keyboard) .review {
		padding-bottom: calc(var(--kb) + 12px);
	}
	@media (min-width: 600px) {
		.review {
			--pad: min(42vw, 60dvh, 400px);
			max-width: 1040px !important;
		}
	}
	.tagline {
		text-align: center;
		margin-top: 8px;
	}
	.review {
		--pad: min(78vw, 320px);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 560px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + 16px) var(--gutter-l);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
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
		background: linear-gradient(90deg, var(--accent-2), #8b5cf6);
		border-radius: 4px;
		transition: width 600ms var(--spring);
	}
	.count {
		width: 48px;
		text-align: right;
	}
	.stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px 0;
	}
	.center {
		align-items: center;
		text-align: center;
		width: 100%;
	}
	.big-num {
		font-family: var(--font-display);
		font-size: 34px;
		font-weight: 700;
	}
	.romaji {
		font-family: var(--font-display);
		font-size: 40px;
		font-weight: 700;
		line-height: 1;
	}
	/* 3D flip card */
	.flip {
		position: relative;
		width: 220px;
		height: 240px;
		perspective: 1000px;
	}
	.face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: var(--r-l);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		transition: transform 700ms var(--spring);
	}
	.back {
		transform: rotateY(180deg);
	}
	.flipped .front {
		transform: rotateY(-180deg);
	}
	.flipped .back {
		transform: rotateY(0);
	}
	.story {
		margin: 0;
		max-width: 30ch;
		color: var(--ink-2);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		width: 100%;
	}
	.choice {
		min-height: 64px;
		font-size: 1.375rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 380ms var(--spring);
	}
	.choice:active {
		transform: scale(0.95);
	}
	.feedback {
		width: 100%;
		padding: 14px 16px;
		text-align: left;
	}
	.confuse {
		margin-top: 10px;
		flex-wrap: wrap;
		--gap: 10px;
	}
	.pair {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
</style>
