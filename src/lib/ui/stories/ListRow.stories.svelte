<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Badge, ListGroup, ListRow, Switch } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/ListRow',
		component: ListRow,
		args: { title: 'Kana', subtitle: '46 hiragana, 46 katakana', chevron: true, tone: 'default', selected: false, disabled: false, href: '#kana' },
		argTypes: { tone: { control: 'inline-radio', options: ['default', 'danger', 'link'] } }
	});
</script>

<Story name="Playground">
	{#snippet template(args)}<ListGroup><ListRow {...args} /></ListGroup>{/snippet}
</Story>

<Story name="Kinds" asChild>
	<ListGroup>
		<ListRow title="Plain row" />
		<ListRow title="With subtitle" subtitle="Second line" />
		<ListRow title="Link with chevron" href="#a" chevron />
		<ListRow title="Leading and trailing">
			{#snippet leading()}<span aria-hidden="true">📗</span>{/snippet}
			{#snippet trailing()}<Badge tone="success">Done</Badge>{/snippet}
		</ListRow>
		<ListRow title="With a switch">{#snippet trailing()}<Switch label="Toggle" checked />{/snippet}</ListRow>
		<ListRow title="Selected choice" selected onclick={() => {}} />
		<ListRow title="Link tone" tone="link" onclick={() => {}} />
		<ListRow title="Delete account" tone="danger" onclick={() => {}} />
		<ListRow title="Disabled" disabled onclick={() => {}} />
	</ListGroup>
</Story>
