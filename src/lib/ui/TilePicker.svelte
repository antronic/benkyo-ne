<!--
	Pick one of several picture tiles (avatar parts, styles). `options` are value/label pairs;
	`art` draws each tile's picture. bind:value for the selection. A radio group for screen readers.
-->
<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	type Option = { value: T; label: string };
	let {
		options,
		value = $bindable(),
		label,
		art,
		onchange
	}: { options: Option[]; value: T; label: string; art: Snippet<[T]>; onchange?: (v: T) => void } = $props();
</script>

<div class="tiles" role="radiogroup" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			class:on={value === o.value}
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}
		>
			<span class="art" aria-hidden="true">{@render art(o.value)}</span>
			<span class="name">{o.label}</span>
		</button>
	{/each}
</div>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: var(--space-2);
	}
	button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--control-md);
		padding: var(--space-2) var(--space-1);
		border: var(--hairline-w) solid var(--color-border);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			box-shadow var(--dur-fast),
			background var(--dur-fast);
	}
	.on {
		background: var(--color-surface-strong);
		box-shadow:
			0 0 0 2px var(--color-accent),
			var(--shadow-raised);
	}
	.art {
		display: grid;
		place-items: center;
	}
	.name {
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
		text-align: center;
		line-height: 1.2;
	}
	button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--color-focus);
	}
</style>
