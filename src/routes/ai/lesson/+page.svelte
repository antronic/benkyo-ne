<!--
	"Make a new lesson pack": topic → AI designs a unit → every item is
	checked against the dictionary → save → it appears in Learn ("My packs").
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import * as api from '#lib/ai/client.ts';
	import type { LessonResponse } from '#lib/ai/contract.ts';
	import type { CourseItem } from '#lib/content/courses.ts';
	import { verifyItem } from '#lib/dict/dict.ts';
	import { speak } from '#lib/content/kana.ts';
	import Romaji from '#lib/components/Romaji.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { lessonPacks } from '#lib/state/lessonPacks.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { toast } from '#lib/ios/overlay.svelte.ts';

	ui.hue = 265;
	const IDEAS = ['At the train station', 'Ordering coffee', 'Asking for directions', 'Talking about the weather', 'At the doctor', 'Anime phrases', 'Numbers & money', 'Convenience store'];
	let topic = $state('');
	let busy = $state(false);
	let draft = $state<(LessonResponse & { checked: (CourseItem & { verified: boolean })[] }) | null>(null);

	async function generate() {
		if (!topic.trim() || busy) return;
		busy = true;
		draft = null;
		try {
			const r = await api.lesson({ topic: topic.trim(), knownKana: [...progress.knownKana], secondLang: progress.settings.secondLang });
			const checked = await Promise.all(
				r.items.map(async (i) => {
					const v = await verifyItem({ text: i.text, reading: i.reading });
					return {
						reading: i.reading,
						kanji: i.text !== i.reading ? i.text : undefined,
						gloss: v.hit?.gloss && i.kind === 'word' ? i.gloss : i.gloss,
						kind: i.kind,
						note: i.note?.en,
						verified: v.verified || !v.available
					};
				})
			);
			draft = { ...r, checked };
			haptic('success');
		} catch (e) {
			haptic('error');
			toast(e instanceof Error ? e.message : 'Couldn’t make the lesson', '⚠️', 2800);
		} finally {
			busy = false;
		}
	}

	async function save() {
		if (!draft) return;
		const id = `p${Date.now().toString(36)}`;
		await lessonPacks.add({
			id,
			topic: topic.trim(),
			title: draft.title,
			blurb: draft.blurb,
			items: draft.checked.map(({ verified: _v, ...i }) => i),
			createdAt: Date.now()
		});
		haptic('success');
		toast('Lesson pack saved to Learn', '✓');
		goto(`/learn/course/mine/${id}`);
	}
</script>

<main class="maker">
	<header class="top">
		<button class="icon-btn" aria-label="Back" onclick={() => goto('/ai')}>
			<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<h1 class="title-2">New lesson pack</h1>
	</header>

	<form class="stack" style:--gap="10px" onsubmit={(e) => (e.preventDefault(), generate())}>
		<input type="text" bind:value={topic} placeholder="Topic, e.g. at the train station" aria-label="Lesson topic" enterkeyhint="go" autocomplete="off" />
		<div class="ideas">
			{#each IDEAS as idea}<button type="button" class="chip" onclick={() => (topic = idea)}>{idea}</button>{/each}
		</div>
		<button class="btn accent block" disabled={busy || !topic.trim() || !ai.available}>{busy ? 'Designing your lesson…' : '✨ Make lesson'}</button>
		{#if !ai.available}<p class="caption">{ai.reason}</p>{/if}
	</form>

	{#if draft}
		<section class="stack draft" style:--gap="10px" in:fly={{ y: 16, duration: 350 }}>
			<div>
				<h2 class="title-2">{draft.title.en}</h2>
				{#if draft.title.second}<p class="caption">{draft.title.second}</p>{/if}
				<p class="subhead">{draft.blurb.en}</p>
			</div>
			{#each draft.checked as i}
				<div class="item glass">
					<button class="say" aria-label="Listen" onclick={() => speak(i.reading)}>🔊</button>
					<div class="body">
						<div class="row" style:--gap="6px">
							<span class="jp reading">{i.reading}</span>
							{#if i.kind === 'phrase'}<span class="tag">phrase</span>{/if}
							{#if !i.verified}<span class="tag warn">unverified</span>{/if}
						</div>
						<Romaji text={i.reading} />
						{#if i.kanji}<span class="jp kanji">{i.kanji}</span>{/if}
						<span>{i.gloss}</span>
						{#if i.note}<span class="caption">💬 {i.note}</span>{/if}
					</div>
				</div>
			{/each}
			<div class="row">
				<button class="btn ghost block" onclick={generate} disabled={busy}>↻ Try again</button>
				<button class="btn accent block" onclick={save}>Save to Learn</button>
			</div>
		</section>
	{/if}
</main>

<style>
	.maker {
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(var(--safe-top) + 12px) var(--gutter-r) calc(var(--safe-bottom) + var(--kb) + 24px) var(--gutter-l);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.ideas {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		border-radius: 999px;
		padding: 0 14px;
		min-height: 36px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.item {
		display: flex;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--r-m);
	}
	.say {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 0.5px solid var(--hairline);
		background: var(--glass-strong);
		cursor: pointer;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.reading {
		font-size: 1.25rem;
		font-weight: 600;
	}
	.kanji {
		color: var(--ink-2);
	}
	.tag {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--hairline);
	}
	.tag.warn {
		background: color-mix(in srgb, var(--warn) 35%, transparent);
	}
</style>
