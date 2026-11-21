<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { PageDots } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Navigation/PageDots',
		component: PageDots,
		args: { count: 4, index: 1, label: 'Intro pages', pageLabel: (n: number) => `Page ${n}` }
	});
</script>

<Story name="Playground" />
<Story name="Many pages" args={{ count: 8, index: 5 }} />
