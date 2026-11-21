<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { PolitenessMeter } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/PolitenessMeter',
		component: PolitenessMeter,
		args: { value: 0.22, target: 0.78, targetLabel: 'Right for a boss' },
		argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.01 } }, target: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } }
	});
</script>

<Story name="Too casual" />
<Story name="Fixed" args={{ value: 0.8 }} />
<Story name="No target" args={{ target: undefined, value: 0.5 }} />
