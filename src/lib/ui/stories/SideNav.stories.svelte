<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Card, SideNav } from '#lib/ui/index.ts';

	const ITEMS = [
		{ href: '#nav-overview', label: 'Overview', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' },
		{ href: '#nav-accounts', label: 'Accounts', group: 'People', note: '128', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0' },
		{ href: '#nav-packages', label: 'Packages', group: 'Plans', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
		{ href: '#nav-audit', label: 'Audit log', group: 'Platform', icon: 'M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' }
	];

	const { Story } = defineMeta({
		title: 'Navigation/SideNav',
		component: SideNav,
		args: { label: 'Example sections', current: '#nav-accounts', items: ITEMS }
	});
</script>

<Story name="Playground">
	{#snippet template(args)}<Card padding="sm" style="max-width: 260px"><SideNav {...args} /></Card>{/snippet}
</Story>
