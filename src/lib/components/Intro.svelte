<!--
	First-launch introduction: four immersive scenes built with CSS 3D
	(perspective, preserve-3d, rotations). Swipe or tap Next; Skip anytime.
	Replay from Settings → About. Reduce Motion: no 3D motion, simple fades.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';
	import { strokesOf } from '#lib/content/strokes.ts';
	import { Button, PageDots } from '#lib/ui/index.ts';

	let { ondone }: { ondone: () => void } = $props();

	const SLIDES = [
		{ key: 'cube', title: 'intro.1.title', text: 'intro.1.text', hue: 8 },
		{ key: 'draw', title: 'intro.2.title', text: 'intro.2.text', hue: 200 },
		{ key: 'cards', title: 'intro.3.title', text: 'intro.3.text', hue: 140 },
		{ key: 'ai', title: 'intro.4.title', text: 'intro.4.text', hue: 265 }
	] as const;
	const CUBE = ['あ', 'カ', '日', 'さ', 'ね', 'ン'];
	const draw = strokesOf('ね')?.d ?? [];

	let i = $state(0);
	let dir = $state(1);
	const slide = $derived(SLIDES[i]);

	function go(n: number) {
		if (n < 0 || n >= SLIDES.length) return;
		dir = n > i ? 1 : -1;
		i = n;
		haptic('selection');
	}
	function next() {
		if (i < SLIDES.length - 1) go(i + 1);
		else finish();
	}
	function finish() {
		haptic('success');
		ondone();
	}

	// swipe
	let x0 = 0;
	const down = (e: PointerEvent) => (x0 = e.clientX);
	const up = (e: PointerEvent) => {
		const dx = e.clientX - x0;
		if (Math.abs(dx) > 50) dx < 0 ? next() : go(i - 1);
	};
</script>

<div class="intro" style:--h={slide.hue} transition:fade={{ duration: 400 }} role="dialog" aria-modal="true" aria-label={t('intro.label')}>
	<div class="bg" aria-hidden="true"></div>
	<div class="skip"><Button variant="ghost" size="sm" onclick={finish}>{t('intro.skip')}</Button></div>

	<div class="stage" onpointerdown={down} onpointerup={up} role="presentation">
		{#key i}
			<div class="scene" in:fly={{ x: 80 * dir, duration: 600, easing: cubicOut, opacity: 0 }} aria-hidden="true">
				{#if slide.key === 'cube'}
					<div class="cube-wrap">
						<div class="cube">
							{#each CUBE as k, f}<div class="face f{f}"><span class="jp">{k}</span></div>{/each}
						</div>
					</div>
				{:else if slide.key === 'draw'}
					<div class="tilt">
						<div class="paper">
							<svg viewBox="0 0 109 109">
								<path d="M54.5 6 V103 M6 54.5 H103" class="grid" />
								{#each draw as d, s}<path {d} pathLength="1" class="ink" style:--s={s} />{/each}
							</svg>
						</div>
						<div class="pen"></div>
					</div>
				{:else if slide.key === 'cards'}
					<div class="fan">
						{#each ['き', 'つ', 'ね', 'み', 'あ'] as k, c}
							<div class="card" style:--c={c}><span class="jp">{k}</span><small>{['ki', 'tsu', 'ne', 'mi', 'a'][c]}</small></div>
						{/each}
					</div>
				{:else}
					<div class="orbit">
						<div class="orb"></div>
						{#each ['こんにちは', 'ありがとう', 'すみません'] as w, o}
							<div class="moon" style:--o={o}><span class="jp">{w}</span></div>
						{/each}
					</div>
				{/if}
			</div>
		{/key}
	</div>

	<div class="copy">
		{#key i}
			<div in:fly={{ y: 16, duration: 500, delay: 120, easing: cubicOut }}>
				<h2 class="large-title">{t(slide.title)}</h2>
				<p class="subhead">{t(slide.text)}</p>
			</div>
		{/key}
		<div style:--dot-on="hsl(var(--h) 80% 55%)">
			<PageDots count={SLIDES.length} index={i} label={t('intro.pages')} pageLabel={(n) => t('intro.page', { n })} onselect={go} />
		</div>
		<Button variant="accent" block onclick={next}>{i < SLIDES.length - 1 ? t('intro.next') : t('intro.start')}</Button>
	</div>
</div>

<style>
	.intro {
		position: fixed;
		inset: 0;
		z-index: 150;
		display: flex;
		flex-direction: column;
		padding: calc(var(--safe-top) + var(--space-3)) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
		background: var(--bg);
		overflow: hidden;
		touch-action: pan-y;
	}
	.bg {
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(40% 35% at 30% 30%, hsl(var(--h) 85% 62% / 0.45), transparent 70%),
			radial-gradient(45% 40% at 75% 70%, hsl(calc(var(--h) + 60) 80% 60% / 0.35), transparent 70%);
		filter: blur(30px);
		transition: background 900ms;
		animation: breathe 9s ease-in-out infinite alternate;
	}
	@keyframes breathe {
		to {
			transform: scale(1.1) rotate(6deg);
		}
	}
	.skip {
		position: relative;
		align-self: flex-end;
		z-index: 2;
	}
	.skip :global(.btn) {
		color: var(--ink-2);
	}
	.stage {
		position: relative;
		flex: 1;
		display: grid;
		place-items: center;
		perspective: 900px;
		min-height: 260px;
	}
	.scene {
		display: grid;
		place-items: center;
		transform-style: preserve-3d;
	}
	.copy {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		text-align: center;
		max-width: 460px;
		width: 100%;
		margin: 0 auto;
	}
	.copy h2 {
		margin: 0 0 var(--space-1h);
	}
	.copy p {
		margin: 0;
	}
	/* 1 — spinning kana cube */
	.cube-wrap {
		width: 150px;
		height: 150px;
		perspective: 700px;
	}
	.cube {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		animation: spin 9s linear infinite;
	}
	.face {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border-radius: 26px;
		font-size: 72px;
		color: #fff;
		background: linear-gradient(135deg, hsl(var(--h) 90% 62%), hsl(calc(var(--h) - 20) 75% 45%));
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5);
		backface-visibility: visible;
		opacity: 0.94;
	}
	.f0 { transform: translateZ(75px); }
	.f1 { transform: rotateY(90deg) translateZ(75px); filter: brightness(0.9); }
	.f2 { transform: rotateY(180deg) translateZ(75px); }
	.f3 { transform: rotateY(-90deg) translateZ(75px); filter: brightness(0.9); }
	.f4 { transform: rotateX(90deg) translateZ(75px); filter: brightness(1.1); }
	.f5 { transform: rotateX(-90deg) translateZ(75px); filter: brightness(0.8); }
	@keyframes spin {
		from { transform: rotateX(-18deg) rotateY(0deg); }
		to { transform: rotateX(-18deg) rotateY(360deg); }
	}

	/* 2 — tilted writing card */
	.tilt {
		position: relative;
		transform-style: preserve-3d;
		animation: sway 6s ease-in-out infinite alternate;
	}
	.paper {
		width: 210px;
		height: 210px;
		border-radius: 30px;
		background: var(--glass-strong);
		border: 0.5px solid var(--glass-edge);
		box-shadow: 0 40px 60px -30px hsl(var(--h) 60% 30% / 0.6);
		padding: var(--space-6);
		transform: rotateX(28deg) rotateZ(-6deg);
	}
	.paper svg {
		width: 100%;
		height: 100%;
	}
	.grid {
		stroke: var(--hairline);
		stroke-dasharray: 2 3;
		fill: none;
	}
	.ink {
		fill: none;
		stroke: var(--ink);
		stroke-width: 6;
		stroke-linecap: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: write2 3.6s ease-in-out infinite;
		animation-delay: calc(var(--s) * 0.5s);
	}
	@keyframes write2 {
		0%, 5% { stroke-dashoffset: 1; }
		35%, 85% { stroke-dashoffset: 0; }
		100% { stroke-dashoffset: 1; opacity: 0; }
	}
	.pen {
		position: absolute;
		width: 14px;
		height: 120px;
		right: -8px;
		top: -40px;
		border-radius: 7px;
		background: linear-gradient(hsl(var(--h) 80% 55%), hsl(var(--h) 70% 35%));
		transform: rotate(28deg) translateZ(60px);
		box-shadow: 0 20px 30px -10px rgb(0 0 0 / 0.35);
		animation: penmove 3.6s ease-in-out infinite;
	}
	@keyframes sway {
		to { transform: rotateY(14deg) rotateX(6deg); }
	}
	@keyframes penmove {
		50% { transform: rotate(22deg) translate(-30px, 30px) translateZ(60px); }
	}

	/* 3 — fanned flashcards */
	.fan {
		position: relative;
		width: 120px;
		height: 170px;
		transform-style: preserve-3d;
		transform: rotateX(18deg);
	}
	.card {
		position: absolute;
		inset: 0;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--glass-strong);
		border: 0.5px solid var(--glass-edge);
		box-shadow: 0 24px 40px -20px rgb(0 0 0 / 0.45);
		font-size: 56px;
		transform-origin: 50% 120%;
		animation: deal 1.1s var(--spring) both, float 4s ease-in-out infinite alternate;
		animation-delay: calc(var(--c) * 0.12s), calc(1.2s + var(--c) * 0.2s);
		--r: calc((var(--c) - 2) * 14deg);
		transform: rotateZ(var(--r)) translateZ(calc(var(--c) * 8px));
	}
	.card small {
		font-size: 13px;
		color: var(--ink-3);
		font-weight: 600;
	}
	.card:nth-child(5) {
		background: linear-gradient(135deg, hsl(var(--h) 70% 55%), hsl(calc(var(--h) + 30) 70% 45%));
		color: #fff;
	}
	.card:nth-child(5) small {
		color: rgb(255 255 255 / 0.8);
	}
	@keyframes deal {
		from { transform: rotateZ(0) translateY(60px) translateZ(0); opacity: 0; }
	}
	@keyframes float {
		to { transform: rotateZ(var(--r)) translateY(-8px) translateZ(calc(var(--c) * 8px + 10px)); }
	}

	/* 4 — AI orb with orbiting words */
	.orbit {
		position: relative;
		width: 240px;
		height: 240px;
		transform-style: preserve-3d;
		transform: rotateX(62deg);
		animation: tiltorb 8s ease-in-out infinite alternate;
	}
	.orb {
		position: absolute;
		left: 70px;
		top: 70px;
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fff 0 8%, hsl(var(--h) 90% 70%) 30%, hsl(calc(var(--h) + 40) 80% 45%) 75%);
		box-shadow: 0 0 60px hsl(var(--h) 90% 60% / 0.6);
		transform: rotateX(-62deg);
		animation: pulse 2.4s ease-in-out infinite;
	}
	.moon {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-style: preserve-3d;
		animation: orbit 7s linear infinite;
		animation-delay: calc(var(--o) * -2.33s);
	}
	.moon span {
		display: block;
		transform: translate(-50%, -50%) translateX(118px) rotateZ(0deg) rotateX(-62deg);
		/* counter-rotate so the words stay upright while orbiting */
		animation: upright 7s linear infinite;
		animation-delay: calc(var(--o) * -2.33s);
		padding: var(--space-1h) var(--space-3);
		border-radius: 999px;
		background: var(--glass-strong);
		border: 0.5px solid var(--glass-edge);
		box-shadow: 0 10px 20px -10px rgb(0 0 0 / 0.4);
		font-size: 15px;
		white-space: nowrap;
	}
	@keyframes upright {
		to {
			transform: translate(-50%, -50%) translateX(118px) rotateZ(-360deg) rotateX(-62deg);
		}
	}
	@keyframes orbit {
		to { transform: rotateZ(360deg); }
	}
	@keyframes tiltorb {
		to { transform: rotateX(56deg) rotateZ(8deg); }
	}
	@keyframes pulse {
		50% { box-shadow: 0 0 90px hsl(var(--h) 90% 60% / 0.8); }
	}

	@media (prefers-reduced-motion: reduce) {
		.cube, .tilt, .ink, .pen, .card, .orbit, .orb, .moon, .bg {
			animation: none !important;
		}
		.ink {
			stroke-dashoffset: 0;
		}
	}
</style>
