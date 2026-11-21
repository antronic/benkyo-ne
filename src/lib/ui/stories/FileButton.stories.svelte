<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { FileButton } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/FileButton',
		component: FileButton,
		args: { accept: 'image/*', variant: 'ghost', block: false, disabled: false },
		argTypes: { variant: { control: 'inline-radio', options: ['primary', 'accent', 'ghost'] } }
	});
</script>

<script lang="ts">
	let picked = $state('');
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}
		<div class="stack" style:--gap="var(--space-2)">
			<FileButton {...args} onpick={(f) => (picked = f.name)}>Choose a screenshot</FileButton>
			<p class="caption">{picked ? `Picked: ${picked}` : 'Nothing picked yet'}</p>
		</div>
	{/snippet}
</Story>
<Story name="Camera (accent)" args={{ variant: 'accent', capture: 'user' }}>
	{#snippet template({ children: _, ...args })}<FileButton {...args} onpick={() => {}}>Take a selfie</FileButton>{/snippet}
</Story>
