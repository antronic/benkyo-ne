<!--
	"Make it Japanglish": type an English word → the real Japanese loanword
	(dictionary) + a rule-based katakana guess with the rules that apply.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { c, gloss } from '#lib/i18n/content.ts';
	import { fly } from 'svelte/transition';
	import { japanglish, RULES, type Conversion } from '#lib/content/japanglish.ts';
	import { lookupEnglish, type DictHit } from '#lib/dict/dict.ts';
	import { speak } from '#lib/content/kana.ts';
	import { saveCandidates } from '#lib/words/maker.ts';
	import { NOW_TAG } from '#lib/content/courses.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import Romaji from './Romaji.svelte';
	import { Button, Card, IconButton, Spinner, TextField } from '#lib/ui/index.ts';

	let input = $state('');
	let conv = $state<Conversion | null>(null);
	let real = $state<DictHit[]>([]);
	let looking = $state(false);
	/** key of the card being saved */
	let adding = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout>;
	const KATA = /^[ァ-ヴー・]+$/;

	function onInput() {
		clearTimeout(timer);
		const q = input.trim();
		if (!/^[a-zA-Z][a-zA-Z\s'-]*$/.test(q)) {
			conv = null;
			real = [];
			return;
		}
		conv = japanglish(q);
		timer = setTimeout(async () => {
			looking = true;
			try {
				real = (await lookupEnglish(q, 20)).filter((h) => KATA.test(h.reading)).slice(0, 3);
			} finally {
				looking = false;
			}
		}, 250);
	}

	async function add(h: DictHit) {
		const key = `${h.kind}:${h.id}`;
		if (adding) return;
		adding = key;
		try {
			await saveCandidates(
				[{ key, text: h.text, reading: h.reading, written: h.written, kind: h.kind, gloss: h.gloss, verified: true, wordId: h.id, note: null }],
				{ tags: ['Japanglish', NOW_TAG], source: 'user' }
			);
		} finally {
			adding = null;
		}
		haptic('success');
		toast(t('jg.added', { text: h.reading }), '✓');
	}
</script>

<Card as="section" sheen class="jg-conv">
	<div class="eyebrow">🔁 {t('jg.title')}</div>
	<TextField
		size="lg"
		bind:value={input}
		oninput={onInput}
		placeholder={t('jg.placeholder')}
		aria-label={t('jg.englishWord')}
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck="false"
		enterkeyhint="done"
	/>

	{#if conv}
		<div class="results" in:fly={{ y: 8, duration: 250 }}>
			{#if real.length}
				{#each real as h (h.id)}
					<div class="real">
						<IconButton class="say" label={t('common.listen')} onclick={() => speak(h.reading)}>🔊</IconButton>
						<span class="stack" style:--gap="0">
							<span class="caption">{t('jg.real')}</span>
							<span class="jp big">{h.reading}</span>
							<Romaji text={h.reading} />
							<span class="caption">{gloss(h.gloss)}</span>
						</span>
						<span class="spacer"></span>
						{#if words.cards[`${h.kind}:${h.id}`]}
							<span class="caption ok">{t('jg.inCards')}</span>
						{:else}
							<Button variant="ghost" size="sm" busy={adding === `${h.kind}:${h.id}`} onclick={() => add(h)}>{t('jg.addCard')}</Button>
						{/if}
					</div>
				{/each}
			{:else if looking}
				<Spinner size="sm" label={t('maker.lookingUp')} showLabel />
			{:else}
				<p class="caption">{t('jg.noReal')}</p>
			{/if}

			<div class="guess">
				<span class="caption">{t('jg.guess')} {real.some((h) => h.reading === conv?.guess) ? t('jg.matches') : real.length ? t('jg.differs') : ''}</span>
				<span class="jp mid">{conv.guess}</span>
			</div>
			{#if conv.steps.length}
				<ol class="steps">
					{#each conv.steps as s}
						<li><b>{c(s.rule.title)}.</b> <span class="caption">{c(s.rule.explain)}</span></li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}

	<details>
		<summary class="caption">{t('jg.allRules', { n: RULES.length })}</summary>
		<ul class="rules">
			{#each RULES as r}
				<li><b>{c(r.title)}</b><span class="caption">{c(r.explain)}</span><span class="jp ex">{r.example}</span></li>
			{/each}
		</ul>
	</details>
</Card>

<style>
	:global(.glass.card.jg-conv) {
		border-radius: var(--r-m);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}
.results {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.real {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: 14px;
		background: color-mix(in srgb, var(--success) 10%, transparent);
	}
	.real :global(.say) {
		flex: none;
		width: 44px;
		height: 44px;
	}
	.big {
		font-size: 1.5rem;
		font-weight: 600;
	}
	.mid {
		font-size: 1.25rem;
	}
	.guess {
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		padding: 0 var(--space-1);
	}
	.steps {
		margin: 0;
		padding-left: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.9375rem;
	}
	.ok {
		color: var(--success);
	}
	summary {
		cursor: pointer;
		min-height: 32px;
	}
	.rules {
		list-style: none;
		margin: var(--space-1h) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.rules li {
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		font-size: 0.9375rem;
	}
	.ex {
		color: var(--accent-2);
	}
</style>
