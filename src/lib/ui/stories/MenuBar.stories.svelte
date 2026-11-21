<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MenuBar } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Navigation/MenuBar',
		component: MenuBar,
		args: {
			current: 'Accounts',
			label: 'Fleet menu',
			icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
			expanded: false,
			floating: false,
			onmenu: () => {}
		}
	});
</script>

<Story name="Playground" />
<Story name="Expanded" args={{ expanded: true }} />
<Story name="Floating" args={{ floating: true }} parameters={{ layout: 'fullscreen', docs: { story: { inline: false, height: '200px' } } }} />
