<!--
	VIP invite card (DRAFT, on /design only until Job approves it). Opening a
	named invite link pops this card up: it springs out with a tilt, a VIP seal
	stamps on, a light sweeps across, the note rises in, and the handwriting
	plays back as it was written (InkReplay). Then the accept button appears.
	Under prefers-reduced-motion it all simply shows. `inline` renders it in
	place (for /design) instead of over a scrim; change `replay` to play again.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import Button from './Button.svelte';
	import Badge from './Badge.svelte';
	import InkReplay from './InkReplay.svelte';
	import type { Ink } from './ink.ts';

	let {
		open = true,
		inline = false,
		replay = 0,
		code,
		from,
		note,
		ink = null,
		perk = null,
		eyebrow = 'A personal invite',
		title = 'You’re invited to Benkyo',
		acceptLabel = 'Accept invite',
		laterLabel = 'Not now',
		inkLabel = 'Handwritten note',
		onaccept,
		onclose
	}: {
		open?: boolean;
		inline?: boolean;
		replay?: number;
		/** the invite name, shown on the seal */
		code: string;
		from: string;
		note: string;
		ink?: Ink | null;
		/** what the coupon gives, e.g. "Plus trial · 14 days" */
		perk?: string | null;
		eyebrow?: string;
		title?: string;
		acceptLabel?: string;
		laterLabel?: string;
		inkLabel?: string;
		onaccept?: () => void;
		onclose?: () => void;
	} = $props();

	let inkDone = $state(false);
	$effect(() => {
		void replay;
		inkDone = !ink;
	});
</script>

{#snippet card()}
	{#key replay}
		<div class="invite-card" role={inline ? 'group' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={title}>
			<span class="sweep" aria-hidden="true"></span>
			<span class="seal" aria-hidden="true">{code}</span>
			<span class="eyebrow">{eyebrow}</span>
			<h2 class="title">{title}</h2>
			<p class="note">{note}</p>
			{#if ink}
				<div class="ink"><InkReplay {ink} label={inkLabel} delay={1300} ondone={() => (inkDone = true)} /></div>
			{/if}
			<span class="from">{from}</span>
			{#if perk}<span class="perk"><Badge tone="violet">{perk}</Badge></span>{/if}
			<div class="actions" class:ready={inkDone}>
				<Button variant="accent" block onclick={onaccept}>{acceptLabel}</Button>
				{#if onclose}<Button variant="ghost" block onclick={onclose}>{laterLabel}</Button>{/if}
			</div>
		</div>
	{/key}
{/snippet}

{#if inline}
	<div class="stage inline">{@render card()}</div>
{:else if open}
	<div class="scrim" transition:fade={{ duration: 200 }}>
		<div class="stage">{@render card()}</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 180; /* above sheets, the intro and sign-up (150-160), below the splash (200) */
		display: grid;
		place-items: center;
		padding: var(--space-4);
		background: rgb(0 0 0 / 0.35);
		backdrop-filter: blur(6px);
	}
	.stage {
		perspective: 900px;
		width: min(100%, 360px);
	}
	.stage.inline {
		margin-inline: auto;
		padding-block: var(--space-4);
	}
	.invite-card {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-5) var(--space-5);
		text-align: center;
		border-radius: var(--radius-sheet);
		background:
			radial-gradient(120% 60% at 50% 0%, rgb(232 67 46 / 0.12), transparent 70%),
			var(--color-bg);
		border: 1px solid var(--color-surface-edge);
		box-shadow: var(--shadow-surface), 0 24px 60px rgb(0 0 0 / 0.22);
		transform-origin: 50% 100%;
		animation: pop 1000ms var(--ease-spring-bouncy) both;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(80px) scale(0.6) rotateX(35deg) rotateZ(-6deg);
		}
		30% {
			opacity: 1;
		}
		to {
			transform: none;
		}
	}
	.seal {
		display: grid;
		place-items: center;
		min-width: 64px;
		height: 64px;
		padding-inline: var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--gradient-brand);
		color: var(--color-on-accent);
		font-weight: 800;
		letter-spacing: 0.06em;
		font-size: var(--text-footnote);
		box-shadow: 0 6px 18px rgb(184 38 79 / 0.35), inset 0 0 0 3px rgb(255 255 255 / 0.35);
		animation: stamp 520ms var(--ease-spring-bouncy) 450ms both;
	}
	@keyframes stamp {
		from {
			opacity: 0;
			transform: scale(1.8) rotate(-18deg);
		}
		to {
			opacity: 1;
			transform: rotate(-6deg);
		}
	}
	.sweep {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.55) 50%, transparent 65%);
		transform: translateX(-120%);
		animation: sweep 1100ms var(--ease-out) 700ms both;
	}
	@keyframes sweep {
		to {
			transform: translateX(120%);
		}
	}
	.eyebrow,
	.title,
	.note,
	.from,
	.perk {
		animation: rise var(--dur-slow) var(--ease-out) both;
	}
	.eyebrow {
		margin-top: var(--space-2);
		font-size: var(--text-caption);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-2);
		animation-delay: 650ms;
	}
	.title {
		margin: 0;
		font-size: var(--text-title-2);
		animation-delay: 750ms;
	}
	.note {
		margin: 0;
		color: var(--color-text-2);
		white-space: pre-line;
		animation-delay: 900ms;
	}
	.ink {
		width: 100%;
		--ink-color: var(--color-accent);
	}
	.from {
		align-self: flex-end;
		font-style: italic;
		color: var(--color-text-2);
		animation-delay: 1100ms;
	}
	.from::before {
		content: '— ';
	}
	.perk {
		animation-delay: 1200ms;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
	.actions {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
		opacity: 0;
		transform: translateY(8px);
		transition:
			opacity var(--dur-slow) var(--ease-out),
			transform var(--dur-slow) var(--ease-out);
	}
	.actions.ready {
		opacity: 1;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.invite-card,
		.seal,
		.sweep,
		.eyebrow,
		.title,
		.note,
		.from,
		.perk {
			animation: none;
		}
		.seal {
			transform: rotate(-6deg);
		}
		.sweep {
			display: none;
		}
		.actions {
			transition: none;
		}
	}
</style>
