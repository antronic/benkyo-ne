<!-- The back of a word/phrase card: reading, kanji, meanings, hook, usage, example. -->
<script lang="ts">
	import type { UserCard } from '#lib/ai/contract.ts';
	import { speak } from '#lib/content/kana.ts';

	let { card, compact = false }: { card: Pick<UserCard, 'front' | 'kanji' | 'gloss' | 'gloss2' | 'hook' | 'usage' | 'example' | 'kind' | 'verified'>; compact?: boolean } = $props();
</script>

<div class="wc" class:compact>
	<div class="row head">
		<span class="jp front">{card.front}</span>
		<button class="icon-btn" aria-label="Listen" onclick={() => speak(card.front)}>🔊</button>
		{#if !card.verified}<span class="badge unverified" title="Not found in the dictionary">unverified</span>{/if}
		{#if card.kind === 'phrase'}<span class="badge">phrase</span>{/if}
	</div>
	{#if card.kanji}<div class="also">also written <span class="jp">{card.kanji}</span></div>{/if}
	<div class="gloss">{card.gloss}</div>
	{#if card.gloss2}<div class="gloss2">{card.gloss2}</div>{/if}
	{#if card.usage}
		<div class="usage">💬 {card.usage.en}{#if card.usage.second}<br /><span class="second">{card.usage.second}</span>{/if}</div>
	{/if}
	{#if card.hook && !compact}
		<div class="hook">💡 {card.hook.en}{#if card.hook.second}<br /><span class="second">{card.hook.second}</span>{/if}</div>
	{/if}
	{#if card.example && !compact}
		<button class="example" onclick={() => speak(card.example!.jp.replace(/\n/g, '。'))}>
			<span class="jp">{#each card.example.jp.split('\n') as line}<span class="line">{line}</span>{/each}</span>
			<span class="caption">{card.example.en}</span>
			{#if card.example.second}<span class="caption second">{card.example.second}</span>{/if}
		</button>
	{/if}
</div>

<style>
	.wc {
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
		width: 100%;
	}
	.head {
		--gap: 8px;
		flex-wrap: wrap;
	}
	.front {
		font-size: 2rem;
		font-weight: 600;
		line-height: 1.1;
	}
	.compact .front {
		font-size: 1.375rem;
	}
	.also {
		color: var(--ink-2);
		font-size: 0.9375rem;
	}
	.also .jp {
		font-size: 1.25rem;
		color: var(--ink);
	}
	.gloss {
		font-size: 1.125rem;
		font-weight: 600;
	}
	.gloss2,
	.second {
		color: var(--ink-2);
	}
	.usage,
	.hook {
		font-size: 0.9375rem;
		background: color-mix(in srgb, var(--accent-2) 8%, transparent);
		border-radius: 12px;
		padding: 8px 10px;
	}
	.example {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
		border: 0.5px solid var(--hairline);
		background: var(--glass);
		border-radius: 12px;
		padding: 10px 12px;
		cursor: pointer;
	}
	.example .jp {
		font-size: 1.0625rem;
		display: flex;
		flex-direction: column;
	}
	.badge {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--hairline);
		color: var(--ink-2);
	}
	.unverified {
		background: color-mix(in srgb, var(--warn) 30%, transparent);
		color: var(--ink);
	}
</style>
