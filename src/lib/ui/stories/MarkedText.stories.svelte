<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MarkedText } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/MarkedText',
		component: MarkedText,
		args: {
			size: 'body',
			parts: [
				{ text: '明日の' },
				{ text: '定例会議', kind: 'mark' },
				{ text: 'ですが、資料を' },
				{ text: '見てください', kind: 'del' },
				{ text: 'ご確認いただけますと幸いです', kind: 'add' },
				{ text: '。' }
			]
		},
		argTypes: { size: { control: 'inline-radio', options: ['body', 'callout'] } }
	});
</script>

<Story name="Playground" />
<Story name="Callout" args={{ size: 'callout' }} />
