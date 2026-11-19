<!-- A range slider. bind:value (number). Give it a label for screen readers. -->
<script lang="ts">
	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		label,
		disabled = false,
		onchange,
		oninput
	}: { value?: number; min?: number; max?: number; step?: number; label: string; disabled?: boolean; onchange?: (v: number) => void; oninput?: (v: number) => void } = $props();
	const pct = $derived(((value - min) / (max - min || 1)) * 100);
</script>

<input
	class="slider"
	type="range"
	{min}
	{max}
	{step}
	{disabled}
	aria-label={label}
	bind:value
	style:--pct="{pct}%"
	oninput={() => oninput?.(value)}
	onchange={() => onchange?.(value)}
/>

<style>
	.slider {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		height: var(--control-md);
		margin: 0;
		background: none;
		cursor: pointer;
	}
	.slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: var(--radius-pill);
		background: linear-gradient(to right, var(--color-accent) var(--pct), var(--color-fill-strong) var(--pct));
	}
	.slider::-moz-range-track {
		height: 6px;
		border-radius: var(--radius-pill);
		background: linear-gradient(to right, var(--color-accent) var(--pct), var(--color-fill-strong) var(--pct));
	}
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 26px;
		height: 26px;
		margin-top: -10px; /* ui-ok: centres the 26px thumb on the 6px track */
		border-radius: var(--radius-round);
		background: #fff;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.25), 0 0 0 0.5px rgb(0 0 0 / 0.08);
	}
	.slider::-moz-range-thumb {
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: var(--radius-round);
		background: #fff;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
	}
	.slider:focus-visible {
		outline: none;
	}
	.slider:focus-visible::-webkit-slider-thumb {
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	.slider:disabled {
		opacity: 0.4;
	}
</style>
