<!-- Draw-from-memory pad with Undo / Clear / Check controls. -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import TracePad from './TracePad.svelte';
	import { Button } from '#lib/ui/index.ts';

	interface Props {
		char: string;
		size?: string;
		oncomplete: (r: { correct: boolean; guess?: string }) => void;
	}
	let { char, size = 'min(78vw, 320px)', oncomplete }: Props = $props();
	let pad: TracePad | undefined = $state();
</script>

<TracePad bind:this={pad} {char} mode="recall" {size} {oncomplete} />
<div class="row" style="justify-content:center">
	<Button variant="ghost" size="sm" onclick={() => pad?.undo()}>{t('pad.undo')}</Button>
	<Button variant="ghost" size="sm" onclick={() => pad?.reset()}>{t('pad.clear')}</Button>
	<Button size="sm" onclick={() => pad?.check()}>{t('quiz.check')}</Button>
</div>
