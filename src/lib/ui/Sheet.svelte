<!--
	iOS bottom sheet. Drag the grabber/header down to dismiss. The sheet
	follows your finger, rubber-bands when pulled up, and on release either
	dismisses (distance or flick velocity) or springs back. The scrim fades
	with the drag.

	peek: opens at a medium height over what you were looking at (iOS "medium detent");
	drag the grabber up (or tap it) for full height, down to go back to the peek, then down
	again to close. Its body fills the height, and `footer` stays pinned at the bottom
	above the keyboard (a composer, a primary action).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	interface Props {
		open: boolean;
		label: string;
		onclose: () => void;
		header?: Snippet;
		children: Snippet;
		/** open at a medium height; drag up for full height */
		peek?: boolean;
		/** pinned under the scrolling body (peek sheets) */
		footer?: Snippet;
		/** the body element, to scroll it from outside (a chat following its newest message) */
		body?: HTMLDivElement;
	}
	let { open, label, onclose, header, children, peek = false, footer, body = $bindable() }: Props = $props();
	/** a peek sheet pulled up to full height */
	let expanded = $state(false);
	$effect(() => {
		if (!open) expanded = false;
	});

	let sheet: HTMLDivElement | undefined = $state();
	let dy = $state(0);
	let dragging = $state(false);
	let startY = 0;
	/** the pointer moved: the grabber's click that follows is not a tap */
	let dragged = false;
	let samples: { y: number; t: number }[] = [];

	function down(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button:not(.grabber-hit)')) return;
		dragging = true;
		dragged = false;
		startY = e.clientY;
		samples = [{ y: e.clientY, t: e.timeStamp }];
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const raw = e.clientY - startY;
		if (Math.abs(raw) > 6) dragged = true;
		dy = raw > 0 ? raw : peek && !expanded ? raw / 2 : raw / 4; // rubber-band upwards (less when a peek can grow)
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
		if (peek && !expanded && (dy < -40 || v < -0.6)) {
			expanded = true;
			haptic('selection');
		} else if (peek && expanded && (dy > 60 || v > 0.6)) {
			expanded = false;
			haptic('selection');
		} else if (dy > h * 0.3 || v > 0.6) {
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
		class:peek
		class:expanded
		style:transform="translateY({dy}px)"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		transition:fly={{ y: 600, duration: 520, easing: cubicOut, opacity: 1 }}
	>
		<div class="handle" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
			{#if peek}
				<!-- ui-ok: the grabber is the kit's own expand control; a tap does what a drag up does -->
				<button type="button" class="grabber-hit" aria-label={expanded ? t('sheet.smaller') : t('sheet.fullHeight')} aria-expanded={expanded} onclick={() => !dragged && ((expanded = !expanded), haptic('selection'))}><span class="grabber"></span></button>
			{:else}
				<div class="grabber"></div>
			{/if}
			{@render header?.()}
		</div>
		<div class="body" bind:this={body}>{@render children()}</div>
		{#if footer}<div class="footer">{@render footer()}</div>{/if}
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
	/* Peek: a fixed medium height (full when pulled up) that sits above the on-screen keyboard. */
	.sheet.peek {
		height: min(64dvh, 94dvh - var(--kb));
		max-height: none;
		bottom: var(--kb);
		padding-bottom: calc(var(--safe-bottom) + var(--space-3));
		transition:
			transform 520ms var(--spring),
			height 420ms var(--spring);
	}
	.sheet.peek.expanded {
		height: calc(94dvh - var(--kb));
	}
	.sheet.peek.dragging {
		transition: height 420ms var(--spring);
	}
	.sheet.peek .body {
		flex: 1;
		min-height: 0;
	}
	.footer {
		flex: none;
		padding-top: var(--space-2);
	}
	.grabber-hit .grabber {
		display: block;
	}
	.grabber-hit {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
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
