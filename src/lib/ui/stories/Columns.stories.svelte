<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Columns, ListGroup, ListRow, SectionHeader } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/Columns',
		component: Columns,
		args: { min: '200px' },
		parameters: { docs: { description: { component: 'Side by side on a desktop, stacked on phones. Try the viewport toolbar.' } } }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}
		<Columns {...args}>
			<section>
				<SectionHeader title="Left" level={3} />
				<ListGroup><ListRow title="First column" /></ListGroup>
			</section>
			<section>
				<SectionHeader title="Right" level={3} />
				<ListGroup><ListRow title="Second column" /></ListGroup>
			</section>
		</Columns>
	{/snippet}
</Story>
