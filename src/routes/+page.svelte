<script lang="ts">
	import { untrack } from 'svelte';
	import { t, tn, fmtDate } from '#lib/i18n/index.svelte.ts';
	import { c, scriptName } from '#lib/i18n/content.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { LESSONS } from '#lib/content/lessons.ts';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import ProgressRing from '#lib/ui/ProgressRing.svelte';
	import LargeTitle from '#lib/ui/LargeTitle.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import PlanCard from '#lib/components/PlanCard.svelte';
	import InstallCard from '#lib/components/InstallCard.svelte';
	import KuriWalker from '#lib/companion/KuriWalker.svelte';
	import { Avatar, Button, Card, PlanBadge } from '#lib/ui/index.ts';
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

	// three made-up avatars on the one-time prompt card
	const PROMPT_TRIO = [
		{ hair: 'bob', hairColor: 'black', skin: 's2' },
		{ head: 'hijab', headColor: 'matcha', skin: 's5', cloth: 'sand' },
		{ hair: 'afro', hairColor: 'black', skin: 's9', cloth: 'sumire' }
	] as const;
	let notNow = $state(false);
	async function laterPrompt() {
		notNow = true;
		try {
			await avatar.later();
		} catch {
			// offline: the card comes back next time, nothing is lost
		} finally {
			notNow = false;
		}
	}

	const next = $derived(LESSONS.find((l) => !progress.completed.includes(l.id)));
	const goal = $derived(progress.settings.newPerDay + Math.max(10, progress.due.length));
	const doneToday = $derived(progress.today.reviews + progress.today.learned);

	$effect(() => {
		ui.hue = next?.hue ?? 8;
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

	{#if avatar.prompt}
		<!-- one-time prompt for accounts made before avatars (docs/AVATAR.md) -->
		<Card as="section" padding="lg" class="avatar-prompt rise">
			<div class="trio" aria-hidden="true">
				{#each PROMPT_TRIO as p, i (i)}<Avatar person={p} size={56} />{/each}
			</div>
			<div class="stack" style:--gap="var(--space-1)">
				<b class="headline">{t('avatar.promptTitle')}</b>
				<span class="subhead">{t('avatar.promptBody')}</span>
			</div>
			<div class="row prompt-actions">
				<Button variant="ghost" size="md" busy={notNow} onclick={laterPrompt}>{t('avatar.notNow')}</Button>
				<Button variant="accent" size="md" class="grow" onclick={() => (avatar.setup = 'prompt')}>{t('avatar.makeIt')}</Button>
			</div>
		</Card>
	{/if}

	<Card as="section" sheen padding="lg" radius="large" class="hero rise" style="--i: 1">
		<ProgressRing value={doneToday / goal} size={112} width={11}>
			<div>
				<div class="ring-num">{doneToday}</div>
				<div class="caption">{t('home.of', { n: goal })}</div>
			</div>
		</ProgressRing>
		<div class="stack" style:--gap="var(--space-1)">
			<div class="headline">{t('nav.today')}</div>
			<div class="subhead">{t('home.reviewedNew', { r: progress.today.reviews, n: progress.today.learned })}</div>
			<div class="row stats" style:--gap="var(--space-4)">
				<div><b>{progress.streak.days}</b><span class="caption">{t('home.streak')}</span></div>
				<div><b>{progress.learnedCount}</b><span class="caption">{t('home.learned')}</span></div>
			</div>
		</div>
	</Card>

	<PlanCard i={2} />

	{#if up}
		<Card as="section" sheen padding="lg" radius="large" class="rise" style="--i: 2">
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

	<InstallCard i={2} />

	{#if progress.due.length > 0}
		<Card href="/review" sheen padding="lg" radius="large" class="review rise" style="--i: 2">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="eyebrow" style="color:var(--accent)">{t('home.reviewsDue')}</div>
				<div class="title-2">{tn('home.cards', progress.due.length)}</div>
				<div class="subhead">{t('home.reviewsBody')}</div>
			</div>
			<div class="go">›</div>
		</Card>
	{/if}

	{#if words.newQueue.length > 0 || words.list.length > 0}
		<Card href={words.newQueue.length ? '/review' : '/words'} sheen padding="lg" radius="large" class="review rise" style="--i: 2">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="eyebrow" style="color:#8b5cf6">{t('nav.words')}</div>
				<div class="title-2">
					{words.newQueue.length ? tn('home.newWordsReady', words.newQueue.length) : tn('home.cards', words.list.length)}
				</div>
				<div class="subhead">{words.newQueue.length ? t('home.wordsQueued') : t('home.wordsEmpty')}</div>
			</div>
			<div class="go">›</div>
		</Card>
	{/if}

	{#if next}
		<Card href="/learn/{next.id}" padding="lg" radius="large" class="lesson rise" style="--i: 3; --h: {next.hue}">
			<div class="lesson-glyphs">
				{#each next.chars.slice(0, 3) as k, i}
					<span style:--j={i}><KanaGlyph char={k.char} size="100%" color="#fff" weight={6} /></span>
				{/each}
			</div>
			<div class="stack" style:--gap="var(--space-px)">
				<div class="eyebrow" style="color:rgb(255 255 255 / .75)">
					{progress.completed.length ? t('home.upNext') : t('home.startHere')} · {scriptName(next.script)}
				</div>
				<div class="title-2">{c(next.title)}</div>
				<div class="jp" style="opacity:.85">{next.subtitle}</div>
				<div class="hero-rmj"><Romaji text={next.subtitle} /></div>
			</div>
			{#if progress.newBudgetLeft === 0}
				<div class="caption" style="color:#fff;opacity:.9">
					{t('home.limit')}
				</div>
			{/if}
		</Card>
	{:else}
		<Card padding="lg" radius="large" class="rise">{t('home.allDone')}</Card>
	{/if}

	{#if thisWeek}
		<Card href="/week" sheen padding="lg" radius="large" class="review rise" style="--i: 3">
			<div class="stack" style:--gap="var(--space-px)">
				<div class="eyebrow" style="color:var(--accent)">{t('home.weekTitle')}</div>
				<div class="subhead">{t('home.weekBody', { minutes: thisWeek.totalMinutes, saved: thisWeek.saved, wrote: thisWeek.wrote })}</div>
			</div>
			<div class="go">›</div>
		</Card>
	{/if}
</main>

{#if progress.settings.kuri}
	<KuriWalker hidden={ui.showKuriIntro || ui.showIntro || ui.showOnboarding || ui.showWelcome} />
{/if}

<style>
	/* Unfolded: dashboard in two columns */
	@media (min-width: 600px) {
		.dash {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
		}
		.dash > header {
			grid-column: 1 / -1;
		}
		.dash > :global(.lesson.lesson) {
			grid-row: span 2;
			min-height: 100%;
		}
	}
	.dash > :global(.hero) {
		display: flex;
		align-items: center;
		gap: var(--space-5);
	}
	:global(.avatar-prompt) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.trio {
		display: flex;
		gap: var(--space-2);
	}
	.prompt-actions {
		gap: var(--space-2);
	}
	.prompt-actions :global(.grow) {
		flex: 1;
	}
	.hello {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.ring-num {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 700;
		line-height: 1;
	}
	.stats {
		margin-top: var(--space-2);
	}
	.stats div {
		display: flex;
		flex-direction: column;
	}
	.stats b {
		font-size: 1.125rem;
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
	.dash > :global(.lesson) {
		display: flex;
		gap: var(--space-4);
		flex-direction: column;
		color: #fff;
		min-height: 220px;
		justify-content: flex-end;
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(120% 90% at 100% 0%, hsl(calc(var(--h) + 30) 90% 62%) 0%, transparent 60%),
			linear-gradient(160deg, hsl(var(--h) 80% 55%), hsl(calc(var(--h) + 330) 70% 42%));
		box-shadow: 0 24px 48px -20px hsl(var(--h) 70% 40% / 0.6);
		view-transition-name: lesson-hero;
	}
	.lesson-glyphs {
		position: absolute;
		right: -6px;
		top: 6px;
		display: flex;
		opacity: 0.35;
	}
	.lesson-glyphs span {
		width: 92px;
		height: 92px;
		transform: rotate(calc(-8deg + var(--j) * 8deg)) translateY(calc(var(--j) * 16px));
	}
	.hero-rmj :global(.rmj) {
		color: rgb(255 255 255 / 0.75);
		font-size: 0.8125rem;
	}
</style>
