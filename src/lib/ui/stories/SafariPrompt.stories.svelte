<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { SafariPrompt } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Feedback/SafariPrompt',
		component: SafariPrompt,
		args: { href: 'https://benkyo.jirachai.me/invite/VIP', app: 'LINE', browser: false, oncontinue: () => {} }
	});
</script>

<Story name="In an app's browser" />
<Story name="In another browser" args={{ href: 'https://benkyo.jirachai.me/', app: 'Chrome', browser: true }} />
<Story name="Unknown app" args={{ app: null }} />
