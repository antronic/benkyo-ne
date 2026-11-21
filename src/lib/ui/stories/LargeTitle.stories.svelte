<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { IconButton, LargeTitle } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/LargeTitle',
		component: LargeTitle,
		args: { title: 'Today', jp: false }
	});
</script>

<Story name="Playground" />
<Story name="Japanese" args={{ title: '勉強ね', jp: true }} />
<Story name="With trailing" asChild>
	<LargeTitle title="Words">{#snippet trailing()}<IconButton label="Add a word">＋</IconButton>{/snippet}</LargeTitle>
</Story>
