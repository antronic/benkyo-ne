<!--
	First-run questionnaire, right after the introduction and before the beta
	sign-up, so it works signed out too. Three tappable questions (why, how much
	you know, how much a day), then the plan they produce. Single-choice
	questions advance on tap; Skip keeps the defaults. Reopened from the Today
	plan card with the previous answers filled in.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';
	import { DEFAULTS, GOALS, LEVELS, MINUTES, type Answers, type Goal, type Level, type Minutes, type Step } from '#lib/onboarding/plan.ts';
	import { LANGS, lang, planFor, profile, s } from '#lib/onboarding/profile.svelte.ts';

	let { ondone }: { ondone: (start?: string) => void } = $props();

	const prev = profile.value;
	const editing = !!prev && !prev.skipped;
	let a = $state<Answers>(editing ? { goals: [...prev.goals], level: prev.level, minutes: prev.minutes } : { ...DEFAULTS, goals: [] });

	const QUESTIONS = 3;
	let step = $state(0);
	let dir = $state(1);
	const t = $derived(s());
	const plan = $derived(planFor(a));
	const HUES = [8, 200, 140, 265];

	function go(n: number) {
		dir = n > step ? 1 : -1;
		step = n;
	}
	function toggle(g: Goal) {
		a.goals = a.goals.includes(g) ? a.goals.filter((x) => x !== g) : [...a.goals, g];
		haptic('selection');
	}
	let advancing = false;
	function pick<K extends 'level' | 'minutes'>(k: K, v: Answers[K]) {
		a[k] = v;
		haptic('selection');
		if (advancing) return;
		advancing = true;
		// let the selection show before moving on
		setTimeout(() => ((advancing = false), go(step + 1)), 260);
	}
	async function skip() {
		haptic('selection');
		// skipping a fresh questionnaire keeps the defaults; skipping an edit changes nothing
		if (!profile.value) await profile.save(DEFAULTS, true);
		ondone();
	}
	async function finish() {
		haptic('success');
		await profile.save($state.snapshot(a));
		const first = plan.find((p) => p.kind !== 'daily') as Exclude<Step, { kind: 'daily' }> | undefined;
		ondone(first?.href);
	}

	const stepIcon = (p: Step) =>
		p.kind === 'lesson' ? 'あ' : p.kind === 'placement' ? (p.script === 'hiragana' ? 'あ' : 'ア') : p.kind === 'course' ? (GOALS.find((g) => g.id === a.goals[0])?.emoji ?? '✨') : '⏱';
	const stepTitle = (p: Step) =>
		p.kind === 'lesson' ? t.steps.lesson : p.kind === 'placement' ? t.steps.placement[p.script] : p.kind === 'course' ? t.steps.course(p.course) : t.steps.daily(p.minutes);
	const stepCaption = (p: Step) =>
		p.kind === 'lesson' ? t.steps.lessonCaption : p.kind === 'placement' ? t.steps.placementCaption : p.kind === 'course' ? t.steps.courseCaption : t.steps.dailyCaption(p.newPerDay);
</script>

<div class="onboard" style:--h={HUES[step]} transition:fade={{ duration: 350 }} role="dialog" aria-modal="true" aria-label={t.planEyebrow}>
	<div class="bg" aria-hidden="true"></div>

	<div class="top">
		<button class="pill" class:hidden={step === 0} onclick={() => go(step - 1)} aria-label={t.back} tabindex={step === 0 ? -1 : 0}>‹</button>
		<div class="dots" aria-hidden="true">
			{#each { length: QUESTIONS + 1 } as _, n}<span class:on={n === step} class:past={n < step}></span>{/each}
		</div>
		<button class="pill text" onclick={skip} class:hidden={step === QUESTIONS}>{t.skip}</button>
	</div>

	<div class="panel">
		{#key step}
			<section class="q" in:fly={{ x: 60 * dir, duration: 450, easing: cubicOut, opacity: 0 }}>
				{#if step === 0}
					{#if LANGS.length > 1}
						<div class="seg" role="radiogroup" aria-label={t.langLabel}>
							{#each LANGS as l (l.code)}
								<button role="radio" aria-checked={lang.code === l.code} class:on={lang.code === l.code} lang={l.code} onclick={() => (lang.set(l.code), haptic('selection'))}>{l.name}</button>
							{/each}
						</div>
					{/if}
					<header>
						<div class="eyebrow">{t.eyebrow}</div>
						<h2 class="title">{t.goalQ}</h2>
						<p class="subhead">{t.goalHint}</p>
					</header>
					<div class="grid">
						{#each GOALS as g, n (g.id)}
							{@const on = a.goals.includes(g.id)}
							<button class="tile glass" class:on aria-pressed={on} onclick={() => toggle(g.id)} style:--i={n}>
								<span class="emoji" aria-hidden="true">{g.emoji}</span>
								<span class="label">{t.goals[g.id]}</span>
								<span class="check" aria-hidden="true">✓</span>
							</button>
						{/each}
					</div>
					<button class="btn accent block cta" onclick={() => go(1)}>{t.next}</button>
				{:else if step === 1}
					<header>
						<div class="eyebrow">2 / {QUESTIONS}</div>
						<h2 class="title">{t.levelQ}</h2>
						<p class="subhead">{t.levelHint}</p>
					</header>
					<div class="list" role="radiogroup" aria-label={t.levelQ}>
						{#each LEVELS as l, n (l.id)}
							{@const on = a.level === l.id}
							<button class="row-opt glass" class:on role="radio" aria-checked={on} onclick={() => pick('level', l.id as Level)} style:--i={n}>
								<span class="emoji" aria-hidden="true">{l.emoji}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{t.levels[l.id].title}</span>
									<span class="caption">{t.levels[l.id].caption}</span>
								</span>
								<span class="radio" aria-hidden="true"></span>
							</button>
						{/each}
					</div>
				{:else if step === 2}
					<header>
						<div class="eyebrow">3 / {QUESTIONS}</div>
						<h2 class="title">{t.minutesQ}</h2>
						<p class="subhead">{t.minutesHint}</p>
					</header>
					<div class="list" role="radiogroup" aria-label={t.minutesQ}>
						{#each MINUTES as m, n (m)}
							{@const on = a.minutes === m}
							<button class="row-opt glass" class:on role="radio" aria-checked={on} onclick={() => pick('minutes', m as Minutes)} style:--i={n}>
								<span class="num" aria-hidden="true">{m}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{t.minutes[m].title}{#if m === DEFAULTS.minutes}<span class="rec">{t.recommended}</span>{/if}</span>
									<span class="caption">{t.minutes[m].caption}</span>
								</span>
								<span class="radio" aria-hidden="true"></span>
							</button>
						{/each}
					</div>
				{:else}
					<header>
						<div class="eyebrow">{t.planEyebrow}</div>
						<h2 class="title">{t.planTitle}</h2>
					</header>
					<ol class="plan glass glass-strong">
						{#each plan as p, n (p.kind + n)}
							<li style:--i={n}>
								<span class="badge" class:jp={p.kind === 'lesson' || p.kind === 'placement'}>{stepIcon(p)}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{stepTitle(p)}</span>
									<span class="caption">{stepCaption(p)}</span>
								</span>
							</li>
						{/each}
					</ol>
					<p class="caption hint">{t.planHint}</p>
					<button class="btn accent block cta" onclick={finish}>{t.start}</button>
					<button class="link" onclick={() => go(0)}>{t.change}</button>
				{/if}
			</section>
		{/key}
	</div>
</div>

<style>
	.onboard {
		position: fixed;
		inset: 0;
		z-index: 150;
		display: flex;
		flex-direction: column;
		padding: calc(var(--safe-top) + 12px) max(20px, var(--safe-right)) calc(var(--safe-bottom) + 20px) max(20px, var(--safe-left));
		background: var(--bg);
		overflow-y: auto;
	}
	.bg {
		position: fixed;
		inset: -20%;
		background:
			radial-gradient(40% 35% at 25% 20%, hsl(var(--h) 85% 62% / 0.36), transparent 70%),
			radial-gradient(45% 40% at 80% 80%, hsl(calc(var(--h) + 60) 80% 60% / 0.26), transparent 70%);
		filter: blur(30px);
		transition: background 700ms ease-out;
		pointer-events: none;
	}
	.top {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: 460px;
		margin: 0 auto;
		min-height: 36px;
	}
	.pill {
		min-width: 36px;
		height: 36px;
		border: 0;
		border-radius: 999px;
		background: var(--glass);
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		color: var(--ink);
		font: inherit;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		transition: transform 300ms var(--spring), opacity 200ms;
	}
	.pill.text {
		font-size: 15px;
		font-weight: 600;
		padding: 0 16px;
	}
	.pill:active {
		transform: scale(0.9);
	}
	.pill.hidden {
		opacity: 0;
		pointer-events: none;
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots span {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: var(--ink-3);
		transition: width 400ms var(--spring), background 300ms;
	}
	.dots span.past {
		background: hsl(var(--h) 70% 55% / 0.6);
	}
	.dots span.on {
		width: 24px;
		background: hsl(var(--h) 80% 55%);
	}
	.panel {
		position: relative;
		width: 100%;
		max-width: 460px;
		margin: auto;
		padding-top: 12px;
	}
	.q {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(26px, 7vw, 32px);
		line-height: 1.15;
		letter-spacing: -0.02em;
	}
	header .subhead {
		margin: 0;
	}
	.seg {
		display: flex;
		align-self: flex-start;
		padding: 3px;
		gap: 2px;
		border-radius: 999px;
		background: var(--glass);
		border: 0.5px solid var(--glass-edge);
	}
	.seg button {
		border: 0;
		background: transparent;
		color: var(--ink-2);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		padding: 6px 14px;
		border-radius: 999px;
		cursor: pointer;
	}
	.seg button.on {
		background: var(--ink);
		color: var(--bg);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.tile,
	.row-opt {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		border-radius: var(--r-m);
		transition:
			transform 320ms var(--spring),
			box-shadow 200ms,
			background 200ms;
		animation: pop 500ms var(--spring) both;
		animation-delay: calc(var(--i, 0) * 40ms);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
	}
	.tile {
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 14px;
		min-height: 96px;
	}
	.tile .label {
		font-weight: 600;
		font-size: 15px;
		line-height: 1.25;
	}
	.emoji {
		font-size: 26px;
		line-height: 1;
	}
	.tile:active,
	.row-opt:active {
		transform: scale(0.96);
	}
	.tile.on,
	.row-opt.on {
		background: color-mix(in srgb, hsl(var(--h) 80% 55%) 16%, var(--glass-strong));
		box-shadow:
			inset 0 0 0 2px hsl(var(--h) 80% 55%),
			var(--glass-shadow);
	}
	.check {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		background: hsl(var(--h) 80% 55%);
		opacity: 0;
		transform: scale(0.5);
		transition: transform 300ms var(--spring-bouncy), opacity 150ms;
	}
	.tile.on .check {
		opacity: 1;
		transform: none;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.row-opt {
		padding: 14px 16px;
		min-height: 68px;
	}
	.row-opt .stack {
		flex: 1;
	}
	.num {
		width: 36px;
		height: 36px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.rec {
		margin-left: 8px;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		vertical-align: 2px;
		color: hsl(var(--h) 70% 38%);
		background: hsl(var(--h) 80% 55% / 0.16);
	}
	.radio {
		width: 22px;
		height: 22px;
		flex: none;
		border-radius: 50%;
		box-shadow: inset 0 0 0 2px var(--ink-3);
		transition: box-shadow 250ms var(--spring);
	}
	.row-opt.on .radio {
		box-shadow: inset 0 0 0 7px hsl(var(--h) 80% 55%);
	}
	.cta {
		margin-top: 6px;
		min-height: 52px;
	}
	.plan {
		list-style: none;
		margin: 0;
		padding: 6px 16px;
		border-radius: var(--r-l);
	}
	.plan li {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 0;
		animation: pop 550ms var(--spring) both;
		animation-delay: calc(80ms + var(--i, 0) * 90ms);
	}
	.plan li + li {
		border-top: 0.5px solid color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.badge {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 13px;
		display: grid;
		place-items: center;
		font-size: 20px;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(140deg, hsl(var(--h) 80% 62%), hsl(calc(var(--h) + 30) 75% 50%));
	}
	.hint {
		margin: 0;
		text-align: center;
	}
	.link {
		align-self: center;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: 15px;
		padding: 6px 10px;
		cursor: pointer;
	}
	@media (prefers-color-scheme: dark) {
		.rec {
			color: hsl(var(--h) 80% 72%);
		}
	}
</style>
