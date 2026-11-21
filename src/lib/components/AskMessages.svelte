<!-- Ask AI messages: your questions, Sensei's answers with tappable examples, and the reply being written. Used by /ai/ask and the Ask AI peek (AskPeek). -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { fly, slide } from 'svelte/transition';
	import { speak } from '#lib/content/kana.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { Avatar, Card } from '#lib/ui/index.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import type { AskMsg } from '#lib/ai/threads.ts';
	import type { AskParts } from '#lib/ai/askStream.ts';

	let { msgs, liveParts, busy, key }: { msgs: AskMsg[]; liveParts: AskParts | null; busy: boolean; key: string } = $props();
</script>

{#snippet answerBody(answer: string, answer2: string | null | undefined, examples: { jp: string; reading: string; en: string }[], streaming = false)}
	<p class="text">{answer}{#if streaming && !answer2}<span class="caret" aria-hidden="true"></span>{/if}</p>
	{#if answer2}<p class="text second">{answer2}{#if streaming}<span class="caret" aria-hidden="true"></span>{/if}</p>{/if}
	{#if examples.length}
		<div class="examples">
			{#each examples as ex (ex.jp + ex.reading)}
				<div in:slide|global={{ duration: 220 }}>
					<Card class="ex" padding="sm" radius="control" onclick={() => speak(ex.reading)}>
						<span class="jp">{ex.jp}</span>
						<Romaji text={ex.reading} />
						<span class="caption">{ex.en}</span>
					</Card>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#each msgs as m, i (key + ':' + i)}
	{#if m.role === 'assistant'}
		<div class="bubble assistant" in:fly={{ y: 12, duration: 250 }}>
			{@render answerBody(m.text, m.reply?.answer2, m.reply?.examples ?? [])}
			{#if m.partial}<p class="caption note">{t('ask.partial')}</p>{/if}
		</div>
	{:else}
		<div class="me" in:fly={{ y: 12, duration: 250 }}>
			<div class="bubble user"><p class="text">{m.text}</p></div>
			{#if ai.signedIn}<Avatar person={avatar.person} name={ai.account?.name ?? ''} size={28} label="" />{/if}
		</div>
	{/if}
{/each}
{#if busy && liveParts}
	{#if liveParts.answer}
		<div class="bubble assistant">{@render answerBody(liveParts.answer, liveParts.answer2, liveParts.examples, true)}</div>
	{:else}
		<div class="bubble assistant typing" role="status" aria-label={t('ask.thinking')}><span></span><span></span><span></span></div>
	{/if}
{/if}

<style>
	.bubble {
		max-width: 88%;
		padding: var(--space-3) var(--space-4);
		border-radius: 20px;
	}
	.me {
		align-self: flex-end;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		gap: var(--space-2);
		max-width: 88%;
	}
	.me .bubble {
		max-width: none;
	}
	.bubble.user {
		align-self: flex-end;
		background: var(--accent-2);
		color: #fff;
		border-bottom-right-radius: 6px;
	}
	.bubble.assistant {
		align-self: flex-start;
		background: var(--glass-strong);
		border: 0.5px solid var(--hairline);
		border-bottom-left-radius: 6px;
	}
	.text {
		margin: 0;
		white-space: pre-wrap;
		line-height: 1.45;
	}
	.second {
		margin-top: var(--space-2);
		color: var(--ink-2);
	}
	.examples {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
		margin-top: var(--space-3);
	}
	.examples :global(.ex) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		padding: var(--space-2) var(--space-3);
	}
	.examples .jp {
		font-size: 1.0625rem;
	}
	.typing {
		display: flex;
		gap: var(--space-1h);
		padding: var(--space-4) var(--space-4);
	}
	.typing span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink-3);
		animation: dot 1.1s ease-in-out infinite;
	}
	.typing span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.typing span:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes dot {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		30% {
			transform: translateY(-5px);
			opacity: 1;
		}
	}
	.caret {
		display: inline-block;
		width: 0.5em;
		height: 1.05em;
		margin-left: var(--space-px);
		vertical-align: -0.15em;
		border-radius: 2px;
		background: var(--accent-2);
		animation: blink 1s steps(2, start) infinite;
	}
	@keyframes blink {
		to {
			visibility: hidden;
		}
	}
	.note {
		margin: var(--space-1h) 0 0;
		font-style: italic;
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
	}
</style>
