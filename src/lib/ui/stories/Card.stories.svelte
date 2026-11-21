<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Badge, Button, Card } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/Card',
		component: Card,
		parameters: { controls: { include: ['strong', 'sheen', 'padding', 'radius', 'as', 'href', 'selected', 'disabled'] } },
		args: { strong: false, sheen: false, padding: 'md', radius: 'card', selected: false, disabled: false },
		argTypes: {
			padding: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
			radius: { control: 'inline-radio', options: ['control', 'card', 'large', 'sheet'] }
		}
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}
		<Card {...args}>
			<div class="stack" style:--gap="var(--space-2)">
				<Badge tone="accent" variant="tag">Today</Badge>
				<span class="headline">12 reviews due</span>
				<span class="caption">About 4 minutes. Keep your 6-day streak.</span>
			</div>
		</Card>
	{/snippet}
</Story>

<Story name="Kinds" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Card>Default glass</Card>
		<Card strong>Strong glass</Card>
		<Card sheen>With sheen</Card>
		<Card onclick={() => {}}>Tappable card</Card>
		<Card href="#card" selected>Selected link card</Card>
		<Card onclick={() => {}} disabled>Disabled</Card>
		<Card padding="lg" radius="large">
			<div class="stack" style:--gap="var(--space-3)">
				<span class="title-3">Large radius, large padding</span>
				<Button>Start</Button>
			</div>
		</Card>
	</div>
</Story>
