<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ProgressRing } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/ProgressRing',
		component: ProgressRing,
		args: { value: 0.65, size: 120, width: 12 },
		argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } }
	});
</script>

<Story name="Playground">
	{#snippet template(args)}<ProgressRing {...args}><b>{Math.round(args.value * 20)}</b></ProgressRing>{/snippet}
</Story>
<Story name="Progress colours" asChild>
	<div class="row" style:--gap="var(--space-4)">
		{#each [0.1, 0.4, 0.7, 1] as v (v)}<ProgressRing value={v} size={88} width={9}><b>{Math.round(v * 100)}%</b></ProgressRing>{/each}
	</div>
</Story>
