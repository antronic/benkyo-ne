<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ScrollMore } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/ScrollMore',
		component: ScrollMore,
		args: { demo: true, nav: false, clear: 0 },
		parameters: { docs: { description: { component: 'The “More below” pill. `demo` shows it in place; in the app it floats above the tab bar while there is more page below.' } } }
	});
</script>

<Story name="Demo" />
