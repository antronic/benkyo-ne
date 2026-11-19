<!--
	Compact picker, for trailing a ListRow. Native <select> (so iOS shows its
	wheel and desktop its menu) with our own chevron: the browser's default
	arrow sits flush against the edge on macOS and Windows and ignores padding.
-->
<script lang="ts" generics="T extends string">
	import { inheritedControlSize, type ControlSize } from './size.ts';
	/** `group` puts the option under an <optgroup> of that name; `disabled` greys it out. */
	type Option = { value: T; label: string; group?: string; disabled?: boolean; lang?: string };
	let {
		options,
		value = $bindable(),
		label,
		disabled = false,
		block = false,
		size = inheritedControlSize() ?? 'md',
		id,
		onchange
	}: { options: Option[]; value: T; label: string; disabled?: boolean; block?: boolean; size?: ControlSize; id?: string; onchange?: (v: T) => void } = $props();
	// Consecutive options with the same group share one <optgroup>.
	const runs = $derived(
		options.reduce<{ group?: string; items: Option[] }[]>((acc, o) => {
			const last = acc[acc.length - 1];
			if (last && last.group === o.group) last.items.push(o);
			else acc.push({ group: o.group, items: [o] });
			return acc;
		}, [])
	);
</script>

{#snippet item(o: Option)}<option value={o.value} disabled={o.disabled} lang={o.lang}>{o.label}</option>{/snippet}

<span class="pick-wrap s-{size}" class:disabled class:block>
	<select class="pick" {id} aria-label={label} bind:value {disabled} onchange={() => onchange?.(value)}>
		{#each runs as r, i (i)}
			{#if r.group}<optgroup label={r.group}>{#each r.items as o (o.value)}{@render item(o)}{/each}</optgroup>
			{:else}{#each r.items as o (o.value)}{@render item(o)}{/each}{/if}
		{/each}
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
		padding: 0 calc(var(--space-3) + var(--space-5)) 0 var(--space-3);
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
		margin-top: calc(-1 * var(--space-1h));
		pointer-events: none;
		background: var(--color-text-2);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
	}
	.s-sm .pick {
		height: var(--control-sm);
		font-size: var(--text-subhead);
	}
	.s-lg .pick {
		height: var(--control-lg);
	}
	.block,
	.block .pick {
		width: 100%;
	}
	.disabled {
		opacity: 0.4;
	}
	.disabled .pick {
		cursor: default;
	}
</style>
