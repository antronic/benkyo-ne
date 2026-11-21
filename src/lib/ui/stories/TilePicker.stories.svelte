<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TilePicker } from '#lib/ui/index.ts';
	import { avatarSvg } from '#lib/avatar/render.ts';
	import { DEFAULTS, type Person } from '#lib/avatar/person.ts';

	const HAIR: { value: Person['hair']; label: string }[] = [
		{ value: 'swept', label: 'Swept' },
		{ value: 'bob', label: 'Bob' },
		{ value: 'curly', label: 'Curly' },
		{ value: 'bun', label: 'Bun' }
	];

	const { Story } = defineMeta({
		title: 'Avatar/TilePicker',
		component: TilePicker,
		args: { label: 'Hair', value: 'swept', options: HAIR }
	});
</script>

<script lang="ts">
	let hair = $state<Person['hair']>('swept');
</script>

<Story name="Hair styles" asChild>
	<TilePicker label="Hair" options={HAIR} bind:value={hair}>
		{#snippet art(v)}{@html avatarSvg({ ...DEFAULTS, hair: v }, 56)}{/snippet}
	</TilePicker>
</Story>
