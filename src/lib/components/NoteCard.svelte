<!--
	"My note" on a study item (docs/NOTES.md). Private to you; saved on this
	device as you type and synced to your account.

	  <NoteCard value={notes.text(subject)} loading={!notes.ready} onsave={(b) => notes.save(subject, label, b)} />

	`peek` shows only a "My note" button that opens the note read-only (Review,
	after you answer), and nothing at all when there is no note.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { NOTE_MAX } from '#lib/notes/contract.ts';
	import { Button, Card, Skeleton, TextArea } from '#lib/ui/index.ts';

	type Props = {
		value: string;
		onsave: (body: string) => Promise<unknown>;
		loading?: boolean;
		peek?: boolean;
		class?: string;
	};
	let { value, onsave, loading = false, peek = false, class: cls = '' }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let open = $state(false);
	let ref = $state<HTMLTextAreaElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	const left = $derived(NOTE_MAX - draft.length);

	function edit() {
		draft = value;
		saved = false;
		editing = true;
		queueMicrotask(() => ref?.focus());
	}

	async function flush() {
		clearTimeout(timer);
		timer = undefined;
		if (draft === value) return;
		saving = true;
		try {
			await onsave(draft);
			saved = true;
		} finally {
			saving = false;
		}
	}

	function typed() {
		saved = false;
		clearTimeout(timer);
		timer = setTimeout(() => void flush(), 700);
	}

	async function done() {
		await flush();
		editing = false;
	}

	onDestroy(() => {
		if (timer) void flush();
	});
</script>

{#if peek}
	{#if value.trim()}
		<div class="peek {cls}">
			<Button variant="ghost" size="sm" aria-expanded={open} onclick={() => (open = !open)}>📝 {t('notes.mine')}</Button>
			{#if open}
				<Card padding="sm" radius="control" class="note-peek"><p class="body">{value}</p></Card>
			{/if}
		</div>
	{/if}
{:else}
	<Card padding="md" class="note-card {cls}" aria-label={t('notes.mine')}>
		<div class="head">
			<span class="headline">{t('notes.mine')}</span>
			<span class="caption">🔒 {t('notes.private')}</span>
			{#if value.trim() && !editing && !loading}
				<span class="end"><Button variant="ghost" size="sm" onclick={edit}>{t('notes.edit')}</Button></span>
			{/if}
		</div>
		{#if loading}
			<Skeleton variant="line" count={2} label={t('notes.loading')} />
		{:else if editing}
			<TextArea
				bind:value={draft}
				bind:ref
				autogrow
				rows={3}
				maxRows={10}
				maxlength={NOTE_MAX}
				placeholder={t('notes.placeholder')}
				aria-label={t('notes.mine')}
				oninput={typed}
				onblur={() => void flush()}
			/>
			<div class="foot">
				<span class="caption" aria-live="polite">
					{#if saving}{t('notes.saving')}{:else if saved}✓ {t('notes.saved')}{:else if left < 200}{t('notes.left', { n: left })}{/if}
				</span>
				<span class="end"><Button size="sm" variant="ghost" busy={saving} onclick={done}>{t('notes.done')}</Button></span>
			</div>
		{:else if value.trim()}
			<p class="body">{value}</p>
		{:else}
			<div><Button variant="ghost" size="sm" onclick={edit}>＋ {t('notes.add')}</Button></div>
		{/if}
	</Card>
{/if}

<style>
	:global(.note-card) {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		text-align: left;
	}
	.head,
	.foot {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--control-sm);
	}
	.end {
		margin-left: auto;
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: var(--leading-normal);
	}
	.peek {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
	}
	.peek :global(.note-peek) {
		width: 100%;
		text-align: left;
	}
</style>
