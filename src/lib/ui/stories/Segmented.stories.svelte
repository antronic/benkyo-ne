<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Segmented } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Segmented',
		component: Segmented,
		args: {
			label: 'Quiz mode',
			value: 'read',
			options: [
				{ value: 'read', label: 'Read' },
				{ value: 'write', label: 'Write' },
				{ value: 'listen', label: 'Listen' }
			]
		}
	});
</script>

<Story name="Playground" />
<Story
	name="Two options, one disabled"
	args={{ label: 'Navigation', value: 'bottom', options: [{ value: 'bottom', label: 'Bottom bar' }, { value: 'side', label: 'Side rail', disabled: true }] }}
/>
<Story
	name="Japanese labels"
	args={{ label: 'Script', value: 'hira', options: [{ value: 'hira', label: 'ひらがな', lang: 'ja' }, { value: 'kata', label: 'カタカナ', lang: 'ja' }, { value: 'kanji', label: '漢字', lang: 'ja' }] }}
/>
