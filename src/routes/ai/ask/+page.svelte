<!-- 💬 Ask AI: a Japanese tutor chat. Conversation is kept on this device. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import * as api from '#lib/ai/client.ts';
	import type { AskResponse, AskTurn } from '#lib/ai/contract.ts';
	import { get, put } from '#lib/db/idb.ts';
	import { speak } from '#lib/content/kana.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 265;
	interface Msg {
		role: 'user' | 'assistant';
		text: string;
		reply?: AskResponse;
	}
	const STARTERS = ['What’s the difference between は and が?', 'How do I say “I don’t understand” politely?', 'When do I use です and ます?', 'Why is を read “o”?'];
	let msgs = $state<Msg[]>([]);
	let input = $state('');
	let busy = $state(false);
	let list: HTMLDivElement | undefined = $state();

	onMount(async () => {
		msgs = (await get<Msg[]>('meta', 'askThread')) ?? [];
		await scrollDown();
	});
	async function scrollDown() {
		await tick();
		list?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}
	const save = () => put('meta', $state.snapshot(msgs), 'askThread');

	async function send(text = input) {
		const q = text.trim();
		if (!q || busy) return;
		input = '';
		msgs = [...msgs, { role: 'user', text: q }];
		busy = true;
		await scrollDown();
		try {
			const turns: AskTurn[] = msgs.slice(-12).map((m) => ({ role: m.role, text: m.text }));
			const r = await api.ask({ turns, knownKana: [...progress.knownKana], secondLang: progress.settings.secondLang });
			msgs = [...msgs, { role: 'assistant', text: r.answer, reply: r }];
			haptic('selection');
		} catch (e) {
			msgs = msgs.slice(0, -1);
			input = q;
			toast(e instanceof Error ? e.message : 'Couldn’t get an answer', '⚠️', 2800);
		} finally {
			busy = false;
			await save();
			await scrollDown();
		}
	}
	async function clear() {
		if (!(await confirmDestructive('Clear this chat?', 'The conversation on this device will be deleted.', 'Clear Chat'))) return;
		msgs = [];
		await save();
	}
</script>

<main class="chat">
	<header class="top">
		<button class="icon-btn" aria-label="Back" onclick={() => goto('/ai')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<h1 class="title-2">Ask AI</h1>
		<span class="spacer"></span>
		{#if msgs.length}<button class="btn ghost small" onclick={clear}>Clear</button>{/if}
	</header>

	<div class="msgs" bind:this={list} aria-live="polite">
		{#if !msgs.length}
			<div class="empty">
				<p class="subhead">Ask anything about Japanese. Answers adapt to the kana you know{progress.settings.secondLang ? ' and include your second language' : ''}.</p>
				{#each STARTERS as s}<button class="chip" onclick={() => send(s)}>{s}</button>{/each}
			</div>
		{/if}
		{#each msgs as m, i (i)}
			<div class="bubble {m.role}" in:fly={{ y: 12, duration: 250 }}>
				<p class="text">{m.text}</p>
				{#if m.reply?.answer2}<p class="text second">{m.reply.answer2}</p>{/if}
				{#if m.reply?.examples.length}
					<div class="examples">
						{#each m.reply.examples as ex}
							<button class="ex" onclick={() => speak(ex.reading)}>
								<span class="jp">{ex.jp}</span>
								<Romaji text={ex.reading} />
								<span class="caption">{ex.en}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		{#if busy}<div class="bubble assistant typing" aria-label="Thinking">●●●</div>{/if}
	</div>

	<form class="composer glass glass-strong" onsubmit={(e) => (e.preventDefault(), send())}>
		<input type="text" bind:value={input} placeholder={ai.available ? 'Ask about Japanese…' : ai.reason} aria-label="Your question" enterkeyhint="send" autocomplete="off" disabled={!ai.available} />
		<button class="btn accent small" disabled={busy || !input.trim() || !ai.available} aria-label="Send">↑</button>
	</form>
</main>

<style>
	.chat {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + var(--kb) + 96px) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.msgs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.chip {
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		border-radius: 18px;
		padding: 10px 14px;
		text-align: left;
		cursor: pointer;
	}
	.bubble {
		max-width: 88%;
		padding: 10px 14px;
		border-radius: 20px;
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
		margin-top: 8px;
		color: var(--ink-2);
	}
	.examples {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 10px;
	}
	.ex {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		text-align: left;
		padding: 8px 10px;
		border-radius: 12px;
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		cursor: pointer;
	}
	.ex .jp {
		font-size: 1.0625rem;
	}
	.typing {
		letter-spacing: 3px;
		color: var(--ink-3);
		animation: pop 1.2s ease-in-out infinite;
	}
	.composer {
		position: fixed;
		z-index: 30;
		left: calc(var(--safe-left) + 12px);
		right: calc(var(--safe-right) + 12px);
		bottom: calc(var(--safe-bottom) + var(--kb) + 12px);
		max-width: 736px;
		margin: 0 auto;
		display: flex;
		gap: 8px;
		padding: 6px;
		border-radius: 999px;
	}
	.composer input {
		flex: 1;
		min-width: 0;
		height: 44px;
		min-height: 44px;
		border: 0;
		background: transparent;
		border-radius: 999px;
	}
	.composer .btn {
		width: 44px;
		height: 44px;
		padding: 0;
		font-size: 1.25rem;
	}
</style>
