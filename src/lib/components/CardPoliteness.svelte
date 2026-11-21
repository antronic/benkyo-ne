<!--
	The politeness of a saved word or phrase (docs/EVERYDAY.md "Word politeness"),
	read from the dictionary by the card's id. Shows nothing for a card you made
	yourself or when the dictionary can't answer (offline, entry not cached).
-->
<script lang="ts">
	import { getMarks } from '#lib/dict/dict.ts';
	import { jmdictIdOf, politenessFromMarks, type Politeness } from '#lib/words/politeness.ts';
	import { Skeleton } from '#lib/ui/index.ts';
	import WordPoliteness from './WordPoliteness.svelte';

	let { id, written }: { id: string; written: string } = $props();
	let level = $state<Politeness | null>(null);
	let loading = $state(true);

	$effect(() => {
		const jm = jmdictIdOf(id);
		const w = written;
		level = null;
		if (jm === null) {
			loading = false;
			return;
		}
		loading = true;
		let live = true;
		getMarks(jm).then((marks) => {
			if (!live) return;
			level = marks ? politenessFromMarks(marks, w) : null;
			loading = false;
		});
		return () => (live = false);
	});
</script>

{#if loading}
	<Skeleton variant="line" count={2} />
{:else if level}
	<WordPoliteness {level} />
{/if}
