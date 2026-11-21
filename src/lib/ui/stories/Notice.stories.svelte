<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button, Notice } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/Notice',
		component: Notice,
		args: { tone: 'info', title: 'Tip' },
		argTypes: { tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] } }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<Notice {...args}>Swipe from the left edge to go back.</Notice>{/snippet}
</Story>

<Story name="Tones" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Notice title="Tip">Swipe from the left edge to go back.</Notice>
		<Notice tone="success">All 186 cards synced.</Notice>
		<Notice tone="warning" title="12 reviews due">
			Clear them before new cards.
			{#snippet action()}<Button size="sm" variant="ghost">Review</Button>{/snippet}
		</Notice>
		<Notice tone="danger">Couldn't reach the server. Your progress is saved on this device.</Notice>
	</div>
</Story>
