<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Badge } from '#lib/ui/index.ts';

	const TONES = ['neutral', 'accent', 'info', 'success', 'warning', 'danger', 'violet'] as const;

	const { Story } = defineMeta({
		title: 'Content/Badge',
		component: Badge,
		args: { tone: 'accent', variant: 'soft' },
		argTypes: { tone: { control: 'select', options: TONES }, variant: { control: 'inline-radio', options: ['soft', 'solid', 'tag'] } }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<Badge {...args}>N5</Badge>{/snippet}
</Story>

<Story name="All tones" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		{#each ['soft', 'solid', 'tag'] as const as variant (variant)}
			<div class="row wrap" style:--gap="var(--space-2)">
				{#each TONES as tone (tone)}<Badge {tone} {variant}>{tone}</Badge>{/each}
			</div>
		{/each}
	</div>
</Story>
