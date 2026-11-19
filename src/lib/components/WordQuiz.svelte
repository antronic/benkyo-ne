<!--
	One word/phrase card in a review session.
	  new card      → study face first (kana front, meaning, hook, example), then a quick check
	  weak card     → kana front → pick the meaning (recognition)
	  strong card   → meaning → type the reading in romaji or kana (production)
	Grades are inferred by the parent from correctness + time (PLAN §5.2).
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import Romaji from './Romaji.svelte';
	import { onMount, untrack } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { romajiToKana } from '@johnmorrisdotca/jisho/words';
	import type { UserCard } from '#lib/ai/contract.ts';
	import type { Card } from '#lib/srs/fsrs.ts';
	import { speak } from '#lib/content/kana.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { shuffle } from '#lib/quiz.ts';
	import WordCardView from './WordCardView.svelte';
	import NoteCard from './NoteCard.svelte';
	import { notes } from '#lib/state/notes.svelte.ts';
	import { Button, Card as Surface, TextField } from '#lib/ui/index.ts';

	interface Props {
		card: UserCard;
		fsrs: Card | undefined;
		isNew: boolean;
		drill: boolean;
		onanswer: (r: { correct: boolean; ms: number; hint: boolean }) => void;
		onnext: () => void;
	}
	let { card, fsrs, isNew, drill, onanswer, onnext }: Props = $props();

	const FALLBACK = ['water', 'red', 'mountain', 'to eat', 'cat', 'tomorrow', 'pond', 'face', 'here', 'thank you', 'station', 'big'];

	type Mode = 'study' | 'choose' | 'type';
	// The parent re-creates this component per card ({#key}), so the initial props are all we need.
	let mode = $state<Mode>(
		untrack(() => (isNew ? 'study' : !fsrs || fsrs.state !== 'review' || fsrs.stability < 3 ? 'choose' : 'type'))
	);
	let options = $state<string[]>([]);
	let answer = $state('');
	let picked = $state<string | null>(null);
	let result = $state<{ correct: boolean } | null>(null);
	let hint = $state(false);
	let t0 = performance.now();

	function makeOptions() {
		const pool = words.list.filter((c) => c.id !== card.id && c.gloss !== card.gloss).map((c) => c.gloss);
		const extra = FALLBACK.filter((g) => g !== card.gloss && !pool.includes(g));
		options = shuffle([card.gloss, ...shuffle([...pool, ...extra]).slice(0, 3)]);
	}
	onMount(() => {
		if (mode === 'choose') makeOptions();
		if (mode !== 'type') speak(card.front);
	});

	function startQuiz() {
		mode = 'choose';
		makeOptions();
		t0 = performance.now();
	}

	const fold = (s: string) =>
		s
			.normalize('NFKC')
			.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
			.replace(/[\s。、！？!?.,・〜ー]/g, '');

	function check(text: string): boolean {
		const target = fold(card.front);
		const typed = text.trim();
		if (!typed) return false;
		if (fold(typed) === target) return true; // typed kana directly
		const kana = romajiToKana(typed.toLowerCase());
		return !!kana && fold(kana) === target;
	}

	function submit(correct: boolean) {
		if (result) return;
		result = { correct };
		speak(card.front);
		onanswer({ correct, ms: performance.now() - t0, hint });
		if (correct && mode === 'choose') setTimeout(onnext, 900);
	}
</script>

<div class="wq">
	<div class="eyebrow">
		{mode === 'study' ? (card.kind === 'phrase' ? t('quiz.newPhrase') : t('quiz.newWord')) : mode === 'choose' ? t('quiz.whatMeans') : t('quiz.howSay')}
		{#if drill}· {t('quiz.drill')}{/if}
	</div>

	<div class="split">
		<div class="pane">
			{#if mode === 'type'}
				<Surface sheen padding="lg" radius="large" class="face">
					<span class="meaning">{gloss(card.gloss)}</span>
					{#if card.gloss2}<span class="caption">{card.gloss2}</span>{/if}
					{#if card.usage}<span class="caption">💬 {card.usage.en}</span>{/if}
				</Surface>
				{:else}
				<Surface sheen padding="lg" radius="large" class="face" onclick={() => speak(card.front)} aria-label={t('a11y.listenTo', { text: card.front })}>
					<span class="jp front">{card.front}</span>
					<Romaji text={card.front} />
				</Surface>
			{/if}
			{#if hint && card.hook && !result}
				<p class="caption" in:fly={{ y: 8, duration: 250 }}>💡 {card.hook.en}</p>
			{/if}
		</div>

		<div class="pane">
			{#if mode === 'study'}
				<div class="back"><Surface radius="large"><WordCardView {card} /></Surface></div>
				<Button variant="accent" block onclick={startQuiz}>{t('quiz.quizMe')}</Button>
			{:else if !result}
				{#if mode === 'choose'}
					<div class="choices">
						{#each options as o}
							<Surface padding="none" class="choice" selected={picked === o} onclick={() => ((picked = o), submit(o === card.gloss))}>{gloss(o)}</Surface>
						{/each}
					</div>
				{:else}
					<TextField
						variant="answer"
						class="answer"
						bind:value={answer}
						placeholder={t('quiz.typePlaceholder')}
						aria-label={t('quiz.reading')}
						autocomplete="off"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
						enterkeyhint="done"
						autofocus
						onkeydown={(e) => e.key === 'Enter' && answer.trim() && submit(check(answer))}
					/>
					<Button block disabled={!answer.trim()} onclick={() => submit(check(answer))}>{t('quiz.check')}</Button>
				{/if}
				{#if card.hook}
					<Button variant="ghost" size="sm" onclick={() => (hint = true)} disabled={hint}>💡 {t('quiz.hint')}</Button>
				{/if}
			{:else}
				<div class="back" in:scale={{ start: 0.94, duration: 300 }}>
					<Surface radius="large" class={result.correct ? '' : 'wrong'}>
						<p class="headline verdict" style:color={result.correct ? 'var(--success)' : 'var(--danger)'}>
							{result.correct ? t('quiz.correct') : t('quiz.notQuite')}
						</p>
						<WordCardView {card} />
					</Surface>
				</div>
				<NoteCard peek value={notes.text(card.id)} onsave={(b) => notes.save(card.id, card.front, b)} />
				{#if !(result.correct && mode === 'choose')}
					<Button variant={result.correct ? 'primary' : 'accent'} block onclick={onnext}>{t('common.continue')}</Button>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.wq {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		width: 100%;
	}
	.wq :global(.face) {
		width: min(78vw, 340px);
		min-height: 180px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1h);
		text-align: center;
	}
	.front {
		font-size: clamp(2.25rem, 11vw, 3.5rem);
		font-weight: 600;
	}
	.meaning {
		font-size: 1.5rem;
		font-weight: 700;
	}
	.back {
		width: 100%;
		max-width: 440px;
	}
	.back :global(.wrong) {
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--danger) 50%, transparent),
			var(--glass-shadow);
	}
	.wq :global(.answer) {
		width: 100%;
	}
	.verdict {
		margin: 0 0 var(--space-1h);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
		width: 100%;
		max-width: 440px;
	}
	.choices :global(.choice) {
		min-height: 56px;
		font-size: 1.0625rem;
		font-weight: 600;
		text-align: center;
		padding: var(--space-2) var(--space-4);
	}
</style>
