<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { IconButton } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/IconButton',
		component: IconButton,
		parameters: { controls: { include: ['label', 'size', 'disabled'] } },
		args: { label: 'Play audio', size: 'md', disabled: false },
		argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<IconButton {...args}>🔊</IconButton>{/snippet}
</Story>

<Story name="Sizes" asChild>
	<div class="row" style:--gap="var(--space-3)">
		<IconButton label="Small" size="sm">✕</IconButton>
		<IconButton label="Medium" size="md">⋯</IconButton>
		<IconButton label="Large" size="lg">🔊</IconButton>
		<IconButton label="Disabled" disabled>↻</IconButton>
	</div>
</Story>
