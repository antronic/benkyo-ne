<!-- Draw-from-memory pad with Undo / Clear / Check controls. -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import TracePad from './TracePad.svelte';

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
	<button class="btn ghost small" onclick={() => pad?.undo()}>{t('pad.undo')}</button>
	<button class="btn ghost small" onclick={() => pad?.reset()}>{t('pad.clear')}</button>
	<button class="btn small" onclick={() => pad?.check()}>{t('quiz.check')}</button>
</div>
