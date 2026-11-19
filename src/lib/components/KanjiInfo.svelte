<!-- Meaning, origin, parts, readings and an example word for one kanji. -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { c, gloss } from '#lib/i18n/content.ts';
	import Romaji from './Romaji.svelte';
	import KanaGlyph from './KanaGlyph.svelte';
	import { kanjiByChar, ORIGIN_LABEL, showKun, type Kanji } from '#lib/content/kanji.ts';
	import { PART_COLORS, strokesOf } from '#lib/content/strokes.ts';
	import { speak } from '#lib/audio/speech.ts';
	import { Card } from '#lib/ui/index.ts';

	let { kanji, compact = false }: { kanji: Kanji; compact?: boolean } = $props();

	/** The parts as KanjiVG draws them inside this kanji (亻 rather than 人). */
	const parts = $derived.by(() => {
		if (!kanji.parts) return [];
		const g = strokesOf(kanji.char)?.g ?? [];
		return kanji.parts.map((p, i) => {
			const seen = g[i]?.[0];
			return { char: p, shown: seen && seen !== p && !kanjiByChar.has(seen) ? seen : p, meaning: gloss(kanjiByChar.get(p)?.meaning ?? '') };
		});
	});
	// 森 is 木 + 林 to KanjiVG; colour by its own groups only when they line up with the parts
	const colored = $derived((strokesOf(kanji.char)?.g?.length ?? 0) === parts.length);
</script>

<div class="info stack" style:--gap="var(--space-3)">
	<div class="row head">
		<span class="meaning">{gloss(kanji.meaning)}</span>
		<span class="tag {kanji.origin}">{c(ORIGIN_LABEL[kanji.origin])}</span>
	</div>

	{#if parts.length}
		<div class="parts row" aria-label={t('kanji.builtFrom')}>
			{#each parts as p, i}
				{#if i > 0}<span class="op">+</span>{/if}
				<span class="part" style:--c={colored ? PART_COLORS[i % PART_COLORS.length] : 'var(--ink)'}>
					<KanaGlyph char={p.char} size={34} color="var(--c)" scene={0.8} />
					<span class="caption">{p.shown !== p.char ? `${p.shown} ` : ''}{p.meaning}</span>
				</span>
			{/each}
			<span class="op">=</span>
			<span class="part"><KanaGlyph char={kanji.char} size={34} /><span class="caption">{gloss(kanji.meaning)}</span></span>
		</div>
	{/if}

	<p class="story">{c(kanji.story)}</p>

	{#if !compact}
		<dl class="readings">
			{#if kanji.kun.length}
				<dt title={t('kanji.kunTitle')}>kun</dt>
				<dd class="jp">
					{#each kanji.kun as r}<span class="r">{showKun(r)}<Romaji text={r.replace('.', '')} /></span>{/each}
				</dd>
			{/if}
			<dt title={t('kanji.onTitle')}>on</dt>
			<dd class="jp">
				{#each kanji.on as r}<span class="r">{r}<Romaji text={r} /></span>{/each}
			</dd>
		</dl>
		<Card padding="none" class="example" onclick={() => speak(kanji.example.reading)}>
			<span class="jp word">{kanji.example.word}</span>
			<span class="stack" style:--gap="0">
				<span class="jp caption">{kanji.example.reading}<Romaji text={kanji.example.reading} inline /></span>
				<span class="caption">{gloss(kanji.example.gloss)}</span>
			</span>
			<span class="spacer"></span>
			<span aria-hidden="true">🔊</span>
		</Card>
	{/if}
</div>

<style>
	.info {
		width: 100%;
		max-width: 420px;
		text-align: left;
	}
	.head {
		gap: var(--space-3);
		align-items: baseline;
		justify-content: flex-start;
		flex-wrap: wrap;
	}
	.meaning {
		font-family: var(--font-display);
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	.tag {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: var(--space-1) var(--space-2);
		border-radius: 999px;
		background: color-mix(in srgb, var(--success) 18%, transparent);
		color: var(--success);
	}
	.tag.sign {
		background: color-mix(in srgb, var(--accent-2) 18%, transparent);
		color: var(--accent-2);
	}
	.tag.combo {
		background: color-mix(in srgb, #ff6b5a 18%, transparent);
		color: #e0503f;
	}
	.story {
		margin: 0;
		font-size: 1.0625rem;
	}
	.parts {
		gap: var(--space-1h);
		flex-wrap: wrap;
		justify-content: flex-start;
	}
	.part {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-px);
		min-width: 44px;
	}
	.part .caption {
		color: var(--c, var(--ink-2));
		font-weight: 600;
	}
	.op {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--ink-3);
		margin-bottom: var(--space-5);
	}
	.readings {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1h) var(--space-3);
		margin: 0;
		align-items: baseline;
		text-align: left;
	}
	dt {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}
	dd {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		font-size: 1.125rem;
	}
	.r {
		display: inline-flex;
		flex-direction: column;
	}
	.info :global(.example) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		text-align: left;
	}
	.word {
		font-size: 1.5rem;
		font-weight: 600;
	}
</style>
