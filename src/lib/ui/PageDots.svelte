<!--
	Page indicator for paged content (the intro slides). The current page is a
	wider pill. Each dot has a 32px tap target around the 8px mark.
	Colour of the current dot: --dot-on (defaults to the accent).
-->
<script lang="ts">
	let {
		count,
		index = $bindable(0),
		label,
		pageLabel = (n: number) => String(n),
		onselect
	}: { count: number; index?: number; label: string; pageLabel?: (n: number) => string; onselect?: (i: number) => void } = $props();
</script>

<div class="dots" role="tablist" aria-label={label}>
	{#each Array(count) as _, n}
		<button
			type="button"
			role="tab"
			aria-selected={n === index}
			aria-label={pageLabel(n + 1)}
			class:on={n === index}
			onclick={() => {
				index = n;
				onselect?.(n);
			}}><span class="mark"></span></button
		>
	{/each}
</div>

<style>
	.dots {
		display: flex;
		justify-content: center;
	}
	button {
		display: grid;
		place-items: center;
		min-width: 24px;
		height: 32px;
		padding: 0 var(--space-1);
		border: 0;
		background: none;
		cursor: pointer;
	}
	.mark {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: var(--color-text-3);
		transition:
			width var(--dur-base) var(--spring),
			background var(--dur-base);
	}
	.on .mark {
		width: 24px;
		background: var(--dot-on, var(--color-accent));
	}
	button:focus-visible {
		outline: none;
	}
	button:focus-visible .mark {
		box-shadow: 0 0 0 3px var(--color-focus);
	}
</style>
