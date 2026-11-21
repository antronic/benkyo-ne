<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TextField } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Controls/TextField',
		component: TextField,
		parameters: { controls: { include: ['label', 'value', 'placeholder', 'hint', 'error', 'jp', 'size', 'variant', 'disabled', 'type'] } },
		args: { label: 'Word', value: '', placeholder: '食べる', hint: '', error: '', jp: false, size: 'md', variant: 'default', disabled: false },
		argTypes: {
			size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
			variant: { control: 'inline-radio', options: ['default', 'answer', 'bare'] }
		}
	});
</script>

<Story name="Playground" />

<Story name="States" asChild>
	<div class="stack" style:--gap="var(--space-4)">
		<TextField label="Reading" value="たべる" jp hint="Hiragana or katakana" />
		<TextField label="Invite code" value="VIP-12" error="That code has expired. Ask for a new one." />
		<TextField label="Disabled" value="Read only" disabled />
		<TextField label="Answer" variant="answer" jp placeholder="Type the reading" />
	</div>
</Story>

<Story name="Sizes" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<TextField aria-label="Small" size="sm" placeholder="Small, 36px" />
		<TextField aria-label="Medium" size="md" placeholder="Medium, 44px" />
		<TextField aria-label="Large" size="lg" placeholder="Large, 50px" />
	</div>
</Story>
