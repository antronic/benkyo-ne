<!--
	iOS bottom sheet. Drag the grabber/header down to dismiss. The sheet
	follows your finger, rubber-bands when pulled up, and on release either
	dismisses (distance or flick velocity) or springs back. The scrim fades
	with the drag.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';

	interface Props {
		open: boolean;
		label: string;
		onclose: () => void;
		header?: Snippet;
		children: Snippet;
	}
	let { open, label, onclose, header, children }: Props = $props();

	let sheet: HTMLDivElement | undefined = $state();
	let dy = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let samples: { y: number; t: number }[] = [];

	function down(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		dragging = true;
		startY = e.clientY;
		samples = [{ y: e.clientY, t: e.timeStamp }];
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const raw = e.clientY - startY;
		dy = raw > 0 ? raw : raw / 4; // rubber-band upwards
		samples.push({ y: e.clientY, t: e.timeStamp });
		if (samples.length > 6) samples.shift();
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const a = samples[0],
			b = samples[samples.length - 1];
		const v = (b.y - a.y) / Math.max(1, b.t - a.t);
		const h = sheet?.offsetHeight ?? 600;
		if (dy > h * 0.3 || v > 0.6) {
			haptic('selection');
			onclose();
		}
		dy = 0;
	}
	function key(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={key} />

{#if open}
	<button
		class="scrim"
		aria-hidden="true"
		tabindex="-1"
		onclick={onclose}
		transition:fade={{ duration: 220 }}
		style:opacity={1 - Math.min(1, Math.max(0, dy) / 500)}
	></button>
	<div
		bind:this={sheet}
		class="sheet glass glass-strong"
		class:dragging
		style:transform="translateY({dy}px)"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		transition:fly={{ y: 600, duration: 520, easing: cubicOut, opacity: 1 }}
	>
		<div class="handle" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
			<div class="grabber"></div>
			{@render header?.()}
		</div>
		<div class="body">{@render children()}</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		border: 0;
		background: rgb(0 0 0 / 0.3);
		z-index: 60;
	}
	.sheet {
		position: fixed;
		z-index: 61;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0 auto;
		max-width: 560px;
		padding: 0 max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
		border-radius: 34px 34px 0 0;
		max-height: 94dvh;
		display: flex;
		flex-direction: column;
		transition: transform 520ms var(--spring);
		will-change: transform;
	}
	.sheet.dragging {
		transition: none;
	}
	.handle {
		touch-action: none;
		padding-top: var(--space-2);
		cursor: grab;
	}
	.grabber {
		width: 38px;
		height: 5px;
		border-radius: 3px;
		background: var(--ink-3);
		margin: 0 auto var(--space-2);
	}
	.body {
		overflow: auto;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
