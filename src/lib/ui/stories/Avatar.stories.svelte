<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Avatar } from '#lib/ui/index.ts';
	import { DEFAULTS } from '#lib/avatar/person.ts';

	const { Story } = defineMeta({
		title: 'Avatar/Avatar',
		component: Avatar,
		args: { person: { ...DEFAULTS, hair: 'swept', skin: 's4' }, name: 'Example Learner', size: 72, live: false, wave: false }
	});
</script>

<Story name="Playground" />

<Story name="Sizes and fallback" asChild>
	<div class="row" style:--gap="var(--space-3)">
		<Avatar person={{ ...DEFAULTS, hair: 'bob' }} name="Example Learner" size={72} />
		<Avatar person={{ ...DEFAULTS, hair: 'curly' }} name="Example Learner" size={40} />
		<Avatar person={{ ...DEFAULTS, hair: 'bun' }} name="Example Learner" size={24} label="" />
		<Avatar person={null} name="Example Learner" size={40} />
	</div>
</Story>
