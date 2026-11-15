<!-- Compact native picker, for trailing a ListRow. -->
<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string };
	let { options, value = $bindable(), label, onchange }: { options: Option[]; value: T; label: string; onchange?: (v: T) => void } = $props();
</script>

<select class="pick" aria-label={label} bind:value onchange={() => onchange?.(value)}>
	{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
</select>

<style>
	.pick {
		font: inherit;
		font-size: var(--text-callout);
		height: var(--control-md);
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		border: var(--hairline-w) solid var(--color-border);
		background: var(--color-surface-strong);
		color: var(--color-text);
	}
	.pick:focus-visible {
		outline: none;
		box-shadow: 0 0 0 4px var(--color-focus);
	}
</style>
