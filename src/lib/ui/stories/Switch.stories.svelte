<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ListGroup, ListRow, Switch } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Switch',
		component: Switch,
		args: { checked: true, label: 'Haptics', disabled: false }
	});
</script>

<Story name="Playground" />

<Story name="In a list" asChild>
	<ListGroup>
		<ListRow title="Haptics">{#snippet trailing()}<Switch label="Haptics" checked />{/snippet}</ListRow>
		<ListRow title="Show romaji">{#snippet trailing()}<Switch label="Show romaji" />{/snippet}</ListRow>
		<ListRow title="Sync (signed out)">{#snippet trailing()}<Switch label="Sync" disabled />{/snippet}</ListRow>
	</ListGroup>
</Story>
