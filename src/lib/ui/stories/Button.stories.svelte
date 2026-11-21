<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button, FieldRow } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/Button',
		component: Button,
		parameters: { controls: { include: ['variant', 'size', 'busy', 'disabled', 'block', 'href'] } },
		args: { variant: 'primary', size: 'lg', busy: false, disabled: false, block: false },
		argTypes: {
			variant: { control: 'select', options: ['primary', 'accent', 'ghost', 'danger', 'ghost-danger', 'plain', 'link'] },
			size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] }
		}
	});
</script>

<Story name="Playground">
	{#snippet template(args)}
		<Button {...args}>Start review</Button>
	{/snippet}
</Story>

<Story name="Variants" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Button>Primary</Button>
		<Button variant="accent">Accent</Button>
		<Button variant="ghost">Ghost</Button>
		<Button variant="danger">Delete account</Button>
		<Button variant="ghost-danger">Sign out</Button>
		<Button variant="plain">Plain</Button>
		<Button variant="link">Link</Button>
	</div>
</Story>

<Story name="Sizes" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Button size="sm">Small, 36px</Button>
		<Button size="md">Medium, 44px</Button>
		<Button size="lg">Large, 50px</Button>
	</div>
</Story>

<Story name="States" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<Button busy>Saving</Button>
		<Button disabled>Disabled</Button>
		<Button block>Block</Button>
		<Button href="#link" variant="ghost">As a link</Button>
	</div>
</Story>

<Story name="In a FieldRow" asChild>
	<FieldRow>
		<Button variant="ghost">Cancel</Button>
		<Button>Save</Button>
	</FieldRow>
</Story>
