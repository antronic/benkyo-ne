<!--
	Kuri's first meeting: about four seconds, once, after the onboarding questions.
	An AI orb drops in and bursts, Kuri pops out waving, two short lines rise in,
	Kuri hops, and "Let's start" shrinks Kuri onto its spot on Today.
	Skip or a tap ends it at once; with reduced motion everything shows still.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Kuri from './Kuri.svelte';
	import { walkerSpot, reducedMotion, kuriSound, kuriHello, type KuriPose } from './kuri.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	let { ondone }: { ondone: () => void } = $props();

	const IK = 220;
	const still = reducedMotion();
	let step = $state(still ? 5 : 0);
	let leaving = $state(false);
	let pose = $state<KuriPose>('wave');
	let fly = $state('');
	let go: HTMLButtonElement;
	const timers: ReturnType<typeof setTimeout>[] = [];
	const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

	onMount(() => {
		if (still) {
			kuriHello();
			go?.focus();
			return;
		}
		at(30, () => ((step = 1), kuriSound('intro')));
		at(650, () => ((step = 2), haptic('selection')));
		at(1250, () => ((step = 3), kuriHello()));
		at(2000, () => (step = 4));
		at(2900, () => ((pose = 'happy'), (step = 5), haptic('success'), kuriSound('happy')));
		at(4200, () => (pose = 'idle'));
		at(9000, finish);
		return () => timers.forEach(clearTimeout);
	});

	let done = false;
	function finish() {
		if (done) return;
		done = true;
		timers.forEach(clearTimeout);
		if (still) return ondone();
		pose = 'idle';
		leaving = true;
		// shrink down onto Kuri's spot on Today when it's there, otherwise fade out
		if (walkerSpot.visible && walkerSpot.x >= 0) {
			const s = walkerSpot.size / IK;
			fly = `translate(${walkerSpot.x - (innerWidth / 2 - IK / 2)}px, ${walkerSpot.y - (innerHeight * 0.32 - 136)}px) scale(${s})`;
		}
		setTimeout(ondone, 680);
	}
</script>

<div class="intro" class:still class:leaving data-step={step} role="dialog" aria-modal="true" aria-label={t('kuri.name')}>
	<div class="bg"></div>
	<div class="orb"></div>
	<div class="ring"></div>
	<button class="ik" style:transform={fly || undefined} onclick={finish} tabindex="-1" aria-hidden="true">
		<span class="pop"><Kuri {pose} detail="full" options={{ yaw: 0.2, pitch: 0.18, distance: 6.2, target: [0, 1.1, 0] }} /></span>
	</button>
	<div class="lines" aria-live="polite">
		<b class="l1 jp" lang="ja">はじめまして！</b>
		<span class="l2">{t('kuri.intro1')}</span>
		<span class="l3">{t('kuri.intro2')}</span>
	</div>
	<button class="go btn accent block" bind:this={go} onclick={finish}>{t('kuri.start')}</button>
	<button class="skip" onclick={finish}>{t('kuri.skip')}</button>
</div>

<style>
	.intro {
		position: fixed;
		inset: 0;
		z-index: var(--z-overlay, 90);
		overflow: hidden;
		color: var(--color-text);
	}
	.bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(90% 60% at 50% 32%, color-mix(in srgb, var(--color-violet) 22%, var(--color-bg)) 0%, var(--color-bg) 72%);
		transition: opacity 450ms var(--ease-out);
	}
	.leaving .bg,
	.leaving .lines,
	.leaving .go,
	.leaving .skip {
		opacity: 0;
		transition: opacity 300ms var(--ease-out);
		pointer-events: none;
	}
	.leaving {
		pointer-events: none;
	}
	.orb,
	.ring {
		position: absolute;
		left: 50%;
		top: 32%;
		width: 60px;
		height: 60px;
		margin: -30px; /* ui-ok: centres the 60px orb on its point */
		border-radius: 50%;
		opacity: 0;
	}
	.orb {
		background: radial-gradient(circle at 35% 30%, #fff 0, var(--color-info) 38%, var(--color-violet) 80%);
		box-shadow:
			0 0 36px var(--color-violet),
			0 0 80px color-mix(in srgb, var(--color-info) 60%, transparent);
		transform: translateY(-180px) scale(0.5);
	}
	.ring {
		border: 2px solid var(--color-violet);
	}
	[data-step='1'] .orb {
		animation: orb-in 650ms var(--ease-out) forwards;
	}
	[data-step='2'] .orb,
	[data-step='3'] .orb,
	[data-step='4'] .orb,
	[data-step='5'] .orb {
		animation: orb-pop 420ms ease-out forwards;
	}
	[data-step='2'] .ring {
		animation: ring 700ms ease-out forwards;
	}
	@keyframes orb-in {
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes orb-pop {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(2.6);
		}
	}
	@keyframes ring {
		from {
			opacity: 0.9;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(5);
		}
	}
	.ik {
		all: unset;
		position: absolute;
		left: calc(50% - 110px);
		top: calc(32% - 136px);
		width: 220px;
		height: 220px;
		transform-origin: 0 0;
		transition: transform 650ms var(--ease-out);
		cursor: pointer;
	}
	.pop {
		display: block;
		width: 100%;
		height: 100%;
		transform: scale(0);
	}
	.intro:not([data-step='0']):not([data-step='1']) .pop {
		transform: scale(1);
		transition: transform 650ms var(--ease-spring-bouncy);
	}
	.lines {
		position: absolute;
		left: 24px;
		right: 24px;
		top: 58%;
		text-align: center;
		display: grid;
		gap: var(--space-1h);
	}
	.lines > * {
		opacity: 0;
		transform: translateY(14px);
		filter: blur(6px);
		transition:
			opacity 500ms var(--ease-out),
			transform var(--dur-slow) var(--ease-spring),
			filter 500ms var(--ease-out);
	}
	.lines b {
		font-size: var(--text-title-1);
		font-weight: var(--weight-bold);
	}
	.lines span {
		color: var(--color-text-2);
	}
	[data-step='3'] .l1,
	[data-step='4'] .l1,
	[data-step='5'] .l1,
	[data-step='4'] .l2,
	[data-step='5'] .l2,
	[data-step='4'] .l3,
	[data-step='5'] .l3 {
		opacity: 1;
		transform: none;
		filter: none;
	}
	.l3 {
		transition-delay: 150ms;
	}
	.go {
		position: absolute;
		left: 24px;
		right: 24px;
		bottom: calc(var(--safe-bottom, 0px) + 32px);
		width: auto;
		max-width: 480px;
		margin: 0 auto;
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 400ms,
			transform 600ms var(--ease-spring-bouncy);
	}
	[data-step='5'] .go {
		opacity: 1;
		transform: none;
	}
	.skip {
		position: absolute;
		top: calc(var(--safe-top, 0px) + 14px);
		right: 16px;
		border: 0;
		background: var(--color-fill);
		color: var(--color-text-2);
		font: inherit;
		font-size: var(--text-footnote);
		border-radius: var(--radius-pill);
		padding: var(--space-1h) var(--space-4);
		min-height: 32px;
		cursor: pointer;
	}
	.still .orb,
	.still .ring {
		display: none;
	}
	.still .pop,
	.still .lines > *,
	.still .go {
		transform: none;
		opacity: 1;
		filter: none;
		transition: none;
	}
</style>
