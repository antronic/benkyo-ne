<!--
	First launch (docs/UX-FLOW.md, phase 3): one page, no slides. A kana cube, one line, the
	interface language, and two ways on: "Get started" (a couple of questions, an account, then
	straight into the first lesson) or "I have an account" (sign in). Replay from Settings →
	About. Reduce Motion: the cube stands still.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';
	import { LANGS, lang } from '#lib/onboarding/profile.svelte.ts';
	import { Button, Segmented } from '#lib/ui/index.ts';

	/** start: a new learner · signIn: an existing account */
	let { ondone }: { ondone: (how: 'start' | 'signIn') => void } = $props();

	const CUBE = ['あ', 'カ', '日', 'さ', 'ね', 'ン'];

	function go(how: 'start' | 'signIn') {
		haptic(how === 'start' ? 'success' : 'selection');
		ondone(how);
	}
</script>

<div class="intro" style:--h={8} transition:fade={{ duration: 400 }} role="dialog" aria-modal="true" aria-label={t('intro.label')}>
	<div class="bg" aria-hidden="true"></div>
	{#if LANGS.length > 1}
		<div class="lang">
			<Segmented label={t('lang.label')} options={LANGS.map((l) => ({ value: l.code, label: l.name, lang: l.code }))} value={lang.code} onchange={(c) => (lang.set(c), haptic('selection'))} />
		</div>
	{/if}

	<div class="stage" aria-hidden="true">
		<div class="cube-wrap" in:fly={{ y: 30, duration: 700, easing: cubicOut, opacity: 0 }}>
			<div class="cube">
				{#each CUBE as k, f}<div class="face f{f}"><span class="jp">{k}</span></div>{/each}
			</div>
		</div>
	</div>

	<div class="copy" in:fly={{ y: 16, duration: 500, delay: 120, easing: cubicOut }}>
		<div>
			<h2 class="large-title">{t('intro.1.title')}</h2>
			<p class="subhead">{t('intro.1.text')}</p>
		</div>
		<Button variant="accent" block onclick={() => go('start')}>{t('intro.start')}</Button>
		<Button variant="plain" block onclick={() => go('signIn')}>{t('intro.haveAccount')}</Button>
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
	.lang {
		position: relative;
		align-self: flex-end;
		z-index: 2;
		width: 11rem;
	}
	.stage {
		position: relative;
		flex: 1;
		display: grid;
		place-items: center;
		perspective: 900px;
		min-height: 260px;
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

	@media (prefers-reduced-motion: reduce) {
		.cube,
		.bg {
			animation: none !important;
		}
	}
</style>
