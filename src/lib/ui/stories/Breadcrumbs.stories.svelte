<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Breadcrumbs } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Navigation/Breadcrumbs',
		component: Breadcrumbs,
		args: { items: [{ label: 'Fleet', href: '#overview' }, { label: 'Accounts', href: '#accounts' }, { label: 'Example Learner' }] }
	});
</script>

<Story name="Playground" />
<Story name="Two levels" args={{ items: [{ label: 'Learn', href: '#learn' }, { label: 'Browse kanji' }] }} />
