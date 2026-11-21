<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Spinner } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/Spinner',
		component: Spinner,
		args: { label: 'Loading', size: 'md', tone: 'accent', showLabel: false },
		argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'inline'] }, tone: { control: 'inline-radio', options: ['accent', 'current'] } }
	});
</script>

<Story name="Playground" />
<Story name="Sizes" asChild>
	<div class="row" style:--gap="var(--space-4)">
		<Spinner size="sm" label="Small" />
		<Spinner size="md" label="Medium" />
		<Spinner size="lg" label="Large" />
		<span>Inline <Spinner size="inline" label="Inline" /></span>
	</div>
</Story>
<Story name="With label" args={{ label: 'Checking your answer…', showLabel: true }} />
