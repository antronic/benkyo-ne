<script lang="ts">
	import { t, tn, fmtDate } from '#lib/i18n/index.svelte.ts';
	import { c, scriptName } from '#lib/i18n/content.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { LESSONS } from '#lib/content/lessons.ts';
	import KanaGlyph from '#lib/components/KanaGlyph.svelte';
	import ProgressRing from '#lib/components/ProgressRing.svelte';
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import PlanCard from '#lib/components/PlanCard.svelte';
	import InstallCard from '#lib/components/InstallCard.svelte';
	import KuriWalker from '#lib/companion/KuriWalker.svelte';

	const hour = new Date().getHours();
	const greeting =
		hour < 11
			? { jp: 'おはよう', en: 'home.morning' as const }
			: hour < 18
				? { jp: 'こんにちは', en: 'home.afternoon' as const }
				: { jp: 'こんばんは', en: 'home.evening' as const };

	const next = $derived(LESSONS.find((l) => !progress.completed.includes(l.id)));
	const goal = $derived(progress.settings.newPerDay + Math.max(10, progress.due.length));
	const doneToday = $derived(progress.today.reviews + progress.today.learned);

	$effect(() => {
		ui.hue = next?.hue ?? 8;
	});
</script>

<main class="page stack dash" style:--gap="18px">
	<header class="rise">
		<div class="eyebrow">
			{fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
		</div>
		<LargeTitle title={greeting.jp} jp />
		<p class="subhead" style="margin:4px 0 0">
			{t('home.greetingLine', { greeting: t(greeting.en), tagline: t('home.tagline') })}
		</p>
	</header>

	<section class="glass sheen hero rise" style:--i="1">
		<ProgressRing value={doneToday / goal} size={112} width={11}>
			<div>
				<div class="ring-num">{doneToday}</div>
				<div class="caption">{t('home.of', { n: goal })}</div>
			</div>
		</ProgressRing>
		<div class="stack" style:--gap="4px">
			<div class="headline">{t('nav.today')}</div>
			<div class="subhead">{t('home.reviewedNew', { r: progress.today.reviews, n: progress.today.learned })}</div>
			<div class="row stats" style:--gap="16px">
				<div><b>{progress.streak.days}</b><span class="caption">{t('home.streak')}</span></div>
				<div><b>{progress.learnedCount}</b><span class="caption">{t('home.learned')}</span></div>
				<div><b>{Math.round(progress.settings.retention * 100)}%</b><span class="caption">{t('home.target')}</span></div>
			</div>
		</div>
	</section>

	<PlanCard i={2} />

	<InstallCard i={2} />

	{#if progress.due.length > 0}
		<a href="/review" class="glass sheen card review rise" style:--i="2">
			<div class="stack" style:--gap="2px">
				<div class="eyebrow" style="color:var(--accent)">{t('home.reviewsDue')}</div>
				<div class="title-2">{tn('home.cards', progress.due.length)}</div>
				<div class="subhead">{t('home.reviewsBody')}</div>
			</div>
			<div class="go">›</div>
		</a>
	{/if}

	{#if words.newQueue.length > 0 || words.list.length > 0}
		<a href={words.newQueue.length ? '/review' : '/words'} class="glass sheen card review rise" style:--i="2">
			<div class="stack" style:--gap="2px">
				<div class="eyebrow" style="color:#8b5cf6">{t('nav.words')}</div>
				<div class="title-2">
					{words.newQueue.length ? tn('home.newWordsReady', words.newQueue.length) : tn('home.cards', words.list.length)}
				</div>
				<div class="subhead">{words.newQueue.length ? t('home.wordsQueued') : t('home.wordsEmpty')}</div>
			</div>
			<div class="go">›</div>
		</a>
	{/if}

	{#if next}
		<a href="/learn/{next.id}" class="card lesson rise" style:--i="3" style:--h={next.hue}>
			<div class="lesson-glyphs">
				{#each next.chars.slice(0, 3) as k, i}
					<span style:--j={i}><KanaGlyph char={k.char} size="100%" color="#fff" weight={6} /></span>
				{/each}
			</div>
			<div class="stack" style:--gap="2px">
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
		</a>
	{:else}
		<div class="glass card rise">{t('home.allDone')}</div>
	{/if}

	<section class="glass sheen card tip rise" style:--i="4">
		<div>
			<div class="eyebrow">{t('home.howTitle')}</div>
			<p style="margin:6px 0 0">
				{@html t('home.howBody')}
			</p>
		</div>
	</section>
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
		.dash > header,
		.dash > .tip {
			grid-column: 1 / -1;
		}
		.dash > .lesson {
			grid-row: span 2;
			min-height: 100%;
		}
	}
	.hero {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 20px;
		border-radius: var(--r-l);
	}
	.ring-num {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 700;
		line-height: 1;
	}
	.stats {
		margin-top: 8px;
	}
	.stats div {
		display: flex;
		flex-direction: column;
	}
	.stats b {
		font-size: 1.125rem;
	}
	.card {
		display: flex;
		gap: 16px;
		padding: 20px;
		border-radius: var(--r-l);
		text-decoration: none;
		color: inherit;
		transition: transform 450ms var(--spring);
	}
	a.card:active {
		transform: scale(0.97);
	}
	.review {
		align-items: center;
	}
	.go {
		margin-left: auto;
		font-size: 34px;
		color: var(--ink-3);
	}
	.lesson {
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
	.tip p {
		color: var(--ink-2);
	}
</style>
