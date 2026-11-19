<!--
	"Where it came from": the origin picture shows on its own first, then the
	real strokes are written on top of it while the picture fades back, so the
	learner sees the drawing turn into the kanji. Compounds colour each part's
	strokes to match the part chips (see KanjiParts).
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import StrokeAnimator from './StrokeAnimator.svelte';
	import { kanjiByChar } from '#lib/content/kanji.ts';
	import { partColors } from '#lib/content/strokes.ts';

	interface Props {
		char: string;
		size?: number | string;
		/** ms the picture is shown alone before the strokes start */
		delay?: number;
	}
	let { char, size = '100%', delay = 1100 }: Props = $props();

	const kanji = $derived(kanjiByChar.get(char));
	const colors = $derived(partColors(char));
	let anim: StrokeAnimator | undefined = $state();
	let stage = $state<'picture' | 'writing' | 'done'>('picture');
	let timer: ReturnType<typeof setTimeout>;
	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	export function replay() {
		clearTimeout(timer);
		stage = 'picture';
		timer = setTimeout(
			() => {
				stage = 'writing';
				anim?.play();
			},
			reduced ? 0 : delay
		);
	}

	onMount(() => {
		replay();
		return () => clearTimeout(timer);
	});
</script>

<div class="origin" style:--size={typeof size === 'number' ? `${size}px` : size}>
	<StrokeAnimator
		bind:this={anim}
		{char}
		size="100%"
		autoplay={false}
		scene={stage === 'picture' ? 1 : 0.55}
		ghost={stage !== 'picture'}
		{colors}
		ondone={() => (stage = 'done')}
	/>
	{#if stage === 'picture' && kanji}
		<span class="cue caption">{t('kanji.lookLike')}</span>
	{/if}
</div>

<style>
	.origin {
		position: relative;
		width: var(--size);
		aspect-ratio: 1;
	}
	.cue {
		position: absolute;
		left: 50%;
		bottom: 6%;
		translate: -50% 0;
		white-space: nowrap;
		padding: var(--space-1) var(--space-3);
		border-radius: 999px;
		background: var(--glass-strong);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		animation: rise 500ms var(--ease-out) both;
	}
</style>
