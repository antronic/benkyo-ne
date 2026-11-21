<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Checkbox } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Checkbox',
		component: Checkbox,
		args: { checked: false, disabled: false }
	});
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<Checkbox {...args}>I agree to share usage data</Checkbox>{/snippet}
</Story>

<Story name="States" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Checkbox>Unchecked</Checkbox>
		<Checkbox checked>Checked</Checkbox>
		<Checkbox disabled>Disabled</Checkbox>
		<Checkbox checked disabled>Checked and disabled</Checkbox>
	</div>
</Story>
