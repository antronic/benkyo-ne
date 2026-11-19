<!--
	Activity indicator for work in progress: loading, saving, waiting for the AI.
	Give it a label (read by screen readers, shown when `showLabel`). Without a
	label it is decorative (aria-hidden), for use inside something that already
	says it is busy, such as a busy Button.
	For content that is about to appear, prefer Skeleton in its shape.

	  size  sm 14px · md 20px · lg 32px · inline 1em (follows the text, for buttons)
	  tone  accent: accent arc on a grey track · current: the text colour (on filled buttons)

	Why an SVG with a rotating <g>: Safari (WebKit) rotates an element's own box
	around a pivot it snaps to the pixel grid differently from the painted box, so
	a spinning <span> or <svg> sitting at a fractional position, or with a
	fractional size (1em), orbits up to 1.5px around its centre: the "wobble".
	Here the box never moves; only the arc turns inside the SVG's own coordinate
	space, around its exact centre (12, 12). Measured in WebKitGTK at 1x and 2x:
	0.00px centre movement, against 0.5 to 1.6px for the old border ring.
	See docs/guides/lessons.md. `npm run lint:ui` rejects new box spinners.
-->
<script lang="ts">
	let {
		label,
		size = 'md',
		tone = 'accent',
		showLabel = false
	}: { label?: string; size?: 'sm' | 'md' | 'lg' | 'inline'; tone?: 'accent' | 'current'; showLabel?: boolean } = $props();
</script>

<span class="spinner s-{size} t-{tone}" role={label ? 'status' : undefined} aria-live={label ? 'polite' : undefined} aria-hidden={label ? undefined : 'true'}>
	<svg class="ring" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<circle class="track" cx="12" cy="12" r="10" />
		<g class="turn"><circle class="arc" cx="12" cy="12" r="10" pathLength="100" /></g>
	</svg>
	{#if label}<span class:visually-hidden={!showLabel} class="text">{label}</span>{/if}
</span>

<style>
	.spinner {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-2);
		font-size: var(--text-subhead);
		vertical-align: middle;
	}
	.s-inline {
		font-size: inherit;
		gap: 0;
	}
	.t-current {
		color: inherit;
	}
	.ring {
		--d: 20px;
		display: block;
		flex: none;
		width: var(--d);
		height: var(--d);
		overflow: visible;
	}
	.s-sm .ring {
		--d: 14px;
	}
	.s-lg .ring {
		--d: 32px;
	}
	.s-inline .ring {
		--d: 1em;
	}
	circle {
		fill: none;
		/* 2.5 of 24 units: 2px at 20px, ~3.3px at 32px, 1.5px at 14px. */
		stroke-width: 2.5;
	}
	.track {
		stroke: var(--color-fill-strong);
	}
	.arc {
		stroke: var(--color-accent);
		stroke-linecap: round;
		stroke-dasharray: 25 75;
	}
	.t-current .track {
		stroke: currentColor;
		opacity: 0.25;
	}
	.t-current .arc {
		stroke: currentColor;
	}
	.turn {
		/* Rotate inside the SVG around its exact centre, never the element box. */
		transform-box: view-box;
		transform-origin: 12px 12px;
		animation: spinner-turn 800ms linear infinite;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@keyframes spinner-turn {
		to {
			transform: rotate(1turn); /* spin-ok: rotates the <g> inside the SVG, see the note at the top */
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.turn {
			animation-duration: 2400ms;
		}
	}
</style>
