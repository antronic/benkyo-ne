<!-- 💬 Ask AI: a Japanese tutor chat. Conversation is kept on this device. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly, slide } from 'svelte/transition';
	import * as api from '#lib/ai/client.ts';
	import type { AskTurn } from '#lib/ai/contract.ts';
	import { finishAskText, parseAskText } from '#lib/ai/askStream.ts';
	import {
		getCurrent,
		loadThreads,
		newId,
		saveThreads,
		searchThreads,
		sectionOf,
		setCurrent,
		titleFor,
		type AskMsg,
		type AskThread
	} from '#lib/ai/threads.ts';
	import { speak } from '#lib/content/kana.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import Kuri from '#lib/companion/Kuri.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 265;
	const STARTERS = ['What’s the difference between は and が?', 'How do I say “I don’t understand” politely?', 'When do I use です and ます?', 'Why is を read “o”?'];

	let threads = $state<AskThread[]>([]);
	let current = $state<AskThread | null>(null);
	const msgs = $derived(current?.msgs ?? []);
	let input = $state('');
	let busy = $state(false);
	/** raw text of the reply being written, or null */
	let live = $state<string | null>(null);
	const liveParts = $derived(live === null ? null : parseAskText(live, true));
	let stopper: AbortController | null = null;
	let list: HTMLDivElement | undefined = $state();

	let historyOpen = $state(false);
	let query = $state('');
	const found = $derived(searchThreads(threads, query));
	const sections = $derived.by(() => {
		const out: { name: string; rows: typeof found }[] = [];
		for (const r of found) {
			const name = sectionOf(r.thread.updatedAt);
			if (out.at(-1)?.name !== name) out.push({ name, rows: [] });
			out.at(-1)!.rows.push(r);
		}
		return out;
	});

	onMount(() => {
		void (async () => {
			threads = await loadThreads();
			const id = await getCurrent();
			current = threads.find((t) => t.id === id) ?? null;
			await scrollDown(false);
		})();
		return () => stopper?.abort();
	});

	async function scrollDown(smooth = true) {
		await tick();
		list?.lastElementChild?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' });
	}
	/** keep the newest text in view while it streams, unless the learner scrolled up */
	let pending = false;
	function follow() {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			const nearBottom = innerHeight + scrollY > document.documentElement.scrollHeight - 220;
			if (nearBottom) scrollTo({ top: document.documentElement.scrollHeight });
		});
	}

	async function persist() {
		if (current) {
			current.updatedAt = Date.now();
			current.title = titleFor(current.msgs);
			if (!threads.some((t) => t.id === current!.id)) threads = [current, ...threads];
		}
		threads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
		await saveThreads($state.snapshot(threads) as AskThread[]);
		await setCurrent(current?.id ?? null);
	}

	async function send(text = input) {
		const q = text.trim();
		if (!q || busy) return;
		input = '';
		if (!current) {
			const now = Date.now();
			current = { id: newId(), title: titleFor([{ role: 'user', text: q }]), createdAt: now, updatedAt: now, msgs: [] };
		}
		const thread = current;
		thread.msgs.push({ role: 'user', text: q });
		busy = true;
		live = '';
		await scrollDown();
		const turns: AskTurn[] = thread.msgs.slice(-12).map((m) => ({ role: m.role, text: m.text }));
		const req = { turns, knownKana: [...progress.knownKana], secondLang: progress.settings.secondLang };
		stopper = new AbortController();
		let first = true;
		try {
			const r = await api.askStream(
				req,
				(t) => {
					if (first) haptic('selection');
					first = false;
					live = (live ?? '') + t;
					follow();
				},
				stopper.signal
			);
			thread.msgs.push({ role: 'assistant', text: r.answer, reply: r });
		} catch (e) {
			const stopped = (e as Error)?.name === 'AbortError';
			const partial = live ? finishAskText(live, req) : null;
			if (partial) {
				// Keep what was written so far.
				thread.msgs.push({ role: 'assistant', text: partial.answer, reply: partial, partial: true });
				if (!stopped) toast(e instanceof Error ? e.message : 'The reply stopped early', '⚠️', 2800);
			} else {
				thread.msgs.pop();
				input = q;
				if (!stopped) toast(e instanceof Error ? e.message : 'Couldn’t get an answer', '⚠️', 2800);
			}
		} finally {
			live = null;
			busy = false;
			stopper = null;
			if (current === thread || !current) await persist();
			else await saveThreads($state.snapshot(threads) as AskThread[]);
		}
	}
	function stop() {
		stopper?.abort();
		haptic('selection');
	}

	function newChat() {
		if (busy) stop();
		current = null;
		historyOpen = false;
		void setCurrent(null);
		haptic('selection');
	}
	async function open(t: AskThread) {
		if (busy) stop();
		current = t;
		historyOpen = false;
		query = '';
		await setCurrent(t.id);
		await scrollDown(false);
	}
	async function remove(t: AskThread) {
		threads = threads.filter((x) => x.id !== t.id);
		if (current?.id === t.id) current = null;
		await saveThreads($state.snapshot(threads) as AskThread[]);
		if (!current) await setCurrent(null);
		haptic('warning');
	}
	async function removeCurrent() {
		if (!current) return;
		if (!(await confirmDestructive('Delete this chat?', 'The conversation on this device will be deleted.', 'Delete Chat'))) return;
		await remove(current);
	}

	// swipe left on a history row to reveal Delete; a long swipe deletes
	let swipeId = $state<string | null>(null);
	let swipeX = $state(0);
	let openRow = $state<string | null>(null);
	let sx = 0,
		sy = 0,
		swiping = false,
		moved = false;
	function rowDown(e: PointerEvent, id: string) {
		sx = e.clientX;
		sy = e.clientY;
		swipeId = id;
		swiping = false;
		moved = false;
		swipeX = openRow === id ? -88 : 0;
	}
	function rowMove(e: PointerEvent) {
		if (!swipeId) return;
		const dx = e.clientX - sx,
			dy = e.clientY - sy;
		if (!swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
			swiping = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		}
		if (!swiping) {
			if (Math.abs(dy) > 8) swipeId = null;
			return;
		}
		moved = true;
		const base = openRow === swipeId ? -88 : 0;
		swipeX = Math.min(0, base + dx);
	}
	function rowUp(t: AskThread) {
		if (!swipeId) return;
		const w = (document.querySelector('.hist-row')?.clientWidth ?? 320) * 0.6;
		if (swiping && -swipeX > w) {
			openRow = null;
			void remove(t);
		} else if (swiping) {
			openRow = -swipeX > 44 ? t.id : null;
			if (openRow) haptic('selection');
		}
		swipeId = null;
		swipeX = 0;
	}
	function rowClick(t: AskThread) {
		if (moved) return;
		if (openRow) {
			openRow = null;
			return;
		}
		void open(t);
	}
	const when = (t: number) => {
		const d = new Date(t);
		return sectionOf(t) === 'Today' || sectionOf(t) === 'Yesterday'
			? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
			: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	};
</script>

{#snippet answerBody(answer: string, answer2: string | null | undefined, examples: { jp: string; reading: string; en: string }[], streaming = false)}
	<p class="text">{answer}{#if streaming && !answer2}<span class="caret" aria-hidden="true"></span>{/if}</p>
	{#if answer2}<p class="text second">{answer2}{#if streaming}<span class="caret" aria-hidden="true"></span>{/if}</p>{/if}
	{#if examples.length}
		<div class="examples">
			{#each examples as ex (ex.jp + ex.reading)}
				<button class="ex" onclick={() => speak(ex.reading)} in:slide|global={{ duration: 220 }}>
					<span class="jp">{ex.jp}</span>
					<Romaji text={ex.reading} />
					<span class="caption">{ex.en}</span>
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

<main class="chat">
	<header class="top">
		<button class="icon-btn" aria-label="Back" onclick={() => goto('/ai')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		{#if progress.settings.kuri}
			<span class="kuri-avatar" title={busy ? t('kuri.thinking') : t('kuri.name')}>
				<Kuri pose={busy ? 'thinking' : 'idle'} label={busy ? t('kuri.thinking') : t('kuri.name')} options={{ yaw: 0.3, pitch: 0.1, distance: 3.1, target: [0, 1.62, 0.25], fps: 30 }} />
			</span>
		{/if}
		<h1 class="title-2 head-title">{current && msgs.length ? current.title : 'Ask AI'}</h1>
		<span class="spacer"></span>
		<button class="icon-btn" aria-label="Chat history" onclick={() => ((historyOpen = true), haptic('selection'))}>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></svg>
			{#if threads.length}<span class="badge">{threads.length}</span>{/if}
		</button>
		<button class="icon-btn" aria-label="New chat" onclick={newChat} disabled={!msgs.length && !busy}>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
		</button>
	</header>

	<div class="msgs" bind:this={list} aria-live="polite">
		{#if !msgs.length}
			<div class="empty">
				<p class="subhead">Ask anything about Japanese. Answers adapt to the kana you know{progress.settings.secondLang ? ' and include your second language' : ''}.</p>
				{#each STARTERS as s}<button class="chip" onclick={() => send(s)}>{s}</button>{/each}
				{#if threads.length}
					<button class="chip ghost-chip" onclick={() => (historyOpen = true)}>🕘 Past chats ({threads.length})</button>
				{/if}
			</div>
		{/if}
		{#each msgs as m, i (current?.id + ':' + i)}
			<div class="bubble {m.role}" in:fly={{ y: 12, duration: 250 }}>
				{#if m.role === 'assistant'}
					{@render answerBody(m.text, m.reply?.answer2, m.reply?.examples ?? [])}
					{#if m.partial}<p class="caption note">Reply stopped before it finished.</p>{/if}
				{:else}
					<p class="text">{m.text}</p>
				{/if}
			</div>
		{/each}
		{#if busy && liveParts}
			{#if liveParts.answer}
				<div class="bubble assistant">{@render answerBody(liveParts.answer, liveParts.answer2, liveParts.examples, true)}</div>
			{:else}
				<div class="bubble assistant typing" role="status" aria-label="Thinking"><span></span><span></span><span></span></div>
			{/if}
		{/if}
	</div>

	<form class="composer glass glass-strong" onsubmit={(e) => (e.preventDefault(), send())}>
		<input type="text" bind:value={input} placeholder={ai.available ? 'Ask about Japanese…' : ai.reason} aria-label="Your question" enterkeyhint="send" autocomplete="off" disabled={!ai.available} />
		{#if busy}
			<button type="button" class="btn small stop" onclick={stop} aria-label="Stop">
				<svg viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" /></svg>
			</button>
		{:else}
			<button class="btn accent small" disabled={!input.trim() || !ai.available} aria-label="Send">↑</button>
		{/if}
	</form>
</main>

<Sheet open={historyOpen} label="Chat history" onclose={() => ((historyOpen = false), (openRow = null))}>
	{#snippet header()}
		<div class="hist-head">
			<h2 class="title-3">History</h2>
			<span class="spacer"></span>
			<button class="btn ghost small" onclick={newChat}>New chat</button>
		</div>
	{/snippet}
	<input class="search" type="search" placeholder="Search chats" bind:value={query} aria-label="Search chats" />
	{#if !threads.length}
		<p class="caption empty-hist">No chats yet. Your conversations are saved here on this device.</p>
	{:else if !found.length}
		<p class="caption empty-hist">No chats match “{query}”.</p>
	{/if}
	{#each sections as sec (sec.name)}
		<section>
			<h3 class="eyebrow sec-name">{sec.name}</h3>
			<div class="glass group">
				{#each sec.rows as { thread, snippet } (thread.id)}
					<div class="hist-row" class:reveal={openRow === thread.id || (swipeId === thread.id && swipeX < 0)} out:slide={{ duration: 220 }}>
						<button class="del" onclick={() => ((openRow = null), remove(thread))} aria-label="Delete {thread.title}" tabindex={openRow === thread.id ? 0 : -1}>Delete</button>
						<button
							class="row-main"
							class:active={current?.id === thread.id}
							class:dragging={swipeId === thread.id && swipeX !== 0}
							style:transform="translateX({swipeId === thread.id ? swipeX : openRow === thread.id ? -88 : 0}px)"
							onpointerdown={(e) => rowDown(e, thread.id)}
							onpointermove={rowMove}
							onpointerup={() => rowUp(thread)}
							onpointercancel={() => ((swipeId = null), (swipeX = 0))}
							onclick={() => rowClick(thread)}
						>
							<span class="row-top"><b class="row-title">{thread.title}</b><span class="caption">{when(thread.updatedAt)}</span></span>
							<span class="caption row-snip">{snippet}</span>
						</button>
					</div>
				{/each}
			</div>
		</section>
	{/each}
	{#if current && msgs.length}
		<button class="btn ghost block danger" onclick={() => ((historyOpen = false), removeCurrent())}>Delete current chat</button>
	{/if}
</Sheet>

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
		display: flex;
		gap: 5px;
		padding: 14px 16px;
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
	.kuri-avatar {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--color-surface-strong);
		border: var(--hairline-w) solid var(--color-border);
	}
	.head-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
	}
	.top .icon-btn {
		position: relative;
		flex: none;
	}
	.top .icon-btn:disabled {
		opacity: 0.35;
	}
	.badge {
		position: absolute;
		top: -3px;
		right: -3px;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--accent);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 17px;
		text-align: center;
	}
	.ghost-chip {
		background: transparent;
		color: var(--accent-2);
	}
	.caret {
		display: inline-block;
		width: 0.5em;
		height: 1.05em;
		margin-left: 2px;
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
		margin: 6px 0 0;
		font-style: italic;
	}
	.stop {
		background: var(--ink);
		color: var(--bg);
	}
	.hist-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 2px 6px;
	}
	.hist-head h2 {
		margin: 0;
	}
	.search {
		width: 100%;
		height: 40px;
		min-height: 40px;
		border-radius: 12px;
		padding: 0 12px;
		border: 0.5px solid var(--hairline);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		flex: none;
	}
	.empty-hist {
		text-align: center;
		padding: 24px 12px;
	}
	.sec-name {
		margin: 6px 6px 6px;
	}
	.group {
		border-radius: var(--r-m);
		overflow: hidden;
	}
	.hist-row {
		position: relative;
		overflow: hidden;
	}
	.hist-row + .hist-row {
		border-top: 0.5px solid var(--hairline);
	}
	.del {
		position: absolute;
		inset: 0 0 0 auto;
		width: 88px;
		border: 0;
		background: var(--danger);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		visibility: hidden;
	}
	.hist-row.reveal .del {
		visibility: visible;
	}
	.row-main {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		text-align: left;
		padding: 11px 16px;
		border: 0;
		background: linear-gradient(var(--glass-strong), var(--glass-strong)), var(--bg);
		color: inherit;
		font: inherit;
		cursor: pointer;
		touch-action: pan-y;
		transition: transform 380ms var(--spring);
	}
	.row-main.dragging {
		transition: none;
	}
	.row-main.active {
		box-shadow: inset 3px 0 0 var(--accent-2);
	}
	.row-top {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.row-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.row-snip {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.danger {
		color: var(--danger);
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
	}
	.composer .btn {
		width: 44px;
		height: 44px;
		padding: 0;
		font-size: 1.25rem;
	}
</style>
