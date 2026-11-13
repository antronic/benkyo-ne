<script lang="ts">
	import { LESSONS } from '#lib/content/lessons.ts';
	import { cardId } from '#lib/content/lessons.ts';
	import { retrievability } from '#lib/srs/fsrs.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	ui.hue = 30;
	const nextId = $derived(LESSONS.find((l) => !progress.completed.includes(l.id))?.id);

	/** Average predicted recall for a lesson's kana (0..1), null if unstarted. */
	function strength(id: string): number | null {
		const l = LESSONS.find((x) => x.id === id)!;
		const cs = l.chars.map((k) => progress.cards[cardId(k)]).filter(Boolean);
		if (!cs.length) return null;
		const now = Date.now();
		return cs.reduce((a, c) => a + (c.lastReview ? retrievability((now - c.lastReview) / 864e5, Math.max(c.stability, 0.01)) : 0), 0) / l.chars.length;
	}
</script>

<main class="page stack" style:--gap="10px">
	<h1 class="large-title rise">Learn</h1>
	<p class="subhead rise" style="margin:0 0 10px">One row at a time, up to five new characters a lesson.</p>

	{#each ['hiragana', 'katakana'] as script, si}
		<h2 class="eyebrow section rise" style:--i={si * 8}>{script} · <span class="jp">{script === 'hiragana' ? 'ひらがな' : 'カタカナ'}</span></h2>
		<ol class="path">
			{#each LESSONS.filter((l) => l.script === script) as l, i}
				{@const done = progress.completed.includes(l.id)}
				{@const s = strength(l.id)}
				<li class="rise" style:--i={si * 8 + i + 1}>
					<a href="/learn/{l.id}" class="glass sheen lesson" class:next={l.id === nextId} class:done style:--h={l.hue}>
						<span class="badge">{done ? '✓' : i + 1}</span>
						<span class="stack" style:--gap="1px">
							<span class="headline">{l.title}</span>
							<span class="jp kana">{l.subtitle}</span>
						</span>
						<span class="spacer"></span>
						{#if s !== null}
							<span class="meter" title="Predicted recall"><span style:width="{Math.round(s * 100)}%"></span></span>
						{:else if l.id === nextId}
							<span class="start">Start</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	{/each}
</main>

<style>
	.section {
		margin: 18px 4px 4px;
	}
	.path {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.lesson {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		text-decoration: none;
		color: inherit;
		transition: transform 450ms var(--spring);
	}
	.lesson:active {
		transform: scale(0.97);
	}
	.lesson.next {
		box-shadow:
			0 0 0 2px hsl(var(--h) 80% 55%),
			var(--glass-shadow);
	}
	.badge {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(150deg, hsl(var(--h) 85% 60%), hsl(calc(var(--h) + 330) 70% 45%));
	}
	.done .badge {
		background: var(--success);
	}
	.kana {
		color: var(--ink-2);
		letter-spacing: 0.15em;
	}
	.meter {
		width: 56px;
		height: 6px;
		border-radius: 3px;
		background: var(--hairline);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--success);
		border-radius: 3px;
	}
	.start {
		font-weight: 600;
		color: hsl(var(--h) 80% 50%);
	}
</style>
