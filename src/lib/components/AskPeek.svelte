<!--
	Ask AI about one word, as a peek over what you were looking at (a Words card, a word in a pack).
	A peek Sheet: the chat scrolls in the middle, the composer stays at the bottom, drag up for full
	height. Each open starts a new chat about the word; it is saved to Ask AI history with the
	first question, and "Open in Ask AI" continues it on the full screen.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { gloss } from '#lib/i18n/content.ts';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button, Card, Chip, FieldRow, IconButton, Sheet, TextArea } from '#lib/ui/index.ts';
	import AskMessages from './AskMessages.svelte';
	import type { AskFocus } from '#lib/ai/contract.ts';
	import { parseAskText } from '#lib/ai/askStream.ts';
	import { answerLast } from '#lib/ai/askSend.ts';
	import { focusStarters } from '#lib/ai/focusStarters.ts';
	import { focusHref, newId, saveThread, setCurrent, type AskThread } from '#lib/ai/threads.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { kuriSound } from '#lib/companion/kuri.svelte.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	let { focus, back, onclose }: { focus: AskFocus | null; back: string; onclose: () => void } = $props();

	let thread = $state<AskThread | null>(null);
	let input = $state('');
	let busy = $state(false);
	/** raw text of the reply being written, or null */
	let live = $state<string | null>(null);
	const liveParts = $derived(live === null ? null : parseAskText(live, true));
	let stopper: AbortController | null = null;
	let body: HTMLDivElement | undefined = $state();
	const msgs = $derived(thread?.msgs ?? []);

	// A new chat each time the peek opens on a word; closing stops a reply that is still coming.
	$effect(() => {
		if (focus) {
			const now = Date.now();
			thread = { id: newId(), title: focus.word, createdAt: now, updatedAt: now, msgs: [], focus };
			input = '';
		}
		return () => stopper?.abort();
	});

	async function toEnd(smooth = true) {
		await tick();
		body?.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
	}

	async function send(text = input) {
		const q = text.trim();
		if (!q || busy || !thread) return;
		if (!ai.available) {
			toast(ai.reason || t('ask.failed'), '✨', 2800);
			return;
		}
		input = '';
		const th = thread;
		th.msgs.push({ role: 'user', text: q });
		busy = true;
		kuriSound('thinking');
		live = '';
		await toEnd();
		stopper = new AbortController();
		let first = true;
		try {
			const r = await answerLast(
				th,
				{ knownKana: [...progress.knownKana], secondLang: progress.settings.secondLang },
				(chunk) => {
					if (first) haptic('selection');
					first = false;
					live = (live ?? '') + chunk;
					if (body && body.scrollHeight - body.scrollTop - body.clientHeight < 160) body.scrollTop = body.scrollHeight;
				},
				stopper.signal
			);
			if (!r.ok) {
				if (!r.kept) input = q;
				if (!r.stopped) toast(r.message ?? t(r.kept ? 'ask.stoppedEarly' : 'ask.failed'), '⚠️', 2800);
			}
		} finally {
			live = null;
			busy = false;
			stopper = null;
			if (th.msgs.length) {
				const saved = await saveThread($state.snapshot(th) as AskThread);
				if (thread?.id === saved.id) thread.title = saved.title;
			}
			await toEnd();
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
	/** Continue on the full Ask AI screen: this chat once it has a question, else a new one about the word. */
	async function openFull() {
		if (!focus) return;
		if (busy) stop();
		if (thread?.msgs.length) {
			await setCurrent(thread.id); // ui-ok: instant local IndexedDB write before navigating
			await goto('/ai/ask');
		} else await goto(focusHref(focus, back));
	}
</script>

<Sheet peek open={!!focus} label={t('ask.title')} {onclose} bind:body>
	{#snippet header()}
		<div class="head">
			<h2 class="title-3">💬 {t('ask.title')}</h2>
			<span class="spacer"></span>
			<Button variant="ghost" size="sm" onclick={openFull}>{t('ask.openFull')}</Button>
		</div>
	{/snippet}
	{#if focus}
		<Card padding="sm" class="peek-focus" aria-label={t('ask.focusLabel')}>
			<span class="focus-word title-3"><span class="jp">{focus.word}</span>{#if focus.reading}<span class="jp caption">{focus.reading}</span>{/if}</span>
			<span class="caption">{gloss(focus.meaning)}</span>
		</Card>
		{#if !msgs.length}
			<div class="empty">
				<p class="subhead">{ai.available ? t('ask.focusIntro') : ai.reason || t('ask.focusIntro')}</p>
				{#each focusStarters(focus) as s}<Chip onclick={() => send(s)} disabled={!ai.available}>{s}</Chip>{/each}
			</div>
		{/if}
		<div class="msgs" aria-live="polite" aria-busy={busy}>
			<AskMessages {msgs} {liveParts} {busy} key={thread?.id ?? 'new'} />
		</div>
	{/if}
	{#snippet footer()}
		<FieldRow as="form" size="md" onsubmit={() => send()}>
			<TextArea
				grow
				autogrow
				rows={1}
				maxRows={4}
				class="peek-field"
				bind:value={input}
				placeholder={ai.available && focus ? t('ask.focusPlaceholder', { word: focus.word }) : ai.reason}
				aria-label={t('ask.question')}
				enterkeyhint="send"
				autocomplete="off"
				onkeydown={composerKey}
				disabled={!ai.available}
			/>
			{#if busy}
				<Button onclick={stop} aria-label={t('placement.stop')}>■</Button>
			{:else}
				<Button type="submit" variant="accent" disabled={!input.trim() || !ai.available} aria-label={t('ask.send')}>↑</Button>
			{/if}
		</FieldRow>
	{/snippet}
</Sheet>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
	}
	.head h2 {
		margin: 0;
	}
	.spacer {
		flex: 1;
	}
	:global(.peek-focus) {
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
	.empty p {
		margin: 0;
	}
	:global(.peek-field textarea) {
		resize: none;
	}
	.msgs {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
