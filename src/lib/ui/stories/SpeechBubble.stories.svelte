<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { SpeechBubble } from '#lib/ui/index.ts';

	const { Story } = defineMeta({ title: 'Content/SpeechBubble', component: SpeechBubble, args: { label: 'Kuri says' } });
</script>

<Story name="Playground">
	{#snippet template({ children: _, ...args })}<SpeechBubble {...args}>9 messages checked and 23 phrases saved! Let’s work on humble forms next.</SpeechBubble>{/snippet}
</Story>
<Story name="With Japanese" asChild>
	<SpeechBubble><b class="jp">見てください</b> is an instruction. To a boss, ask softly: <b class="jp">ご確認いただけますと幸いです</b>.</SpeechBubble>
</Story>
<Story name="With avatar" asChild>
	<SpeechBubble>
		{#snippet avatar()}<span style:font-size="2rem" aria-hidden="true">🐕</span>{/snippet}
		おはよう! 12 reviews are waiting.
	</SpeechBubble>
</Story>
