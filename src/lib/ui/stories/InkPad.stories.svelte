<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { InkPad, sampleInk } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/InkPad',
		component: InkPad,
		args: { label: 'Handwriting', placeholder: 'Write or draw here' }
	});
</script>

<Story name="Empty" />
<Story name="With ink" args={{ value: sampleInk() }} />
