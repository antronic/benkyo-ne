<!--
	Compact picker, for trailing a ListRow. Native <select> (so iOS shows its
	wheel and desktop its menu) with our own chevron: the browser's default
	arrow sits flush against the edge on macOS and Windows and ignores padding.
-->
<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string };
	let { options, value = $bindable(), label, disabled = false, onchange }: { options: Option[]; value: T; label: string; disabled?: boolean; onchange?: (v: T) => void } = $props();
</script>

<span class="pick-wrap" class:disabled>
	<select class="pick" aria-label={label} bind:value {disabled} onchange={() => onchange?.(value)}>
		{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
	</select>
	<span class="chev" aria-hidden="true"></span>
</span>

<style>
	.pick-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}
	.pick {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
		font: inherit;
		font-size: var(--text-callout);
		line-height: 1.2;
		height: var(--control-md);
		padding: 0 calc(var(--space-3) + 20px) 0 var(--space-3);
		border-radius: var(--radius-md);
		border: var(--hairline-w) solid var(--color-border);
		background: var(--color-surface-strong);
		color: var(--color-text);
		cursor: pointer;
		text-overflow: ellipsis;
		transition: box-shadow var(--dur-fast);
	}
	.pick:focus-visible {
		outline: none;
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	.chev {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		width: 12px;
		height: 12px;
		margin-top: -6px;
		pointer-events: none;
		background: var(--color-text-2);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
	}
	.disabled {
		opacity: 0.4;
	}
	.disabled .pick {
		cursor: default;
	}
</style>
