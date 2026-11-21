<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Stepper } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Stepper',
		component: Stepper,
		args: { value: 10, min: 0, max: 50, step: 5, label: 'New cards a day' }
	});
</script>

<Story name="Playground" />
<Story name="At the minimum" args={{ value: 0 }} />
<Story name="At the maximum" args={{ value: 50 }} />
