<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { StepBar } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/StepBar',
		component: StepBar,
		args: { steps: ['Casual', 'Polite', 'Keigo', 'Formal'], value: 1, label: 'Politeness' },
		argTypes: { value: { control: { type: 'range', min: 0, max: 3, step: 1 } } }
	});
</script>

<Story name="Playground" />
<Story name="Any level" args={{ value: null, tones: ['warning', 'success', 'info', 'violet'], anyLabel: 'Any level' }} />
<Story name="Toned" args={{ value: 2, tones: ['warning', 'success', 'info', 'violet'] }} />
