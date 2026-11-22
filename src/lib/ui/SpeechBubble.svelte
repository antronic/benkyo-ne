<!--
	A short line from Kuri (or anyone with an avatar), as a speech bubble.
	Draft for the Writing helper, kanji drills and the weekly report
	(docs/EVERYDAY.md). `avatar` is a snippet; it defaults to Kuri's face emoji.
	`tail` drops the avatar and points the bubble at a speaker drawn elsewhere, such as Kuri
	walking on Today: the side the speaker is on ('down' when below the bubble, 'up' above,
	'left', 'right'). `tailAt` is where along that edge the tail sits (px from the left, or from
	the top for 'left' and 'right'; the middle when left out).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = { avatar?: Snippet; children: Snippet; label?: string; tail?: 'up' | 'down' | 'left' | 'right'; tailAt?: number };
	let { avatar, children, label = 'Kuri says', tail, tailAt }: Props = $props();
</script>

<div class="say" class:tailed={!!tail} role="note" aria-label={label}>
	{#if !tail}<span class="avatar" aria-hidden="true">{#if avatar}{@render avatar()}{:else}🐕{/if}</span>{/if}
	<div class="bubble tail-{tail ?? 'none'}" style:--tail-at={tailAt === undefined ? undefined : `${tailAt}px`}>{@render children()}</div>
</div>

<style>
	.say {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		min-width: 0;
	}
	.avatar {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-round);
		display: grid;
		place-items: center;
		font-size: 22px;
		background: color-mix(in srgb, var(--color-warning) 25%, var(--color-surface-strong));
	}
	.bubble {
		position: relative;
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-card) var(--radius-card) var(--radius-card) var(--radius-xs);
		background: var(--color-surface-strong);
		box-shadow: var(--shadow-surface);
		font-size: var(--text-subhead);
		line-height: var(--leading-snug);
	}
	.tailed .bubble {
		border-radius: var(--radius-card);
		border: var(--hairline-w) solid var(--color-border);
		box-shadow: var(--shadow-raised);
		-webkit-backdrop-filter: blur(20px) saturate(1.6);
		backdrop-filter: blur(20px) saturate(1.6);
	}
	/* a small rotated square, the same colour and border as the bubble, half tucked under it */
	.tail-up::before,
	.tail-down::before,
	.tail-left::before,
	.tail-right::before {
		content: '';
		position: absolute;
		width: 14px;
		height: 14px;
		background: inherit;
		border: inherit;
		transform: rotate(45deg);
	}
	.tail-up::before,
	.tail-down::before {
		left: calc(var(--tail-at, 50%) - 7px);
	}
	.tail-left::before,
	.tail-right::before {
		top: calc(var(--tail-at, 50%) - 7px);
	}
	.tail-down::before {
		bottom: -8px;
		border-top-color: transparent;
		border-left-color: transparent;
	}
	.tail-up::before {
		top: -8px;
		border-bottom-color: transparent;
		border-right-color: transparent;
	}
	.tail-left::before {
		left: -8px;
		border-top-color: transparent;
		border-right-color: transparent;
	}
	.tail-right::before {
		right: -8px;
		border-bottom-color: transparent;
		border-left-color: transparent;
	}
</style>
