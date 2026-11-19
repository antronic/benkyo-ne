<!-- − value + stepper. bind:value; clamps to min/max. -->
<script lang="ts">
	let { value = $bindable(0), min = 0, max = Infinity, step = 1, label, onchange }: { value?: number; min?: number; max?: number; step?: number; label: string; onchange?: (v: number) => void } = $props();
	function set(v: number) {
		value = Math.min(max, Math.max(min, v));
		onchange?.(value);
	}
</script>

<div class="stepper glass" role="group" aria-label={label}>
	<button type="button" aria-label="Decrease {label}" disabled={value <= min} onclick={() => set(value - step)}>−</button>
	<span class="val" aria-live="polite">{value}</span>
	<button type="button" aria-label="Increase {label}" disabled={value >= max} onclick={() => set(value + step)}>+</button>
</div>

<style>
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-px);
		border-radius: 10px;
	}
	button {
		border: 0;
		background: none;
		color: inherit;
		width: 36px;
		height: 32px;
		font-size: 20px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.val {
		min-width: 30px;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: var(--weight-semibold);
	}
</style>
