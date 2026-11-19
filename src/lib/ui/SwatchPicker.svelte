<!--
	Pick a colour from a palette. `options` are value / CSS colour / label; bind:value for the
	selection. Each swatch is a 44 px touch target; the label is its accessible name.
-->
<script lang="ts" generics="T extends string">
	type Option = { value: T; color: string; label: string };
	let { options, value = $bindable(), label, onchange }: { options: Option[]; value: T; label: string; onchange?: (v: T) => void } = $props();
</script>

<div class="swatches" role="radiogroup" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			aria-label={o.label}
			title={o.label}
			class:on={value === o.value}
			style:--swatch={o.color}
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}
		></button>
	{/each}
</div>

<style>
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	button {
		width: var(--control-md);
		height: var(--control-md);
		padding: 0;
		border: var(--hairline-w) solid var(--color-border);
		border-radius: var(--radius-round);
		background: var(--swatch);
		cursor: pointer;
	}
	.on {
		box-shadow:
			0 0 0 2px var(--color-bg),
			0 0 0 4px var(--color-accent);
	}
	button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--color-bg),
			0 0 0 5px var(--color-focus);
	}
</style>
