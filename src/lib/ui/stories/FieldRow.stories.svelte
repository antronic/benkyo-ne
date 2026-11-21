<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button, FieldRow, Select, TextField } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/FieldRow',
		component: FieldRow,
		args: { size: 'md', stack: 'never' },
		argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] }, stack: { control: 'inline-radio', options: ['never', 'narrow'] } }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}
		<FieldRow {...args}>
			<TextField grow aria-label="Promo code" placeholder="Promo code" />
			<Button>Redeem</Button>
		</FieldRow>
	{/snippet}
</Story>

<Story name="Field, select and button" asChild>
	<FieldRow stack="narrow">
		<TextField grow aria-label="Model id" placeholder="claude-…" />
		<Select label="Provider" value="anthropic" options={[{ value: 'anthropic', label: 'Anthropic' }, { value: 'openai', label: 'OpenAI' }]} />
		<Button>Add</Button>
	</FieldRow>
</Story>

<Story name="Sizes" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		{#each ['sm', 'md', 'lg'] as const as size (size)}
			<FieldRow {size}>
				<TextField grow aria-label="Search {size}" placeholder="Search ({size})" />
				<Button variant="ghost">Go</Button>
			</FieldRow>
		{/each}
	</div>
</Story>
