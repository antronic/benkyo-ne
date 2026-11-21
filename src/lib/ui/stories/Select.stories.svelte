<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Select } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Select',
		component: Select,
		args: {
			label: 'Tab bar',
			value: 'auto',
			disabled: false,
			block: false,
			size: 'md',
			options: [
				{ value: 'auto', label: 'Automatic' },
				{ value: 'bottom', label: 'Bottom' },
				{ value: 'side', label: 'Side rail' }
			]
		},
		argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } }
	});
</script>

<Story name="Playground" />
<Story
	name="Groups"
	args={{
		label: 'Model',
		value: 'sonnet',
		block: true,
		options: [
			{ value: 'haiku', label: 'Haiku', group: 'Anthropic' },
			{ value: 'sonnet', label: 'Sonnet', group: 'Anthropic' },
			{ value: 'mini', label: 'Mini', group: 'OpenAI' },
			{ value: 'old', label: 'Retired model', group: 'OpenAI', disabled: true }
		]
	}}
/>
<Story name="Disabled" args={{ disabled: true }} />
