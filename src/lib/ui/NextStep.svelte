<!--
	The one thing to do now, at the top of Today (docs/UX-FLOW.md): an eyebrow, a big title,
	one line, and ONE button. `hue` tints the card; `art` is a snippet drawn on the right (kana
	glyphs for a lesson, a count for reviews). `then` is an optional quiet link under the button
	for what comes after ("Then: Lesson 2 · K-row"). With `done` the card is calm and has no
	button: today's work is finished.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	let {
		eyebrow,
		title,
		body = '',
		action = '',
		href,
		onclick,
		hue = 8,
		done = false,
		then,
		art,
		class: cls = ''
	}: {
		eyebrow: string;
		title: string;
		/** one line under the title */
		body?: string;
		/** the button's words */
		action?: string;
		href?: string;
		onclick?: () => void;
		/** 0–360: the card's colour */
		hue?: number;
		/** nothing left to do today: no button, quiet colours */
		done?: boolean;
		then?: { label: string; href: string };
		art?: Snippet;
		class?: string;
	} = $props();
</script>

<section class="next-step {cls}" class:done style:--h={hue} aria-label={eyebrow}>
	<div class="text">
		<div class="ns-eyebrow">{eyebrow}</div>
		<h2 class="ns-title">{title}</h2>
		{#if body}<p class="body">{body}</p>{/if}
		{#if !done && action}
			<div class="go">
				<Button variant={done ? 'ghost' : 'primary'} {href} {onclick} class="next-step-go">{action}</Button>
			</div>
		{/if}
		{#if then}<a class="then" href={then.href}>{then.label} ›</a>{/if}
	</div>
	{#if art}<div class="art" aria-hidden="true">{@render art()}</div>{/if}
</section>

<style>
	.next-step {
		position: relative;
		display: flex;
		gap: var(--space-4);
		align-items: center;
		padding: var(--space-6) var(--space-5);
		border-radius: var(--radius-sheet);
		overflow: hidden;
		color: #fff;
		background:
			radial-gradient(120% 140% at 100% 0%, hsl(calc(var(--h) + 30) 90% 62%) 0%, transparent 60%),
			linear-gradient(135deg, hsl(var(--h) 82% 56%), hsl(calc(var(--h) - 25) 75% 46%));
		box-shadow: 0 18px 40px -18px hsl(var(--h) 80% 40% / 0.55);
	}
	.next-step.done {
		color: var(--ink);
		background: var(--glass);
		box-shadow: none;
		border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.text {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		flex: 1;
	}
	.ns-eyebrow {
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.85;
	}
	.ns-title {
		margin: 0;
		font-size: 1.75rem;
		line-height: 1.15;
		font-weight: 750;
		letter-spacing: -0.01em;
	}
	.body {
		margin: 0;
		font-size: 0.9375rem;
		opacity: 0.9;
	}
	.go {
		margin-top: var(--space-3);
	}
	.next-step:not(.done) .go :global(.next-step-go) {
		background: #fff;
		color: hsl(var(--h) 75% 38%);
		min-width: 10rem;
	}
	.then {
		margin-top: var(--space-2);
		font-size: 0.875rem;
		font-weight: 600;
		color: inherit;
		opacity: 0.85;
		text-decoration: none;
	}
	.then:hover {
		opacity: 1;
		text-decoration: underline;
	}
	.art {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 40%;
		opacity: 0.9;
	}
	@media (max-width: 380px) {
		.art {
			display: none;
		}
	}
</style>
