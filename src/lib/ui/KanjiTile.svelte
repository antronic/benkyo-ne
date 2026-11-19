<!--
	One kanji with its reading and this week's slips: red dots for misreads,
	blue dots for "couldn't write". Draft for "Kanji you keep forgetting"
	(docs/EVERYDAY.md).
-->
<script lang="ts">
	let { kanji, reading, misread = 0, unwritten = 0 }: { kanji: string; reading?: string; misread?: number; unwritten?: number } = $props();
	const aria = $derived(`${kanji}${reading ? `, ${reading}` : ''}: misread ${misread}, couldn't write ${unwritten}`);
</script>

<div class="glass tile" role="img" aria-label={aria}>
	<span class="kanji jp">{kanji}</span>
	{#if reading}<span class="caption jp">{reading}</span>{/if}
	<span class="dots" aria-hidden="true">
		{#each { length: misread } as _, i (i)}<i class="miss"></i>{/each}
		{#each { length: unwritten } as _, i (i)}<i class="write"></i>{/each}
	</span>
</div>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-2);
		border-radius: var(--radius-card);
		min-width: 0;
	}
	.kanji {
		font-size: 34px;
		font-weight: var(--weight-bold);
		line-height: 1;
	}
	.caption {
		color: var(--color-text-2);
	}
	.dots {
		display: flex;
		gap: 3px; /* ui-ok: dot spacing below the 4px grid */
		min-height: 6px;
	}
	.dots i {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-round);
	}
	.miss {
		background: var(--color-danger);
	}
	.write {
		background: var(--color-info);
	}
</style>
