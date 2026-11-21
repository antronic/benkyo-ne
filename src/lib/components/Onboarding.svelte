<!--
	The plan questions (docs/ONBOARDING.md). `quick` is the first run (docs/UX-FLOW.md): right
	after the intro and before the account, just how much you know and how much a day (plus the
	level for everyday users); the last tap saves and moves on, with no plan page. The full set
	(why, how much you know, how much a day, then the plan they produce) opens from Settings →
	Your plan with the previous answers filled in. Single-choice questions advance on tap; Skip
	keeps the defaults.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '#lib/ios/haptics.ts';
	import { DEFAULTS, GOALS, JLPT_PICKS, LEVELS, MINUTES, type Answers, type Goal, type Level, type Minutes, type Step } from '#lib/onboarding/plan.ts';
	import { LANGS, lang, planFor, profile, s } from '#lib/onboarding/profile.svelte.ts';
	import { Button, Card, IconButton, Segmented } from '#lib/ui/index.ts';

	let { ondone, quick = false }: { ondone: () => void; quick?: boolean } = $props();

	const prev = profile.value;
	const editing = !!prev && !prev.skipped;
	let a = $state<Answers>(editing ? { goals: [...prev.goals], level: prev.level, jlpt: prev.jlpt, minutes: prev.minutes } : { ...DEFAULTS, goals: [] });

	/** Everyday users get one more question: Pick your level. */
	type Page = 'goals' | 'level' | 'jlpt' | 'minutes' | 'plan';
	const pages = $derived<Page[]>(
		quick
			? a.level === 'daily'
				? ['level', 'jlpt', 'minutes']
				: ['level', 'minutes']
			: a.level === 'daily'
				? ['goals', 'level', 'jlpt', 'minutes', 'plan']
				: ['goals', 'level', 'minutes', 'plan']
	);
	const QUESTIONS = $derived(quick ? pages.length : pages.length - 1);
	let step = $state(0);
	const page = $derived(pages[step]);
	let dir = $state(1);
	const t = $derived(s());
	const plan = $derived(planFor(a));
	const HUES: Record<Page, number> = { goals: 8, level: 200, jlpt: 30, minutes: 140, plan: 265 };

	function go(n: number) {
		dir = n > step ? 1 : -1;
		step = n;
	}
	function toggle(g: Goal) {
		a.goals = a.goals.includes(g) ? a.goals.filter((x) => x !== g) : [...a.goals, g];
		haptic('selection');
	}
	let advancing = false;
	function pick<K extends 'level' | 'jlpt' | 'minutes'>(k: K, v: Answers[K]) {
		a[k] = v;
		haptic('selection');
		if (advancing) return;
		advancing = true;
		// let the selection show before moving on
		setTimeout(() => {
			advancing = false;
			// the first run's last question saves and moves on (no plan page)
			if (step + 1 >= pages.length) void finish();
			else go(step + 1);
		}, 260);
	}
	// which action is saving the answers (a quick IndexedDB write)
	let saving = $state<'skip' | 'finish' | null>(null);
	async function skip() {
		haptic('selection');
		// skipping a fresh questionnaire keeps the defaults; skipping an edit changes nothing
		saving = 'skip';
		try {
			if (!profile.value) await profile.save(DEFAULTS, true);
		} finally {
			saving = null;
		}
		ondone();
	}
	async function finish() {
		haptic('success');
		saving = 'finish';
		try {
			await profile.save($state.snapshot(a));
		} finally {
			saving = null;
		}
		ondone();
	}

	function stepIcon(p: Step) {
		if (p.kind === 'lesson') return 'あ';
		if (p.kind === 'placement') return p.script === 'hiragana' ? 'あ' : 'ア';
		if (p.kind === 'course') return GOALS.find((g) => g.id === a.goals[0])?.emoji ?? '✨';
		if (p.kind === 'level') return '📗';
		if (p.kind === 'everyday') return '📖';
		return '⏱';
	}
	function stepTitle(p: Step) {
		if (p.kind === 'lesson') return t.steps.lesson;
		if (p.kind === 'placement') return t.steps.placement[p.script];
		if (p.kind === 'course') return t.steps.course(p.course);
		if (p.kind === 'level') return t.steps.level(p.jlpt);
		if (p.kind === 'everyday') return t.steps.everyday;
		return t.steps.daily(p.minutes);
	}
	function stepCaption(p: Step) {
		if (p.kind === 'lesson') return t.steps.lessonCaption;
		if (p.kind === 'placement') return t.steps.placementCaption;
		if (p.kind === 'course') return t.steps.courseCaption;
		if (p.kind === 'level') return p.ready ? t.steps.levelCaption : t.steps.levelSoon(p.jlpt);
		if (p.kind === 'everyday') return t.steps.everydayCaption;
		return a.level === 'daily' ? t.steps.dailyCaptionEveryday : t.steps.dailyCaption(p.newPerDay);
	}
</script>

<div class="onboard" style:--h={HUES[page]} transition:fade={{ duration: 350 }} role="dialog" aria-modal="true" aria-label={t.planEyebrow}>
	<div class="bg" aria-hidden="true"></div>

	<div class="top">
		<IconButton class={step === 0 ? 'ob-back hidden' : 'ob-back'} onclick={() => go(step - 1)} label={t.back} tabindex={step === 0 ? -1 : 0}>‹</IconButton>
		<div class="dots" aria-hidden="true">
			{#each { length: pages.length } as _, n}<span class:on={n === step} class:past={n < step}></span>{/each}
		</div>
		<Button variant="ghost" size="sm" class={page === 'plan' ? 'ob-skip hidden' : 'ob-skip'} busy={saving === 'skip'} disabled={saving !== null} onclick={skip}>{t.skip}</Button>
	</div>

	<div class="panel">
		{#key step}
			<section class="q" in:fly={{ x: 60 * dir, duration: 450, easing: cubicOut, opacity: 0 }}>
				{#if page === 'goals'}
					{#if LANGS.length > 1}
						<div class="lang">
							<Segmented label={t.langLabel} options={LANGS.map((l) => ({ value: l.code, label: l.name }))} value={lang.code} onchange={(c) => (lang.set(c), haptic('selection'))} />
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
							<Card class={on ? 'ob-tile on' : 'ob-tile'} aria-pressed={on} onclick={() => toggle(g.id)} style="--i: {n}">
								<span class="emoji" aria-hidden="true">{g.emoji}</span>
								<span class="label">{t.goals[g.id]}</span>
								<span class="check" aria-hidden="true">✓</span>
							</Card>
						{/each}
					</div>
					<Button variant="accent" block class="cta" onclick={() => go(1)}>{t.next}</Button>
				{:else if page === 'level'}
					<header>
						<div class="eyebrow">{step + 1} / {QUESTIONS}</div>
						<h2 class="title">{t.levelQ}</h2>
						<p class="subhead">{t.levelHint}</p>
					</header>
					<div class="list" role="radiogroup" aria-label={t.levelQ}>
						{#each LEVELS as l, n (l.id)}
							{@const on = a.level === l.id}
							<Card class={on ? 'ob-opt on' : 'ob-opt'} role="radio" aria-checked={on} onclick={() => pick('level', l.id as Level)} style="--i: {n}">
								<span class="emoji" aria-hidden="true">{l.emoji}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{t.levels[l.id].title}</span>
									<span class="caption">{t.levels[l.id].caption}</span>
								</span>
								<span class="radio" aria-hidden="true"></span>
							</Card>
						{/each}
					</div>
				{:else if page === 'jlpt'}
					<header>
						<div class="eyebrow">{step + 1} / {QUESTIONS}</div>
						<h2 class="title">{t.jlptQ}</h2>
						<p class="subhead">{t.jlptHint}</p>
					</header>
					<div class="list" role="radiogroup" aria-label={t.jlptQ}>
						{#each JLPT_PICKS as j, n (j.id)}
							{@const on = a.jlpt === j.id}
							<Card class={on ? 'ob-opt on' : 'ob-opt'} role="radio" aria-checked={on} onclick={() => pick('jlpt', j.id)} style="--i: {n}">
								<span class="stack" style:--gap="1px">
									<span class="caption">{t.jlpt[j.id].name}</span>
									<span class="headline jp" lang="ja">{j.sample}</span>
									<span class="caption">{t.jlpt[j.id].meaning}</span>
								</span>
								<span class="radio" aria-hidden="true"></span>
							</Card>
						{/each}
					</div>
				{:else if page === 'minutes'}
					<header>
						<div class="eyebrow">{QUESTIONS} / {QUESTIONS}</div>
						<h2 class="title">{t.minutesQ}</h2>
						<p class="subhead">{t.minutesHint}</p>
					</header>
					<div class="list" role="radiogroup" aria-label={t.minutesQ}>
						{#each MINUTES as m, n (m)}
							{@const on = a.minutes === m}
							<Card class={on ? 'ob-opt on' : 'ob-opt'} role="radio" aria-checked={on} onclick={() => pick('minutes', m as Minutes)} style="--i: {n}">
								<span class="num" aria-hidden="true">{m}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{t.minutes[m].title}{#if m === DEFAULTS.minutes}<span class="rec">{t.recommended}</span>{/if}</span>
									<span class="caption">{t.minutes[m].caption}</span>
								</span>
								<span class="radio" aria-hidden="true"></span>
							</Card>
						{/each}
					</div>
				{:else}
					<header>
						<div class="eyebrow">{t.planEyebrow}</div>
						<h2 class="title">{t.planTitle}</h2>
					</header>
					<Card strong padding="none" radius="sheet" class="ob-plan"><ol class="plan">
						{#each plan as p, n (p.kind + n)}
							<li style:--i={n}>
								<span class="badge" class:jp={p.kind === 'lesson' || p.kind === 'placement'}>{stepIcon(p)}</span>
								<span class="stack" style:--gap="1px">
									<span class="headline">{stepTitle(p)}</span>
									<span class="caption">{stepCaption(p)}</span>
								</span>
							</li>
						{/each}
					</ol></Card>
					<p class="caption hint">{t.planHint}</p>
					<Button variant="accent" block class="cta" busy={saving === 'finish'} disabled={saving !== null} onclick={finish}>{t.start}</Button>
					<Button variant="plain" class="ob-change" onclick={() => go(0)}>{t.change}</Button>
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
		padding: calc(var(--safe-top) + var(--space-3)) max(var(--space-5), var(--safe-right)) calc(var(--safe-bottom) + var(--space-5)) max(var(--space-5), var(--safe-left));
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
	.top :global(.ob-back) {
		width: 36px;
		height: 36px;
		color: var(--ink);
		font: inherit;
		font-size: 22px;
		line-height: 1;
	}
	.top :global(.hidden) {
		opacity: 0;
		pointer-events: none;
	}
	.dots {
		display: flex;
		gap: var(--space-1h);
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
		padding-top: var(--space-3);
	}
	.q {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
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
	.lang {
		align-self: flex-start;
		min-width: 200px;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.q :global(.ob-tile),
	.q :global(.ob-opt) {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
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
	.q :global(.ob-tile) {
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		min-height: 96px;
	}
	.label {
		font-weight: 600;
		font-size: 15px;
		line-height: 1.25;
	}
	.emoji {
		font-size: 26px;
		line-height: 1;
	}
	.q :global(.ob-tile:active),
	.q :global(.ob-opt:active) {
		transform: scale(0.96);
	}
	.q :global(.ob-tile.on),
	.q :global(.ob-opt.on) {
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
	.q :global(.ob-tile.on .check) {
		opacity: 1;
		transform: none;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.q :global(.ob-opt) {
		min-height: 68px;
	}
	.q :global(.ob-opt .stack) {
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
		margin-left: var(--space-2);
		padding: var(--space-px) var(--space-2);
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
	.q :global(.ob-opt.on .radio) {
		box-shadow: inset 0 0 0 7px hsl(var(--h) 80% 55%);
	}
	.q :global(.cta) {
		margin-top: var(--space-1h);
		min-height: 52px;
	}
	.plan {
		list-style: none;
		margin: 0;
		padding: var(--space-1h) var(--space-4);
	}
	.plan li {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) 0;
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
	.q :global(.ob-change) {
		align-self: center;
		color: var(--ink-2);
		font-size: 15px;
		font-weight: 400;
	}
	@media (prefers-color-scheme: dark) {
		.rec {
			color: hsl(var(--h) 80% 72%);
		}
	}
</style>
