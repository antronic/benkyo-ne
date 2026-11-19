<!--
	Japanese text with marked parts: words found in a photo (`mark`), and a
	suggested rewrite (`del` struck out, `add` inserted). Draft for the
	phrasebook and the Writing helper (docs/EVERYDAY.md).
-->
<script lang="ts" module>
	export type MarkedPart = { text: string; kind?: 'mark' | 'add' | 'del' };
</script>

<script lang="ts">
	let { parts, size = 'body' }: { parts: MarkedPart[]; size?: 'body' | 'callout' } = $props();
</script>

<p class="marked jp {size}">
	{#each parts as p, i (i)}{#if p.kind === 'del'}<del>{p.text}</del>{:else if p.kind === 'add'}<ins>{p.text}</ins>{:else if p.kind === 'mark'}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}
</p>

<style>
	.marked {
		margin: 0;
		white-space: pre-line;
		line-height: 1.75;
		overflow-wrap: anywhere;
	}
	.body {
		font-size: var(--text-body);
	}
	.callout {
		font-size: var(--text-callout);
	}
	mark,
	ins,
	del {
		border-radius: var(--radius-xs);
		padding: 0 var(--space-px);
	}
	mark {
		background: color-mix(in srgb, var(--color-warning) 35%, transparent);
		color: inherit;
	}
	ins {
		background: color-mix(in srgb, var(--color-success) 16%, transparent);
		color: color-mix(in srgb, var(--color-success) 70%, var(--color-text));
		text-decoration: none;
	}
	del {
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		color: var(--color-danger);
	}
</style>
