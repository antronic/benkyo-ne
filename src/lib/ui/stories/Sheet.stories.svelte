<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button, Card, Chip, FieldRow, Sheet, TextArea } from '#lib/ui/index.ts';

	const { Story } = defineMeta({ title: 'Content/Sheet', component: Sheet, parameters: { layout: 'fullscreen', docs: { story: { inline: false, height: '560px' } } } });
</script>

<script lang="ts">
	let open = $state(true);
	let peek = $state(true);
	let text = $state('');
</script>

<Story name="Sheet" asChild>
	<div style:padding="var(--space-4)"><Button onclick={() => (open = true)}>Open sheet</Button></div>
	<Sheet {open} label="Example sheet" onclose={() => (open = false)}>
		<div class="stack">
			<p>Sheets hold a short task. Drag down or tap outside to close.</p>
			<Button onclick={() => (open = false)}>Done</Button>
		</div>
	</Sheet>
</Story>

<Story name="Peek sheet" asChild>
	<div style:padding="var(--space-4)"><Button onclick={() => (peek = true)}>Open peek sheet</Button></div>
	<Sheet peek open={peek} label="Example peek sheet" onclose={() => (peek = false)}>
		{#snippet header()}<h2 class="title-3">💬 Ask AI</h2>{/snippet}
		<Card padding="sm"><span class="title-3 jp">食べる</span> <span class="caption">たべる · to eat</span></Card>
		<p class="subhead">The page behind stays in view. Drag up for more room.</p>
		{#each ['Show me 食べる in a few everyday sentences', 'Is 食べる casual or polite?'] as s (s)}<Chip onclick={() => (text = s)}>{s}</Chip>{/each}
		{#snippet footer()}
			<FieldRow as="form" size="md" onsubmit={() => (text = '')}>
				<TextArea grow autogrow rows={1} maxRows={4} bind:value={text} placeholder="Ask about 食べる…" aria-label="Example question" />
				<Button type="submit" variant="accent" aria-label="Send" disabled={!text.trim()}>↑</Button>
			</FieldRow>
		{/snippet}
	</Sheet>
</Story>
