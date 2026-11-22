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
<Story name="Pointing at Kuri" asChild>
	<div style:display="grid" style:gap="var(--space-4)" style:justify-items="start">
		<SpeechBubble tail="down"><b class="jp" lang="ja">はじめまして！</b> I’m Kuri. I’ll study with you.</SpeechBubble>
		<SpeechBubble tail="up" tailAt={24}>You’ve got this!</SpeechBubble>
		<SpeechBubble tail="left">3 reviews today!</SpeechBubble>
		<SpeechBubble tail="right">Whoa… everything’s spinning!</SpeechBubble>
	</div>
</Story>
