<!--
	Review session. Cards are tested harder as they get stronger:
	  learning, or stability < 3 d → pick the reading (recognition)
	  3 – 21 d          → type the reading (cued recall)
	  > 21 d            → hear/see the reading, draw the kana (production)
	Grades are inferred from correctness, time and hint use (PLAN §5.2).
	Kanji cards pick the meaning until they're strong, then are drawn from it.
-->
<script lang="ts">
	import { kuriReact } from '#lib/companion/kuri.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { c, gloss, scriptName, story } from '#lib/i18n/content.ts';
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
	import { Button, Card, IconButton, ProgressRing, TextField } from '#lib/ui/index.ts';
	import WordQuiz from '#lib/components/WordQuiz.svelte';
	import NoteCard from '#lib/components/NoteCard.svelte';
	import { notes } from '#lib/state/notes.svelte.ts';
	import { DRILLS, isDrillId, pickDrill } from '#lib/practice/drills.ts';
	import KanjiInfo from '#lib/components/KanjiInfo.svelte';
	import { kanjiByChar, meaningChoices, type Kanji } from '#lib/content/kanji.ts';
	import { partColors } from '#lib/content/strokes.ts';

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
	const practiceParam = page.url.searchParams.get('practice');
	const practice = isDrillId(practiceParam) ? DRILLS.find((d) => d.id === practiceParam)! : null;
	const now = Date.now();

	function buildQueue(): Entry[] {
		if (practice) {
			const isWord = (id: string) => !!words.cards[id] && !words.cards[id].deleted;
			return pickDrill(practice.id, progress.cards, isWord, now).map((id) => {
				const s = progress.cards[id];
				return { id, isNew: false, drill: s.due > now };
			});
		}
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
	let kanjiOptions = $state<Kanji[]>([]);
	let shaking = $state(false);
	let t0 = performance.now();

	const entry = $derived(queue[0]);
	const card = $derived(entry ? progress.cards[entry.id] : undefined);
	const kana = $derived(entry?.id.startsWith('kana:') ? byChar.get(entry.id.slice(5)) : undefined);
	const kanji = $derived(entry?.id.startsWith('kanji:') ? kanjiByChar.get(entry.id.slice(6)) : undefined);
	const wordCard = $derived(entry && !kana && !kanji ? words.cards[entry.id] : undefined);
	const mode = $derived.by<Mode>(() => {
		if (practice?.id === 'lookalikes') return 'choose';
		const m: Mode = !card || card.state !== 'review' || card.stability < 3 ? 'choose' : card.stability < 21 ? 'type' : 'draw';
		// kanji have no typed step: their answer is a meaning, not a reading
		return kanji ? (card && card.state === 'review' && card.stability >= 21 ? 'draw' : 'choose') : m;
	});

	function prep() {
		answer = '';
		result = null;
		usedHint = false;
		t0 = performance.now();
		if (kana && mode === 'choose') options = choicesFor(kana);
		if (kana && mode === 'draw') speak(kana.char);
		if (kanji && mode === 'choose') kanjiOptions = meaningChoices(kanji);
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
		if (!card || !(kana || kanji) || result) return;
		const ms = performance.now() - t0;
		result = { correct, guess };
		if (correct) {
			haptic('success');
			kuriReact('happy');
			speak(kana ? kana.char : kanji!.example.reading);
		} else {
			haptic('error');
			kuriReact('encourage');
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
		if (kanji && e.key === 'Enter' && result) return next();
		if (!kana || e.key !== 'Enter') return;
		if (result) next();
		else if (mode === 'type' && answer.trim()) submit(romajiMatches(kana, answer));
	}
</script>

<svelte:window onkeydown={onKey} />

<main class="review">
	<header class="top">
		<IconButton label={t('review.end')} onclick={() => goto('/')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
		</IconButton>
		<div class="bar"><span style:width="{total ? (Math.min(done, total) / total) * 100 : 100}%"></span></div>
		<div class="caption count">{Math.min(done, total)}/{total}</div>
	</header>

	{#if tag}
		<div class="tagline caption">{@html t('review.drilling', { tag: `<b>${tag.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)}</b>` })}</div>
	{:else if practice}
		<div class="tagline caption">{@html t('review.practicing', { drill: `${practice.emoji} <b>${c(practice.title)}</b>` })}</div>
	{/if}

	{#if !entry || (!kana && !kanji && !wordCard)}
		<section class="stage" in:scale={{ start: 0.94, duration: 400 }}>
			<div class="stack center" style:--gap="var(--space-4)">
				<ProgressRing value={total ? correctCount / Math.max(done, 1) : 1} size={140}>
					<div>
						<div class="big-num">{total ? Math.round((correctCount / Math.max(done, 1)) * 100) : 100}%</div>
						<div class="caption">{t('review.recalled')}</div>
					</div>
				</ProgressRing>
				<h1 class="large-title">{total ? (practice ? t('review.practiceComplete') : t('review.complete')) : tag || practice ? t('review.nothingDrill') : t('review.caughtUp')}</h1>
				<p class="subhead">
					{total && practice
						? t('review.practiceCompleteBody')
						: !total && practice
							? t('review.practiceEmptyBody')
							: total
								? t('review.completeBody')
								: t('review.caughtUpBody')}
				</p>
				<div class="row">
					{#if practice && total}<Button variant="ghost" onclick={() => (location.href = `/review?practice=${practice.id}`)}>{t('review.again')}</Button>{/if}
					<Button variant="accent" onclick={() => goto(practice ? '/learn' : '/')}>{t('common.done')}</Button>
				</div>
			</div>
		</section>
	{:else if wordCard}
		{#key wordCard.id + done}
			<section class="stage" in:fly={{ y: 30, duration: 450, easing: cubicOut, opacity: 0 }}>
				<WordQuiz card={wordCard} fsrs={card} isNew={entry.isNew} drill={entry.drill} onanswer={onWordAnswer} onnext={next} />
			</section>
		{/key}
	{:else if kanji}
		{#key entry.id + done}
			<section class="stage" in:fly={{ y: 30, duration: 450, easing: cubicOut, opacity: 0 }}>
				<div class="split">
					<div class="pane">
						<div class="eyebrow">{mode === 'draw' ? t('review.writeKanji') : t('quiz.whatMeans')} · {t('learn.kanji')}</div>
						{#if mode === 'draw' && !result}
							<div class="romaji">{gloss(kanji.meaning)}</div>
							<RecallPad char={kanji.char} size="var(--pad)" oncomplete={(r) => submit(r.correct, r.guess)} />
						{:else}
							<div class="flip" class:flipped={!!result}>
								<Card sheen padding="none" radius="large" class="face front {shaking ? 'shake' : ''}">
									<KanaGlyph char={kanji.char} size={150} scene={usedHint ? 0.9 : 0} />
								</Card>
								<Card sheen padding="none" radius="large" class="face back">
									{#if result?.correct === false}
										<StrokeAnimator char={kanji.char} size={150} speed={150} numbers={false} scene={0.5} colors={partColors(kanji.char)} />
									{:else}
										<KanaGlyph char={kanji.char} size={110} color="var(--success)" />
									{/if}
									<div class="romaji">{gloss(kanji.meaning)}</div>
								</Card>
							</div>
						{/if}
					</div>
					<div class="pane answer">
						{#if mode === 'draw' && !result}
							<MnemonicHint char={kanji.char} onuse={() => (usedHint = true)} />
						{:else if usedHint && !result}
							<p class="story" in:fly={{ y: 10, duration: 300 }}>{c(kanji.story)}</p>
						{/if}
						{#if !result}
							{#if mode === 'choose'}
								<div class="choices">
									{#each kanjiOptions as o (o.char)}
										<Card padding="none" class="choice small-text" onclick={() => submit(o.char === kanji.char)}>{gloss(o.meaning)}</Card>
									{/each}
								</div>
								<Button variant="ghost" size="sm" onclick={() => (usedHint = true)} disabled={usedHint}>💡 {t('review.showPicture')}</Button>
							{/if}
						{:else}
							{#if !result.correct}
								<div class="feedback-wrap" in:scale={{ start: 0.9, duration: 300 }}><Card class="feedback">
									<KanjiInfo kanji={kanji} compact />
									{#if result.guess && result.guess !== kanji.char}
										<p class="caption" style="margin:var(--space-1h) 0 0">{t('review.drewCloser')} <span class="jp">{result.guess}</span></p>
									{/if}
								</Card></div>
							{/if}
							<NoteCard peek value={notes.text(`kanji:${kanji.char}`)} onsave={(b) => notes.save(`kanji:${kanji.char}`, kanji.char, b)} />
							{#if !(result.correct && mode === 'choose')}
								<Button variant={result.correct ? 'primary' : 'accent'} block onclick={next}>{t('common.continue')}</Button>
							{/if}
						{/if}
					</div>
				</div>
			</section>
		{/key}
	{:else if kana}
		{#key entry.id + done}
			<section class="stage" in:fly={{ y: 30, duration: 450, easing: cubicOut, opacity: 0 }}>
				<div class="split">
				<div class="pane">
					<div class="eyebrow">
						{mode === 'choose' ? t('review.whichSound') : mode === 'type' ? t('review.typeReading') : t('review.writeSound')}
						· {scriptName(kana.script)}
					</div>

					{#if mode === 'draw' && !result}
						<div class="row" style="justify-content:center">
							<div class="romaji">{kana.romaji}</div>
							<IconButton label={t('common.listen')} onclick={() => speak(kana.char)}>🔊</IconButton>
						</div>
						<RecallPad char={kana.char} size="var(--pad)" oncomplete={(r) => submit(r.correct, r.guess)} />
					{:else}
						<div class="flip" class:flipped={!!result}>
							<Card sheen padding="none" radius="large" class="face front {shaking ? 'shake' : ''}">
								<KanaGlyph char={kana.char} size={150} scene={usedHint ? 0.9 : 0} />
								<Romaji text={kana.char} hide={!result} />
							</Card>
							<Card sheen padding="none" radius="large" class="face back">
								{#if result?.correct === false}
									<StrokeAnimator char={kana.char} size={150} speed={150} numbers={false} />
								{:else}
									<KanaGlyph char={kana.char} size={110} color="var(--success)" />
								{/if}
								<div class="romaji">{kana.romaji}</div>
							</Card>
						</div>
					{/if}
				</div>
				<div class="pane answer">
					{#if mode === 'draw' && !result}
						<MnemonicHint char={kana.char} onuse={() => (usedHint = true)} />
					{:else if usedHint && !result}
						<p class="story" in:fly={{ y: 10, duration: 300 }}>{story(kana.char)}</p>
					{/if}

					{#if !result}
						{#if mode === 'choose'}
							<div class="choices">
								{#each options as o (o.char)}
									<Card padding="none" class="choice" onclick={() => submit(o.romaji === kana.romaji)}>{o.romaji}</Card>
								{/each}
							</div>
						{:else if mode === 'type'}
							<!-- svelte-ignore a11y_autofocus -->
							<TextField
								variant="answer"
								class="answer-field"
								bind:value={answer}
								placeholder={t('review.romajiPlaceholder')}
								aria-label={t('review.readingRomaji')}
								autocomplete="off"
								autocapitalize="off"
								autocorrect="off"
								spellcheck="false"
								inputmode="text"
								enterkeyhint="done"
								onfocus={(e) => setTimeout(() => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
								autofocus
							/>
							<Button block disabled={!answer.trim()} onclick={() => submit(romajiMatches(kana, answer))}>{t('quiz.check')}</Button>
						{/if}
						{#if mode !== 'draw'}
							<Button variant="ghost" size="sm" onclick={() => (usedHint = true)} disabled={usedHint}>💡 {t('quiz.hint')}</Button>
						{/if}
					{:else}
						{#if !result.correct}
							<div class="feedback-wrap" in:scale={{ start: 0.9, duration: 300 }}><Card class="feedback">
								<p style="margin:0">{story(kana.char)}</p>
								{#if result.guess && result.guess !== kana.char}
									<p class="caption" style="margin:var(--space-1h) 0 0">{t('review.drewCloser')} <span class="jp">{result.guess}</span><Romaji text={result.guess} inline /></p>
								{/if}
								{#if confusablesOf(kana.char).length}
									<div class="row confuse">
										<span class="caption">{t('review.dontConfuse')}</span>
										{#each confusablesOf(kana.char).slice(0, 3) as c}
											<span class="pair"><KanaGlyph char={c} size={34} /><span class="caption">{byChar.get(c)?.romaji}</span></span>
										{/each}
									</div>
								{/if}
							</Card></div>
						{/if}
						<NoteCard peek value={notes.text(`kana:${kana.char}`)} onsave={(b) => notes.save(`kana:${kana.char}`, kana.char, b)} />
						{#if !(result.correct && mode === 'choose')}
							<Button variant={result.correct ? 'primary' : 'accent'} block onclick={next}>{t('common.continue')}</Button>
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
	.answer :global(.answer-field) {
		width: 100%;
	}
	/* Keep the answer field above the iOS keyboard */
	:global(html.keyboard) .review {
		padding-bottom: calc(var(--kb) + var(--space-3));
	}
	@media (min-width: 600px) and (orientation: landscape) {
		.review {
			--pad: min(42vw, 60dvh, 400px);
			max-width: 1040px !important;
		}
	}
	/* Unfolded iPhone Duo, portrait: stacked like compact, but with a larger canvas */
	@media (min-width: 600px) and (orientation: portrait) {
		.review {
			--pad: min(72vw, 44dvh, 460px);
			max-width: 680px !important;
		}
	}
	.tagline {
		text-align: center;
		margin-top: var(--space-2);
	}
	.review {
		--pad: min(78vw, 320px);
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
		padding: var(--space-5) 0;
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
	.flip :global(.face) {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1h);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		transition: transform 700ms var(--spring);
	}
	.flip :global(.back) {
		transform: rotateY(180deg);
	}
	.flipped :global(.front) {
		transform: rotateY(-180deg);
	}
	.flipped :global(.back) {
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
		gap: var(--space-3);
		width: 100%;
	}
	.choices :global(.choice) {
		min-height: 64px;
		text-align: center;
		font-size: 1.375rem;
		font-weight: 600;
		transition: transform 380ms var(--spring);
	}
	.choices :global(.choice.small-text) {
		font-size: 1.0625rem;
		padding: var(--space-1h) var(--space-3);
	}
	.choices :global(.choice:active) {
		transform: scale(0.95);
	}
	.feedback-wrap {
		width: 100%;
	}
	.feedback-wrap :global(.feedback) {
		text-align: left;
	}
	.confuse {
		margin-top: var(--space-3);
		flex-wrap: wrap;
		--gap: var(--space-3);
	}
	.pair {
		display: inline-flex;
		align-items: center;
		gap: var(--space-px);
	}
</style>
