<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { StatTile } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Data/StatTile',
		component: StatTile,
		args: { label: 'Read', value: 14, note: 'photos and messages', tone: 'default' },
		argTypes: { tone: { control: 'inline-radio', options: ['default', 'danger'] } }
	});
</script>

<Story name="Playground" />
<Story name="Row of tiles" asChild>
	<div class="row wrap" style:--gap="var(--space-3)">
		<StatTile label="Models listed" value={318} />
		<StatTile label="Active, 7 days" value={42} note="6 in the last 24 h" />
		<StatTile label="Failed, 24 h" value={3} tone="danger" />
	</div>
</Story>
