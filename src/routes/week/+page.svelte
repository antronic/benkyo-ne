<!--
	Weekly report (docs/EVERYDAY.md): what you read, wrote and saved in the last
	7 days, review minutes a day, and one weak spot with a 5 minute drill.
-->
<script lang="ts">
	import { t, tn, fmtDate } from '#lib/i18n/index.svelte.ts';
	import { BarChart, Badge, Button, Card, IconButton, Skeleton, SpeechBubble, StatTile } from '#lib/ui/index.ts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { week } from '#lib/state/week.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { weekStart, type Week } from '#lib/report/week.ts';
	import type { WriteTo } from '#lib/ai/contract.ts';

	ui.hue = 200;
	onMount(() => void week.refresh());

	const now = Date.now();
	const range = `${fmtDate(weekStart(now), { day: 'numeric', month: 'short' })} – ${fmtDate(now, { day: 'numeric', month: 'short' })}`;
	const w = $derived(week.week);
	const quiet = (x: Week) => !x.read && !x.wrote && !x.saved && !x.totalMinutes;
	const who = (to: WriteTo) => t(`write.to.${to}`).toLowerCase();

	/** Kuri's line: what went well, then the weak spot. */
	function kuriLine(x: Week): string {
		const did = [x.read && tn('week.kuri.read', x.read), x.wrote && tn('week.kuri.wrote', x.wrote), x.saved && tn('week.kuri.saved', x.saved)].filter(Boolean) as string[];
		const head = did.length ? t('week.kuri.did', { what: did.join(', ') }) : tn('week.kuri.minutes', x.totalMinutes);
		return x.weak ? `${head} ${t(`week.kuri.next.${x.weak.kind}`)}` : `${head} ${t('week.kuri.keepGoing')}`;
	}
</script>

<main class="week">
	<header class="top">
		<IconButton label={t('common.back')} onclick={() => goto('/')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</IconButton>
		<div class="stack" style:--gap="var(--space-px)">
			<h1 class="title-2">{t('week.title')}</h1>
			<span class="caption">{range}</span>
		</div>
	</header>

	{#if !week.ready || !w}
		<Skeleton variant="card" count={2} label={t('common.loading')} />
	{:else if quiet(w)}
		<Card padding="lg">
			<div class="stack" style:--gap="var(--space-3)">
				<span class="headline">{t('week.quietTitle')}</span>
				<span class="caption">{t('week.quietBody')}</span>
				<div><Button variant="accent" size="sm" href="/review">{t('week.quietGo')}</Button></div>
			</div>
		</Card>
	{:else}
		<section class="stack" style:--gap="var(--space-4)" in:fly={{ y: 16, duration: 350 }}>
			<div class="stats">
				<StatTile label={t('week.read')} value={w.read} note={t('week.readNote')} />
				<StatTile label={t('week.wrote')} value={w.wrote} note={t('week.wroteNote')} />
				<StatTile label={t('week.saved')} value={w.saved} note={t('week.savedNote')} />
			</div>

			<Card padding="md">
				<div class="stack" style:--gap="var(--space-1)">
					<span class="headline">{t('week.minutesTitle')}</span>
					<span class="caption">{tn('week.minutesBody', w.totalMinutes, { days: w.activeDays })}</span>
					<BarChart
						days={w.minutes}
						label={t('week.minutesTitle')}
						column={t('week.minutesColumn')}
						format={(n) => tn('week.min', n)}
						text={{ today: t('week.today'), table: t('week.table'), day: t('week.day'), none: t('week.none'), summary: tn('week.minutesBody', w.totalMinutes, { days: w.activeDays }) }}
					/>
				</div>
			</Card>

			<Card padding="md">
				<div class="stack" style:--gap="var(--space-2)">
					{#if w.weak}
						<div><Badge tone="accent" variant="tag">{t('week.workOn')}</Badge></div>
						{#if w.weak.kind === 'writing'}
							<span class="headline">{t(`week.weak.writing.${w.weak.gap}`, { who: who(w.weak.to) })}</span>
							<span class="caption">{t('week.weak.writingBody', { off: w.weak.off, of: w.weak.of, who: who(w.weak.to) })}</span>
						{:else if w.weak.kind === 'kanji'}
							<span class="headline">{t('week.weak.kanji')} <span class="jp">{w.weak.chars.join(' ')}</span></span>
							<span class="caption">{t('week.weak.kanjiBody')}</span>
						{:else}
							<span class="headline">{t('week.weak.weakest')}</span>
							<span class="caption">{tn('week.weak.weakestBody', w.weak.misses)}</span>
						{/if}
					{/if}
					<SpeechBubble label={t('write.kuriSays')}>{kuriLine(w)}</SpeechBubble>
					{#if w.weak}<div><Button variant="accent" size="sm" href={w.weak.href}>{t('week.practice')}</Button></div>{/if}
				</div>
			</Card>
		</section>
	{/if}
</main>

<style>
	.week {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + var(--space-3)) var(--gutter-r) calc(var(--safe-bottom) + var(--space-6)) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}
</style>
