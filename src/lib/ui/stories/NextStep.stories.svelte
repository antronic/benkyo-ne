<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { NextStep } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Content/NextStep',
		component: NextStep,
		args: { hue: 8, eyebrow: 'Start here · Hiragana', title: 'Vowels', body: '5 new kana · about 4 min', action: 'Start lesson', href: '#', done: false },
		argTypes: { hue: { control: { type: 'range', min: 0, max: 360 } } }
	});
</script>

<Story name="Playground" />

<Story name="States" asChild>
	<div class="stack" style:--gap="var(--space-3)">
		<NextStep hue={8} eyebrow="Start here · Hiragana" title="Vowels" body="5 new kana · about 4 min" action="Start lesson" href="#" then={{ label: 'Then: Travel words and phrases', href: '#' }}>
			{#snippet art()}<span class="jp" style="font-size:3.5rem;opacity:.55">あいう</span>{/snippet}
		</NextStep>
		<NextStep hue={265} eyebrow="Reviews due" title="12 cards" body="Timed to come up just before you’d forget them." action="Start review" href="#" />
		<NextStep done eyebrow="Today" title="That’s today’s new kana" body="Stop here and review tomorrow. It sticks better." then={{ label: 'Or look around Learn', href: '#' }} />
	</div>
</Story>
