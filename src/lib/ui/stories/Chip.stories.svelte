<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Chip } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Chip',
		component: Chip,
		args: { selected: false, tone: 'default', disabled: false },
		argTypes: { tone: { control: 'inline-radio', options: ['default', 'accent'] } }
	});
</script>

<script lang="ts">
	let filter = $state('due');
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<Chip {...args} onclick={() => {}}>Due today</Chip>{/snippet}
</Story>

<Story name="Filter group" asChild>
	<div class="row wrap" style:--gap="var(--space-2)" role="group" aria-label="Filter">
		{#each [['due', 'Due', 12], ['new', 'New', 5], ['all', 'All', 186]] as const as [v, l, n] (v)}
			<Chip selected={filter === v} count={n} onclick={() => (filter = v)}>{l}</Chip>
		{/each}
	</div>
</Story>

<Story name="States" asChild>
	<div class="row wrap" style:--gap="var(--space-2)">
		<Chip>Default</Chip>
		<Chip selected>Selected</Chip>
		<Chip tone="accent">Accent</Chip>
		<Chip count={3}>With count</Chip>
		<Chip href="#chip">As a link</Chip>
		<Chip disabled>Disabled</Chip>
	</div>
</Story>
