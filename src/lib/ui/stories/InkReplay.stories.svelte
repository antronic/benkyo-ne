<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { InkReplay, sampleInk } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/InkReplay',
		component: InkReplay,
		args: { ink: sampleInk(), label: 'Handwritten note', delay: 0, replay: 0 },
		argTypes: { replay: { control: { type: 'number' }, description: 'Change it to play again' } }
	});
</script>

<Story name="Playground" />
