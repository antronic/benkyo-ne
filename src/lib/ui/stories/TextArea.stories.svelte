<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TextArea } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/TextArea',
		component: TextArea,
		parameters: { controls: { include: ['label', 'value', 'placeholder', 'hint', 'error', 'rows', 'autogrow', 'maxRows', 'jp', 'disabled'] } },
		args: { label: 'Note', value: 'Think tabe-ru = table.\nPast: 食べた, not 食べった.', hint: '', error: '', rows: 3, autogrow: false, jp: false, disabled: false }
	});
</script>

<Story name="Playground" />
<Story name="Autogrow" args={{ autogrow: true, rows: 1, maxRows: 6, value: '', placeholder: 'Ask about 食べる…', label: 'Question' }} />
<Story name="Error" args={{ error: 'Notes can be up to 2,000 characters.' }} />
