<!-- 💬 Ask AI: a Japanese tutor chat. Conversation is kept on this device. -->
<script lang="ts">
	import { t, fmtDate, fmtTime, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly, slide } from 'svelte/transition';
	import * as api from '#lib/ai/client.ts';
	import type { AskFocus, AskTurn } from '#lib/ai/contract.ts';
	import { finishAskText, parseAskText } from '#lib/ai/askStream.ts';
	import {
		backFromUrl,
		focusFromUrl,
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
	import { Avatar, Button, Card, Chip, FieldRow, IconButton, ListGroup, Sheet, Skeleton, TextArea, TextField } from '#lib/ui/index.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import Kuri from '#lib/companion/Kuri.svelte';
	import { kuriSound } from '#lib/companion/kuri.svelte.ts';
	import { confirmDestructive, toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 265;
	let threads = $state<AskThread[]>([]);
	let current = $state<AskThread | null>(null);
	const msgs = $derived(current?.msgs ?? []);
	/** the word this chat is about (opened from Words → card → Ask AI) */
	const focus = $derived(current?.focus ?? null);
	const STARTERS = $derived(focus ? focusStarters(focus) : [t('ask.starter1'), t('ask.starter2'), t('ask.starter3'), t('ask.starter4')]);
	function focusStarters(f: AskFocus): string[] {
		const word = f.word;
		const hasKanji = /[\u4e00-\u9fff々]/.test(word);
		return [t('ask.focusStarter1', { word }), t('ask.focusStarter2', { word }), t('ask.focusStarter3', { word }), hasKanji ? t('ask.focusStarterKanji', { word }) : t('ask.focusStarter4', { word })];
	}
	let input = $state('');
	let busy = $state(false);
	/** raw text of the reply being written, or null */
	let live = $state<string | null>(null);
	const liveParts = $derived(live === null ? null : parseAskText(live, true));
	let stopper: AbortController | null = null;
	let list: HTMLDivElement | undefined = $state();
	/** false until the saved chats are read, so a word chat doesn't flash the general starters first */
	let loaded = $state(false);
	/** opened from a word card or a word pack: where Back returns to (null: the AI tab) */
	let backTo = $state<string | null>(null);

	let historyOpen = $state(false);
	let query = $state('');
	const found = $derived(searchThreads(threads, query));
	const sections = $derived.by(() => {
		const out: { name: string; rows: typeof found }[] = [];
		for (const r of found) {
			const name = sectionLabel(r.thread.updatedAt);
			if (out.at(-1)?.name !== name) out.push({ name, rows: [] });
			out.at(-1)!.rows.push(r);
		}
		return out;
	});

	/** the "More below" button (kit ScrollMore, in the root layout) floats above the composer, which grows with the text */
	let chatEl: HTMLElement | undefined = $state();
	$effect(() => {
		const composer = chatEl?.querySelector<HTMLElement>('.composer');
		if (!composer) return;
		const ro = new ResizeObserver(() => (ui.scrollClear = composer.offsetHeight + 12)); // the composer sits 12px above the safe area
		ro.observe(composer);
		return () => (ro.disconnect(), (ui.scrollClear = 0));
	});

	onMount(() => {
		void (async () => {
			threads = await loadThreads();
			const about = focusFromUrl(page.url);
			if (about) {
				// A new chat about this word; it is saved with the first question.
				const now = Date.now();
				current = { id: newId(), title: about.word, createdAt: now, updatedAt: now, msgs: [], focus: about };
				backTo = backFromUrl(page.url);
				history.replaceState(history.state, '', '/ai/ask'); // a reload opens this chat, not another new one
			} else {
				const id = await getCurrent();
				current = threads.find((t) => t.id === id) ?? null;
			}
			loaded = true;
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

	async function persist() { // ui-ok: instant local IndexedDB write
		if (current) {
			current.updatedAt = Date.now();
			current.title = titleFor(current.msgs, current.focus);
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
		kuriSound('thinking');
		live = '';
		await scrollDown();
		const turns: AskTurn[] = thread.msgs.slice(-12).map((m) => ({ role: m.role, text: m.text }));
		const req = { turns, knownKana: [...progress.knownKana], secondLang: progress.settings.secondLang, focus: thread.focus ?? null };
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
				if (!stopped) toast(e instanceof Error ? e.message : t('ask.stoppedEarly'), '⚠️', 2800);
			} else {
				thread.msgs.pop();
				input = q;
				if (!stopped) toast(e instanceof Error ? e.message : t('ask.failed'), '⚠️', 2800);
			}
		} finally {
			live = null;
			busy = false;
			stopper = null;
			if (current === thread || !current) await persist();
			else await saveThreads($state.snapshot(threads) as AskThread[]);
		}
	}
	/** Enter sends, Shift+Enter is a new line; never while an IME is composing (Japanese input). */
	function composerKey(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
		e.preventDefault();
		void send();
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
	async function remove(t: AskThread) { // ui-ok: instant local IndexedDB write
		threads = threads.filter((x) => x.id !== t.id);
		if (current?.id === t.id) current = null;
		await saveThreads($state.snapshot(threads) as AskThread[]);
		if (!current) await setCurrent(null);
		haptic('warning');
	}
	async function removeCurrent() {
		if (!current) return;
		if (!(await confirmDestructive(t('ask.deleteTitle'), t('ask.deleteBody'), t('ask.deleteConfirm')))) return;
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
	const when = (ms: number) =>
		sectionOf(ms) === 'Today' || sectionOf(ms) === 'Yesterday'
			? fmtTime(ms, { hour: 'numeric', minute: '2-digit' })
			: fmtDate(ms, { month: 'short', day: 'numeric' });
	const SECTION_KEYS: Record<string, MessageKey> = {
		Today: 'ask.today',
		Yesterday: 'ask.yesterday',
		'Previous 7 Days': 'ask.prev7',
		'Previous 30 Days': 'ask.prev30'
	};
	/** History section heading in the interface language (sectionOf gives the English one). */
	const sectionLabel = (ms: number) => {
		const s = sectionOf(ms);
		if (SECTION_KEYS[s]) return t(SECTION_KEYS[s]);
		const sameYear = new Date(ms).getFullYear() === new Date().getFullYear();
		return fmtDate(ms, { month: 'long', year: sameYear ? undefined : 'numeric' });
	};
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

<main class="chat" bind:this={chatEl}>
	<header class="top">
		<div class="top-row">
			<IconButton label={t('common.back')} onclick={() => goto(backTo ?? '/ai')}>
				<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</IconButton>
			{#if progress.settings.kuri}
				<span class="kuri-avatar" title={busy ? t('kuri.thinking') : t('kuri.name')}>
					<Kuri pose={busy ? 'thinking' : 'idle'} label={busy ? t('kuri.thinking') : t('kuri.name')} options={{ yaw: 0.3, pitch: 0.1, distance: 3.1, target: [0, 1.62, 0.25], fps: 30 }} />
				</span>
			{/if}
			<h1 class="title-2 head-title">{current && msgs.length ? current.title : t('ask.title')}</h1>
			<span class="spacer"></span>
			<IconButton label={t('ask.history')} onclick={() => ((historyOpen = true), haptic('selection'))}>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></svg>
				{#if threads.length}<span class="badge">{threads.length}</span>{/if}
			</IconButton>
			<IconButton label={t('ask.newChat')} onclick={newChat} disabled={!msgs.length && !busy && !focus}>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
			</IconButton>
		</div>
	</header>

	<div class="msgs" bind:this={list} aria-live="polite" aria-busy={busy}>
		{#if focus}
			<Card padding="sm" class="ask-focus" aria-label={t('ask.focusLabel')}>
				<span class="eyebrow">{t('ask.focusLabel')}</span>
				<span class="focus-word title-3"><span class="jp">{focus.word}</span>{#if focus.reading}<span class="jp caption">{focus.reading}</span>{/if}</span>
				<span class="caption">{gloss(focus.meaning)}</span>
			</Card>
		{/if}
		{#if !loaded}
			<Skeleton variant="line" count={3} label={t('common.loading')} />
		{:else if !msgs.length}
			<div class="empty">
				<p class="subhead">{focus ? t('ask.focusIntro') : progress.settings.secondLang ? t('ask.introSecond') : t('ask.intro')}</p>
				{#each STARTERS as s}<Chip onclick={() => send(s)}>{s}</Chip>{/each}
				{#if threads.length}
					<Button variant="plain" size="sm" onclick={() => (historyOpen = true)}>🕘 {t('ask.past', { n: threads.length })}</Button>
				{/if}
			</div>
		{/if}
		{#each msgs as m, i (current?.id + ':' + i)}
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
	</div>

	<Card strong padding="none" class="composer">
		<FieldRow as="form" size="md" onsubmit={() => send()}>
			<TextArea
				grow
				autogrow
				rows={1}
				maxRows={5}
				class="composer-field"
				bind:value={input}
				placeholder={ai.available ? (focus ? t('ask.focusPlaceholder', { word: focus.word }) : t('ask.placeholder')) : ai.reason}
				aria-label={t('ask.question')}
				enterkeyhint="send"
				autocomplete="off"
				onkeydown={composerKey}
				disabled={!ai.available}
			/>
			{#if busy}
				<Button class="composer-btn stop" onclick={stop} aria-label={t('placement.stop')}>
					<svg viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" /></svg>
				</Button>
			{:else}
				<Button type="submit" variant="accent" class="composer-btn" disabled={!input.trim() || !ai.available} aria-label={t('ask.send')}>↑</Button>
			{/if}
		</FieldRow>
	</Card>
</main>

<Sheet open={historyOpen} label={t('ask.history')} onclose={() => ((historyOpen = false), (openRow = null))}>
	{#snippet header()}
		<div class="hist-head">
			<h2 class="title-3">{t('ask.historyTitle')}</h2>
			<span class="spacer"></span>
			<Button variant="ghost" size="sm" onclick={newChat}>{t('ask.newChat')}</Button>
		</div>
	{/snippet}
	<TextField type="search" placeholder={t('ask.search')} bind:value={query} aria-label={t('ask.search')} />
	{#if !threads.length}
		<p class="caption empty-hist">{t('ask.noChats')}</p>
	{:else if !found.length}
		<p class="caption empty-hist">{t('ask.noMatch', { query })}</p>
	{/if}
	{#each sections as sec (sec.name)}
		<section>
			<h3 class="eyebrow sec-name">{sec.name}</h3>
			<ListGroup class="group">
				{#each sec.rows as { thread, snippet } (thread.id)}
					<div class="hist-row" class:reveal={openRow === thread.id || (swipeId === thread.id && swipeX < 0)} out:slide={{ duration: 220 }}>
						<Button variant="danger" class="del" onclick={() => ((openRow = null), remove(thread))} aria-label={t('ask.deleteAria', { title: thread.title })} tabindex={openRow === thread.id ? 0 : -1}>{t('common.delete')}</Button>
						<Card
							padding="none"
							class={['row-main', current?.id === thread.id && 'active', swipeId === thread.id && swipeX !== 0 && 'dragging'].filter(Boolean).join(' ')}
							style="transform: translateX({swipeId === thread.id ? swipeX : openRow === thread.id ? -88 : 0}px)"
							aria-current={current?.id === thread.id || undefined}
							onpointerdown={(e) => rowDown(e, thread.id)}
							onpointermove={rowMove}
							onpointerup={() => rowUp(thread)}
							onpointercancel={() => ((swipeId = null), (swipeX = 0))}
							onclick={() => rowClick(thread)}
						>
							<span class="row-top"><b class="row-title">{thread.title}</b><span class="caption">{when(thread.updatedAt)}</span></span>
							<span class="caption row-snip">{snippet}</span>
						</Card>
					</div>
				{/each}
			</ListGroup>
		</section>
	{/each}
	{#if current && msgs.length}
		<Button variant="ghost-danger" block onclick={() => ((historyOpen = false), removeCurrent())}>{t('ask.deleteCurrent')}</Button>
	{/if}
</Sheet>

<style>
	.chat {
		--chat-max: 760px; /* the column, gutters included */
		min-height: 100dvh;
		padding: 0 var(--gutter-r) calc(var(--safe-bottom) + var(--kb) + 96px) var(--gutter-l); /* ui-ok: 96px clears the fixed composer */
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	/* The top bar stays put while the conversation scrolls under it. It spans the whole width
	   (glass, hairline below) and its row lines up with the message column. While the iOS keyboard
	   pans the page, --vv-top (lib/ios/gestures.ts) keeps it at the top of what is visible. */
	.top {
		position: sticky;
		top: var(--vv-top, 0px);
		z-index: 30;
		margin-inline: calc(-1 * var(--gutter-l)) calc(-1 * var(--gutter-r));
		padding: calc(var(--safe-top) + var(--space-2)) var(--gutter-r) var(--space-2) var(--gutter-l);
		background: var(--glass-strong);
		-webkit-backdrop-filter: blur(28px) saturate(180%);
		backdrop-filter: blur(28px) saturate(180%);
		border-bottom: 0.5px solid var(--glass-edge);
	}
	@media (prefers-reduced-transparency: reduce) {
		.top {
			background: var(--bg-2);
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
		}
	}
	.top-row,
	.msgs {
		width: 100%;
		max-width: calc(var(--chat-max) - var(--gutter-l) - var(--gutter-r));
		margin-inline: auto;
	}
	.top-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.msgs {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	:global(.ask-focus) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.focus-word {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
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
	.chat :global(.composer) {
		position: fixed;
		z-index: 30;
		left: calc(var(--safe-left) + 12px);
		right: calc(var(--safe-right) + 12px);
		bottom: calc(var(--safe-bottom) + var(--kb) + 12px);
		max-width: 736px;
		margin: 0 auto;
		padding: var(--space-1h);
		/* half the one-line height: a pill on one line, a rounded box when it grows */
		border-radius: 28px;
	}
	/* One line of text is exactly the send button's height (44px), so the two sit level. */
	.chat :global(.composer-field textarea) {
		padding: calc(var(--space-2) + var(--space-px)) var(--space-4);
		border: 0;
		background: transparent;
		resize: none;
		border-radius: 22px;
	}
	.chat :global(.composer-field textarea:focus) {
		box-shadow: none;
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
	.top :global(.icon-btn) {
		position: relative;
		flex: none;
	}
	.top :global(.icon-btn:disabled) {
		opacity: 0.35;
	}
	.badge {
		position: absolute;
		top: -3px;
		right: -3px;
		min-width: 17px;
		height: 17px;
		padding: 0 var(--space-1);
		border-radius: 9px;
		background: var(--accent);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 17px;
		text-align: center;
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
	.chat :global(.composer-btn.stop) {
		background: var(--ink);
		color: var(--bg);
	}
	.hist-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-px) var(--space-1h);
	}
	.hist-head h2 {
		margin: 0;
	}
	.empty-hist {
		text-align: center;
		padding: var(--space-6) var(--space-3);
	}
	.sec-name {
		margin: var(--space-1h) var(--space-1h) var(--space-1h);
	}
	section :global(.group) {
		padding: 0;
		border-radius: var(--r-m);
	}
	.hist-row {
		position: relative;
		overflow: hidden;
	}
	.hist-row + .hist-row {
		border-top: 0.5px solid var(--hairline);
	}
	.hist-row :global(.del) {
		position: absolute;
		inset: 0 0 0 auto;
		width: 88px;
		min-height: 0;
		padding: 0;
		border-radius: 0;
		font-size: inherit;
		visibility: hidden;
	}
	.hist-row.reveal :global(.del) {
		visibility: visible;
	}
	.hist-row :global(.row-main) {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		width: 100%;
		text-align: left;
		padding: var(--space-3) var(--space-4);
		border: 0;
		border-radius: 0;
		background: linear-gradient(var(--glass-strong), var(--glass-strong)), var(--bg);
		touch-action: pan-y;
		transition: transform 380ms var(--spring);
	}
	.hist-row :global(.row-main.dragging) {
		transition: none;
	}
	.hist-row :global(.row-main.active) {
		box-shadow: inset 3px 0 0 var(--accent-2);
	}
	.row-top {
		display: flex;
		gap: var(--space-2);
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
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
	}
	.chat :global(.composer-btn) {
		width: 44px;
		min-height: 44px;
		padding: 0;
		font-size: 1.25rem;
	}
</style>
