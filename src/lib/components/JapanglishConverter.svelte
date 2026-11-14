<!--
	"Make it Japanglish": type an English word → the real Japanese loanword
	(dictionary) + a rule-based katakana guess with the rules that apply.
-->
<script lang="ts">
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

	let input = $state('');
	let conv = $state<Conversion | null>(null);
	let real = $state<DictHit[]>([]);
	let looking = $state(false);
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
		await saveCandidates(
			[{ key: `${h.kind}:${h.id}`, text: h.text, reading: h.reading, written: h.written, kind: h.kind, gloss: h.gloss, verified: true, wordId: h.id, note: null }],
			{ tags: ['Japanglish', NOW_TAG], source: 'user' }
		);
		haptic('success');
		toast(`${h.reading} added`, '✓');
	}
</script>

<section class="conv glass sheen">
	<div class="eyebrow">🔁 Make it Japanglish</div>
	<input
		type="text"
		bind:value={input}
		oninput={onInput}
		placeholder="Type an English word, e.g. coffee, taxi, game"
		aria-label="English word"
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
						<button class="say" aria-label="Listen" onclick={() => speak(h.reading)}>🔊</button>
						<span class="stack" style:--gap="0">
							<span class="caption">Real Japanese ✓</span>
							<span class="jp big">{h.reading}</span>
							<Romaji text={h.reading} />
							<span class="caption">{h.gloss}</span>
						</span>
						<span class="spacer"></span>
						{#if words.cards[`${h.kind}:${h.id}`]}
							<span class="caption ok">✓ in cards</span>
						{:else}
							<button class="btn ghost small" onclick={() => add(h)}>＋ Card</button>
						{/if}
					</div>
				{/each}
			{:else if !looking}
				<p class="caption">No common loanword found in the dictionary; here’s how the rules would write it.</p>
			{/if}

			<div class="guess">
				<span class="caption">Rule-based guess {real.some((h) => h.reading === conv?.guess) ? '· matches ✓' : real.length ? '· differs: real words can be irregular' : ''}</span>
				<span class="jp mid">{conv.guess}</span>
			</div>
			{#if conv.steps.length}
				<ol class="steps">
					{#each conv.steps as s}
						<li><b>{s.rule.title}.</b> <span class="caption">{s.rule.explain}</span></li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}

	<details>
		<summary class="caption">All conversion rules ({RULES.length})</summary>
		<ul class="rules">
			{#each RULES as r}
				<li><b>{r.title}</b><span class="caption">{r.explain}</span><span class="jp ex">{r.example}</span></li>
			{/each}
		</ul>
	</details>
</section>

<style>
	.conv {
		padding: 14px;
		border-radius: var(--r-m);
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 10px;
	}
	input {
		height: 48px;
		min-height: 48px;
		font-size: 1rem;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.real {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--success) 10%, transparent);
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
		gap: 2px;
		padding: 0 4px;
	}
	.steps {
		margin: 0;
		padding-left: 22px;
		display: flex;
		flex-direction: column;
		gap: 4px;
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
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rules li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.9375rem;
	}
	.ex {
		color: var(--accent-2);
	}
</style>
