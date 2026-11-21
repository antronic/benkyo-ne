<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { SetupCard } from '#lib/ui/index.ts';

	const items = [
		{ id: 'avatar', icon: '🙂', title: 'Make your avatar', body: 'It shows next to your name.', action: 'Make', onclick: () => {} },
		{ id: 'install', icon: '📲', title: 'Install the app', body: 'Opens full screen and works offline.', action: 'Install', onclick: () => {} },
		{ id: 'plan', icon: '🎯', title: 'Pick your daily goal', done: true }
	];

	const { Story } = defineMeta({
		title: 'Content/SetupCard',
		component: SetupCard,
		args: { title: 'Set up Benkyo', count: '1 of 3 done', items, ondismiss: () => {} }
	});
</script>

<Story name="Playground" />

<Story name="Busy step" args={{ items: [{ ...items[1], busy: true }, items[0]], count: '0 of 2 done' }} />
