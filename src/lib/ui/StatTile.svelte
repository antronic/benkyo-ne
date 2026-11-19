<!--
	A number with its label, for summary rows at the top of a screen
	(fleet console counts, totals). Lay several out with StatGrid-like CSS grid
	in the screen, or wrap them in <div class="ui-stats">.
-->
<script lang="ts">
	let { label, value, note, tone = 'default' }: { label: string; value: string | number; note?: string; tone?: 'default' | 'danger' } = $props();
</script>

<div class="glass stat" class:danger={tone === 'danger'}>
	<span class="caption">{label}</span>
	<b class="value">{value}</b>
	{#if note}<span class="caption">{note}</span>{/if}
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4);
		border-radius: var(--radius-card);
		min-height: 88px;
		min-width: 0;
	}
	.value {
		font-size: 28px;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.danger .value {
		color: var(--color-danger);
	}
	:global(.ui-stats) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-3);
	}
</style>
