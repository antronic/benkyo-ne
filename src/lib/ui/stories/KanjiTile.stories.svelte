<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { KanjiTile } from '#lib/ui/index.ts';

	const { Story } = defineMeta({
		title: 'Learning/KanjiTile',
		component: KanjiTile,
		args: { kanji: '議', reading: 'ぎ', misread: 3, unwritten: 1 }
	});
</script>

<Story name="Playground" />
<Story name="Kanji you keep forgetting" asChild>
	<div class="row wrap" style:--gap="var(--space-2)">
		<KanjiTile kanji="議" reading="ぎ" misread={3} unwritten={1} />
		<KanjiTile kanji="確" reading="かく" misread={2} unwritten={2} />
		<KanjiTile kanji="認" reading="にん" misread={1} unwritten={2} />
		<KanjiTile kanji="資" reading="し" />
	</div>
</Story>
