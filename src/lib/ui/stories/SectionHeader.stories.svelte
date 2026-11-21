<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button, SectionHeader } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/SectionHeader',
		component: SectionHeader,
		args: { title: 'Practice', level: 2 },
		argTypes: { level: { control: 'inline-radio', options: [2, 3] } }
	});
</script>

<Story name="Playground" />
<Story name="With trailing action" asChild>
	<SectionHeader title="Your words">{#snippet trailing()}<Button size="sm" variant="plain">See all</Button>{/snippet}</SectionHeader>
</Story>
<Story name="Level 3" args={{ level: 3, title: 'Second column' }} />
