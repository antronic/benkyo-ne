<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Slider } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Slider',
		component: Slider,
		args: { value: 0.9, min: 0.7, max: 0.97, step: 0.01, label: 'Target retention', disabled: false }
	});
</script>

<Story name="Playground" />
<Story name="Disabled" args={{ disabled: true }} />
