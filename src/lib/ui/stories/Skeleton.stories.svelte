<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Skeleton } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/Skeleton',
		component: Skeleton,
		args: { variant: 'row', count: 3, label: 'Loading' },
		argTypes: { variant: { control: 'inline-radio', options: ['row', 'card', 'tile', 'line'] } }
	});
</script>

<Story name="Rows" />
<Story name="Card" args={{ variant: 'card', count: 1 }} />
<Story name="Tiles" args={{ variant: 'tile', count: 3 }} />
<Story name="Lines" args={{ variant: 'line', count: 2 }} />
