<!-- Segmented control. `options` are value/label pairs; bind:value for the selection. -->
<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string; disabled?: boolean; lang?: string };
	let { options, value = $bindable(), label, onchange }: { options: Option[]; value: T; label?: string; onchange?: (v: T) => void } = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			class:on={value === o.value}
			disabled={o.disabled}
			lang={o.lang}
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}>{o.label}</button
		>
	{/each}
</div>

<style>
	.seg {
		display: flex;
		width: 100%;
		padding: var(--space-px);
		border-radius: 10px;
		background: var(--color-fill);
	}
	button {
		flex: 1;
		height: 32px;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-weight: var(--weight-semibold);
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background var(--dur-fast),
			box-shadow var(--dur-fast);
	}
	.on {
		background: color-mix(in srgb, var(--color-text) 14%, var(--color-surface-strong));
		box-shadow: var(--shadow-raised);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--color-focus);
	}
</style>
