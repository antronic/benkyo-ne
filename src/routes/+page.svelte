<script lang="ts">
	import { untrack } from 'svelte';
	import { t, tn, fmtDate } from '#lib/i18n/index.svelte.ts';
	import { c, scriptName } from '#lib/i18n/content.ts';
	import { LESSONS } from '#lib/content/lessons.ts';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import ProgressRing from '#lib/ui/ProgressRing.svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import KuriWalker from '#lib/companion/KuriWalker.svelte';
	import { Avatar, Button, Card, NextStep, PlanBadge, SetupCard, Sheet, type SetupItem } from '#lib/ui/index.ts';
	import { firstRun } from '#lib/state/firstRun.svelte.ts';
	import * as api from '#lib/ai/client.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';
	import { pickNext } from '#lib/today/next.ts';
	import { planSteps, stepDone } from '#lib/today/plan.svelte.ts';
	import { profile, s as obStrings } from '#lib/onboarding/profile.svelte.ts';
	import { install } from '#lib/pwa/install.svelte.ts';
	import { avatar } from '#lib/state/avatar.svelte.ts';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { plan } from '#lib/state/plan.svelte.ts';
	import { greetingFor, greetName } from '#lib/greeting.ts';
	import { week } from '#lib/state/week.svelte.ts';
	import { LEVELS, visibleUnits, type JlptLevel } from '#lib/content/levels/index.ts';
	import { levels } from '#lib/state/levels.svelte.ts';
	import { levelUp } from '#lib/practice/levelUp.ts';
	import { openLearnAt } from '#lib/onboarding/profile.svelte.ts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ROUND_SIZE } from '#lib/review/rounds.ts';

	const greeting = greetingFor(new Date().getHours());
	// the weekly report card shows once the week has something in it
	onMount(() => {
		void week.refresh();
		for (const l of LEVELS) void levels.load(l.id);
	});

	// Moving up a level: suggested at 80% of the hardest level you've started (docs/EVERYDAY.md)
	const LEVEL_UP_KEY = 'benkyo.levelUp';
	let levelUpHidden = $state((() => {
		try {
			return localStorage.getItem(LEVEL_UP_KEY);
		} catch {
			return null;
		}
	})());
	const up = $derived.by(() => {
		const units: Partial<Record<JlptLevel, string[]>> = {};
		for (const l of LEVELS) {
			const ids = visibleUnits(levels.units[l.id] ?? [], progress.settings.showDraftUnits).map((u) => u.id);
			if (ids.length) units[l.id] = ids;
		}
		const u = levelUp(units, progress.completed);
		return u && levelUpHidden !== `${u.from}>${u.to}` ? u : null;
	});
	function hideLevelUp() {
		if (!up) return;
		levelUpHidden = `${up.from}>${up.to}`;
		try {
			localStorage.setItem(LEVEL_UP_KEY, levelUpHidden);
		} catch {
			/* it comes back next time, nothing is lost */
		}
	}
	function goUp() {
		if (!up) return;
		openLearnAt(up.to);
		void goto('/learn');
	}
	const thisWeek = $derived(week.week && (week.week.totalMinutes || week.week.saved || week.week.wrote || week.week.read) ? week.week : null);
	const name = $derived(greetName(ai.signedIn ? ai.account?.name : plan.name));

	// The package badge follows the signed-in account (Fleet grant or promo code).
	// Track only who is signed in: the store's own state must not re-run this.
	$effect(() => {
		const id = ai.signedIn ? (ai.account?.id ?? null) : null;
		const accountName = ai.account?.name ?? '';
		const reached = ai.reached;
		untrack(() => {
			if (id !== null) void plan.load(id, accountName);
			// the server says nobody is signed in: forget the cached package
			else if (reached) void plan.load(null);
			// offline launch, server unreachable or not asked yet: last known package on this device
			else plan.restore();
		});
	});

	const next = $derived(LESSONS.find((l) => !progress.completed.includes(l.id)));
	const goal = $derived(progress.settings.newPerDay + Math.max(10, progress.due.length));
	const doneToday = $derived(progress.today.reviews + progress.today.learned);

	onMount(() => void profile.load());

	// The one next step (docs/UX-FLOW.md): reviews, the plan's first step, the next lesson, new words
	const ob = $derived(obStrings());
	const openStep = $derived(planSteps().find((x) => !stepDone(x)));
	const now = $derived(
		pickNext({
			due: progress.due.length,
			newWords: words.newQueue.length,
			planStep: openStep,
			lessonId: next?.id,
			budgetLeft: progress.newBudgetLeft
		})
	);
	const nowLesson = $derived(now.kind === 'lesson' || now.kind === 'rest' ? LESSONS.find((l) => l.id === now.id) : undefined);
	const planTitle = (x: NonNullable<typeof openStep>) =>
		x.kind === 'placement'
			? ob.steps.placement[x.script]
			: x.kind === 'level'
				? ob.steps.level(x.jlpt)
				: x.kind === 'everyday'
					? ob.steps.everyday
					: x.kind === 'course'
						? ob.steps.course(x.course)
						: ob.steps.lesson;
	/** what comes after the hero, as one quiet link */
	const then = $derived.by(() => {
		if (now.kind === 'review' && next && progress.newBudgetLeft > 0)
			return { label: t('home.thenLesson', { lesson: c(next.title) }), href: `/learn/${next.id}` };
		if (now.kind === 'lesson' && openStep?.kind === 'course') return { label: t('home.then', { step: planTitle(openStep) }), href: openStep.href };
		if (now.kind === 'rest') return { label: t('home.restMore'), href: '/learn' };
		return undefined;
	});

	// Set-up steps wait on one card instead of in front of the first lesson
	const SETUP_KEY = 'benkyo.setupCard';
	let setupHidden = $state((() => {
		try {
			return localStorage.getItem(SETUP_KEY) === 'hidden';
		} catch {
			return false;
		}
	})());
	function hideSetup() {
		setupHidden = true;
		try {
			localStorage.setItem(SETUP_KEY, 'hidden');
		} catch {
			/* it comes back next time, nothing is lost */
		}
	}
	let installing = $state(false);
	async function installNow() {
		if (!install.canPrompt) return void (install.showGuide = true);
		installing = true;
		try {
			await install.prompt(); // ui-ok: installing shows busy on the set-up row's button (SetupItem.busy)
		} finally {
			installing = false;
		}
	}
	// The recovery code a passkey sign-up skipped (docs/UX-FLOW.md): a fresh one, shown once
	let code = $state<string | null>(null);
	let making = $state(false);
	async function showCode() {
		making = true;
		try {
			code = (await api.newRecoveryCode()).recoveryCode; // ui-ok: busy shows on the set-up row's button (SetupItem.busy)
		} catch {
			toast(t('setup.codeFailed'), '⚠️', 3200);
		} finally {
			making = false;
		}
	}
	let copying = $state(false);
	async function copyCode() {
		copying = true;
		try {
			await navigator.clipboard.writeText(code ?? '');
			toast(t('setup.codeCopied'), '📋');
		} catch {
			/* still on screen to write down */
		} finally {
			copying = false;
		}
	}
	function codeSaved() {
		code = null;
		void firstRun.setRecoveryPending(false);
	}
	const setup = $derived.by((): SetupItem[] => {
		const items: SetupItem[] = [];
		if (profile.loaded && (!profile.value || profile.value.skipped))
			items.push({ id: 'plan', icon: '🎯', title: t('setup.plan'), body: t('setup.planBody'), action: t('setup.planGo'), onclick: () => (ui.showOnboarding = true) });
		if (ai.signedIn && firstRun.recoveryPending)
			items.push({ id: 'code', icon: '🔑', title: t('setup.code'), body: t('setup.codeBody'), action: t('setup.codeGo'), busy: making, onclick: showCode });
		// the avatar is account data: it waits for the beta consent (after the first lesson)
		if (ai.signedIn && !ai.needsConsent)
			items.push({ id: 'avatar', icon: '🙂', title: t('setup.avatar'), body: t('setup.avatarBody'), done: !!avatar.person, action: t('setup.avatarGo'), onclick: () => (avatar.setup = 'prompt') });
		if (!install.cardHidden || install.installed)
			items.push({
				id: 'install',
				icon: '📲',
				title: t('setup.install'),
				body: t('setup.installBody'),
				done: install.installed || install.justInstalled,
				action: install.canPrompt ? t('install.now') : t('install.showMe'),
				busy: installing,
				onclick: installNow
			});
		return items;
	});
	const setupLeft = $derived(setup.filter((x) => !x.done).length);

	$effect(() => {
		ui.hue = nowLesson?.hue ?? next?.hue ?? 8;
	});
</script>

<main class="page stack dash" style:--gap="var(--space-5)">
	<!-- No .rise on the header itself: an animated transform would trap LargeTitle's fixed title bar inside it. -->
	<header>
		<div class="eyebrow rise">
			{fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
		</div>
		<LargeTitle title={greeting.jp} jp />
		<div class="hello row rise">
			{#if ai.signedIn || avatar.person}<Avatar person={avatar.person} name={name || '?'} size={40} label={t('avatar.yours')} />{/if}
			<span class="title-3">{name ? t('home.greetName', { greeting: t(greeting.key), name }) : t(greeting.key)}</span>
			{#if plan.loading}
				<PlanBadge plan="free" name="" loading loadingLabel={t('home.planLoading')} />
			{:else if plan.value}
				<PlanBadge plan={plan.value.plan} name={plan.value.planName} />
			{/if}
		</div>
	</header>

	<!-- the one thing to do now -->
	<div class="now rise" style="--i: 1">
		{#if now.kind === 'review'}
			<NextStep hue={265} eyebrow={t('home.reviewsDue')} title={tn('home.cards', now.n)} body={now.n > ROUND_SIZE ? t('home.reviewsRounds', { size: ROUND_SIZE }) : t('home.reviewsBody')} action={t('home.startReview')} href="/review" {then}>
				{#snippet art()}<span class="big-count">{now.n}</span>{/snippet}
			</NextStep>
		{:else if now.kind === 'plan'}
			<NextStep hue={200} eyebrow={ob.card.title} title={planTitle(now.step)} action={t('home.start')} href={now.step.href} {then}>
				{#snippet art()}<span class="big-glyph jp">{now.step.kind === 'placement' ? (now.step.script === 'hiragana' ? 'あ' : 'ア') : '語'}</span>{/snippet}
			</NextStep>
		{:else if now.kind === 'lesson' && nowLesson}
			<NextStep
				hue={nowLesson.hue}
				eyebrow="{progress.completed.length ? t('home.upNext') : t('home.startHere')} · {scriptName(nowLesson.script)}"
				title={c(nowLesson.title)}
				body={tn('home.lessonMeta', nowLesson.chars.length)}
				action={t('lesson.start')}
				href="/learn/{nowLesson.id}"
				{then}
			>
				{#snippet art()}
					<span class="glyphs">
						{#each nowLesson.chars.slice(0, 3) as k, i (k.char)}<span style:--j={i}><KanaGlyph char={k.char} size="100%" color="#fff" weight={6} /></span>{/each}
					</span>
				{/snippet}
			</NextStep>
		{:else if now.kind === 'words'}
			<NextStep hue={265} eyebrow={t('nav.words')} title={tn('home.newWordsReady', now.n)} body={t('home.wordsQueued')} action={t('home.learnWords')} href="/review" {then} />
		{:else if now.kind === 'rest'}
			<NextStep done eyebrow={t('nav.today')} title={t('home.restTitle')} body={t('home.restBody')} {then} />
		{:else}
			<NextStep done eyebrow={t('nav.today')} title={t('home.allDoneTitle')} body={t('home.allDoneBody')} />
		{/if}
	</div>

	<Card as="section" sheen padding="md" radius="large" class="today-line rise" style="--i: 2">
		<ProgressRing value={doneToday / goal} size={56} width={7}>
			<span class="ring-num">{doneToday}</span>
		</ProgressRing>
		<div class="stack" style:--gap="var(--space-px)">
			<div class="headline">{t('home.todayCount', { done: doneToday, goal })}</div>
			<div class="caption">{tn('home.streakLine', progress.streak.days)} · {tn('home.learnedLine', progress.learnedCount)}</div>
		</div>
	</Card>

	{#if setupLeft && !setupHidden}
		<div class="rise" style="--i: 3">
			<SetupCard
				title={t('setup.title')}
				count={t('setup.count', { done: setup.length - setupLeft, n: setup.length })}
				items={setup}
				hideLabel={t('setup.hide')}
				doneLabel={t('common.done')}
				ondismiss={hideSetup}
			/>
		</div>
	{/if}

	{#if up}
		<Card as="section" sheen padding="lg" radius="large" class="rise" style="--i: 3">
			<div class="stack" style:--gap="var(--space-3)">
				<div class="stack" style:--gap="var(--space-px)">
					<div class="eyebrow" style="color:var(--accent)">{t('home.levelUpEyebrow')}</div>
					<div class="title-2">{t('home.levelUpTitle', { pct: Math.round(up.done * 100), from: up.from })}</div>
					<div class="subhead">{up.ready ? t('home.levelUpReady', { to: up.to }) : t('home.levelUpSoon', { to: up.to, from: up.from })}</div>
				</div>
				<div class="row prompt-actions">
					<Button variant="ghost" size="md" onclick={hideLevelUp}>{t('avatar.notNow')}</Button>
					{#if up.ready}<Button variant="accent" size="md" class="grow" onclick={goUp}>{t('home.levelUpGo', { to: up.to })}</Button>{/if}
				</div>
			</div>
		</Card>
	{/if}

	{#if thisWeek}
		<Card href="/week" sheen padding="lg" radius="large" class="review rise" style="--i: 4">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="eyebrow" style="color:var(--accent)">{t('home.weekTitle')}</div>
				<div class="subhead">{t('home.weekBody', { minutes: thisWeek.totalMinutes, saved: thisWeek.saved, wrote: thisWeek.wrote })}</div>
			</div>
			<div class="go">›</div>
		</Card>
	{/if}
</main>

<Sheet open={!!code} label={t('setup.codeTitle')} onclose={() => (code = null)}>
	<div class="stack code-sheet" style:--gap="var(--space-3)">
		<h2 class="title-2">{t('setup.codeTitle')}</h2>
		<code>{code}</code>
		<p class="caption">{t('setup.codeOnce')}</p>
		<div class="row" style:--gap="var(--space-3)">
			<Button variant="ghost" busy={copying} onclick={copyCode}>{t('common.copy')}</Button>
			<Button variant="accent" class="grow" onclick={codeSaved}>{t('setup.codeSaved')}</Button>
		</div>
	</div>
</Sheet>

{#if progress.settings.kuri}
	<KuriWalker hidden={ui.showIntro || ui.showOnboarding || ui.showWelcome} />
{/if}

<style>
	/* Unfolded: the next step across the top, the rest in two columns */
	@media (min-width: 600px) {
		.dash {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
		.dash > header,
		.dash > .now {
			grid-column: 1 / -1;
		}
	}
	.code-sheet h2,
	.code-sheet p {
		margin: 0;
	}
	.code-sheet code {
		font-family: ui-monospace, monospace;
		font-size: 1.125rem;
		letter-spacing: 0.05em;
		text-align: center;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--warn) 16%, transparent);
		word-break: break-all;
	}
	.code-sheet :global(.grow) {
		flex: 1;
	}
	/* room under the last card, so Kuri (who walks along the bottom) never has to sit on text */
	.dash {
		padding-bottom: calc(var(--space-8) + 104px); /* ui-ok: Kuri's height (KuriWalker S) */
	}
	.hello {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.dash > :global(.today-line) {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.ring-num {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
	}
	.prompt-actions {
		gap: var(--space-2);
	}
	.prompt-actions :global(.grow) {
		flex: 1;
	}
	.dash > :global(.review) {
		display: flex;
		gap: var(--space-4);
		align-items: center;
	}
	.go {
		margin-left: auto;
		font-size: 34px;
		color: var(--ink-3);
	}
	.glyphs {
		display: flex;
		gap: var(--space-1);
		width: 9rem;
		max-width: 100%;
		opacity: 0.55;
	}
	.glyphs span {
		flex: 1;
		aspect-ratio: 1;
		display: block;
	}
	.big-count {
		font-family: var(--font-display);
		font-size: 4.5rem;
		font-weight: 750;
		line-height: 1;
		opacity: 0.6;
	}
	.big-glyph {
		font-size: 4.5rem;
		line-height: 1;
		opacity: 0.55;
	}
</style>
