<!-- Meaning, origin, parts, readings and an example word for one kanji. -->
<script lang="ts">
	import Romaji from './Romaji.svelte';
	import KanaGlyph from './KanaGlyph.svelte';
	import { kanjiByChar, ORIGIN_LABEL, showKun, type Kanji } from '#lib/content/kanji.ts';
	import { PART_COLORS, strokesOf } from '#lib/content/strokes.ts';
	import { speak } from '#lib/audio/speech.ts';

	let { kanji, compact = false }: { kanji: Kanji; compact?: boolean } = $props();

	/** The parts as KanjiVG draws them inside this kanji (亻 rather than 人). */
	const parts = $derived.by(() => {
		if (!kanji.parts) return [];
		const g = strokesOf(kanji.char)?.g ?? [];
		return kanji.parts.map((p, i) => {
			const seen = g[i]?.[0];
			return { char: p, shown: seen && seen !== p && !kanjiByChar.has(seen) ? seen : p, meaning: kanjiByChar.get(p)?.meaning ?? '' };
		});
	});
	// 森 is 木 + 林 to KanjiVG; colour by its own groups only when they line up with the parts
	const colored = $derived((strokesOf(kanji.char)?.g?.length ?? 0) === parts.length);
</script>

<div class="info stack" style:--gap="10px">
	<div class="row head">
		<span class="meaning">{kanji.meaning}</span>
		<span class="tag {kanji.origin}">{ORIGIN_LABEL[kanji.origin]}</span>
	</div>

	{#if parts.length}
		<div class="parts row" aria-label="Built from">
			{#each parts as p, i}
				{#if i > 0}<span class="op">+</span>{/if}
				<span class="part" style:--c={colored ? PART_COLORS[i % PART_COLORS.length] : 'var(--ink)'}>
					<KanaGlyph char={p.char} size={34} color="var(--c)" scene={0.8} />
					<span class="caption">{p.shown !== p.char ? `${p.shown} ` : ''}{p.meaning}</span>
				</span>
			{/each}
			<span class="op">=</span>
			<span class="part"><KanaGlyph char={kanji.char} size={34} /><span class="caption">{kanji.meaning}</span></span>
		</div>
	{/if}

	<p class="story">{kanji.story}</p>

	{#if !compact}
		<dl class="readings">
			{#if kanji.kun.length}
				<dt title="Native Japanese reading">kun</dt>
				<dd class="jp">
					{#each kanji.kun as r}<span class="r">{showKun(r)}<Romaji text={r.replace('.', '')} /></span>{/each}
				</dd>
			{/if}
			<dt title="Reading borrowed from Chinese">on</dt>
			<dd class="jp">
				{#each kanji.on as r}<span class="r">{r}<Romaji text={r} /></span>{/each}
			</dd>
		</dl>
		<button class="glass example" onclick={() => speak(kanji.example.reading)}>
			<span class="jp word">{kanji.example.word}</span>
			<span class="stack" style:--gap="0">
				<span class="jp caption">{kanji.example.reading}<Romaji text={kanji.example.reading} inline /></span>
				<span class="caption">{kanji.example.gloss}</span>
			</span>
			<span class="spacer"></span>
			<span aria-hidden="true">🔊</span>
		</button>
	{/if}
</div>

<style>
	.info {
		width: 100%;
		max-width: 420px;
		text-align: left;
	}
	.head {
		gap: 10px;
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
		padding: 3px 8px;
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
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-start;
	}
	.part {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
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
		margin-bottom: 18px;
	}
	.readings {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 12px;
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
		gap: 4px 14px;
		font-size: 1.125rem;
	}
	.r {
		display: inline-flex;
		flex-direction: column;
	}
	.example {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: var(--r-m);
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}
	.word {
		font-size: 1.5rem;
		font-weight: 600;
	}
</style>
