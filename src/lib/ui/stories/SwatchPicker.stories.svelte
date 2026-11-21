<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { SwatchPicker } from '#lib/ui/index.ts';
	import { SKIN, type Person } from '#lib/avatar/person.ts';

	const SKINS = (Object.keys(SKIN) as Person['skin'][]).map((k, i) => ({ value: k, color: SKIN[k], label: `Skin tone ${i + 1}` }));

	const { Story } = defineMeta({
		title: 'Avatar/SwatchPicker',
		component: SwatchPicker,
		args: { label: 'Skin', value: SKINS[3].value, options: SKINS }
	});
</script>

<Story name="Playground" />
