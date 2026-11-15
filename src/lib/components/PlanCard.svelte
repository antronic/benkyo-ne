<!--
	Today: the plan from the onboarding questions, with each step ticked off as
	it's done. "Adjust" reopens the questions; it hides itself once every step
	is done or when dismissed. People who never answered (installed before
	onboarding existed, or skipped) get a small nudge instead, until they have
	learned a few kana.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { LESSONS } from '#lib/content/lessons.ts';
	import { courseTag, COURSES } from '#lib/content/courses.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { words } from '#lib/state/words.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { DEFAULTS, GOALS, type Step } from '#lib/onboarding/plan.ts';
	import { planFor, profile, s } from '#lib/onboarding/profile.svelte.ts';

	let { i = 1 }: { i?: number } = $props();

	onMount(() => void profile.load());

	const t = $derived(s());
	const p = $derived(profile.value);
	const steps = $derived(p ? planFor(p).filter((x) => x.kind !== 'daily') : []);

	function done(x: Step) {
		if (x.kind === 'lesson') return progress.completed.includes(x.href.split('/').pop()!);
		if (x.kind === 'placement') return LESSONS.some((l) => l.script === x.script && progress.completed.includes(l.id));
		if (x.kind === 'course') {
			const units = COURSES.find((c) => c.id === x.course)?.units ?? [];
			return words.list.some((c) => units.some((u) => c.tags.includes(courseTag(x.course, u.id))));
		}
		return false;
	}
	const allDone = $derived(steps.length > 0 && steps.every(done));
	const nextStep = $derived(steps.find((x) => !done(x)));
	const show = $derived(profile.loaded && (p ? !p.skipped && !p.hidden && !allDone : progress.learnedCount < 10));

	const icon = (x: Step) =>
		x.kind === 'lesson' ? 'あ' : x.kind === 'placement' ? (x.script === 'hiragana' ? 'あ' : 'ア') : (GOALS.find((g) => g.id === p?.goals[0])?.emoji ?? '✨');
	const title = (x: Step) =>
		x.kind === 'lesson' ? t.steps.lesson : x.kind === 'placement' ? t.steps.placement[x.script] : x.kind === 'course' ? t.steps.course(x.course) : '';
</script>

{#if show}
	<section class="glass sheen card plan rise" style:--i={i}>
		{#if p}
			<div class="head">
				<div class="eyebrow">{t.card.title} · {t.steps.daily(p.minutes)}</div>
				<span class="spacer"></span>
				<button class="link" onclick={() => (ui.showOnboarding = true)}>{t.card.adjust}</button>
				<button class="link" onclick={() => profile.hide()} aria-label={t.card.hide}>✕</button>
			</div>
			<ol>
				{#each steps as x, n (x.kind + n)}
					{@const ok = done(x)}
					<li class:ok class:next={x === nextStep}>
						<a href={x.href}>
							<span class="badge" class:jp={x.kind !== 'course'}>{ok ? '✓' : icon(x)}</span>
							<span class="headline">{title(x)}</span>
							<span class="spacer"></span>
							{#if x === nextStep}<span class="go">›</span>{/if}
						</a>
					</li>
				{/each}
			</ol>
		{:else}
			<div class="nudge">
				<div class="stack" style:--gap="2px">
					<div class="headline">{t.card.nudgeTitle}</div>
					<div class="caption">{t.card.nudgeCaption}</div>
				</div>
				<div class="row" style:--gap="6px">
					<button class="btn accent small" onclick={() => (ui.showOnboarding = true)}>{t.card.nudgeGo}</button>
					<button class="link" onclick={() => profile.save(DEFAULTS, true)} aria-label={t.card.hide}>✕</button>
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.plan {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.head,
	.nudge {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.nudge {
		justify-content: space-between;
		gap: 12px;
	}
	.link {
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		padding: 4px 6px;
		cursor: pointer;
	}
	.link[aria-label] {
		color: var(--ink-3);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
		color: inherit;
		text-decoration: none;
	}
	li + li a {
		border-top: 0.5px solid color-mix(in srgb, var(--ink) 9%, transparent);
	}
	.badge {
		width: 32px;
		height: 32px;
		flex: none;
		border-radius: 10px;
		display: grid;
		place-items: center;
		font-size: 16px;
		font-weight: 700;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	li.next .badge {
		color: #fff;
		background: var(--accent);
	}
	li.ok .badge {
		color: #fff;
		background: var(--success);
	}
	li.ok .headline {
		color: var(--ink-3);
		text-decoration: line-through;
	}
	.go {
		font-size: 22px;
		color: var(--ink-3);
	}
</style>
