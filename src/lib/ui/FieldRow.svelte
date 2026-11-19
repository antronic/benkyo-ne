<!--
	A text field (or dropdown) with its action button beside it, e.g. "Type the
	name · Delete". Everything inside takes the same height (size, default md
	44px), so the field and the button line up and weigh the same. The field
	should be <TextField grow …>; the button keeps its natural width.
	On a narrow screen (stack="narrow") the button drops under the field, full width.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { provideControlSize, type ControlSize } from './size.ts';
	let {
		size = 'md',
		stack = 'never',
		as = 'div',
		onsubmit,
		children
	}: { size?: ControlSize; stack?: 'never' | 'narrow'; as?: 'div' | 'form'; onsubmit?: (e: SubmitEvent) => void; children: Snippet } = $props();
	provideControlSize(() => size);
</script>

<svelte:element this={as} class="field-row" class:stack-narrow={stack === 'narrow'} onsubmit={as === 'form' ? (e: SubmitEvent) => (e.preventDefault(), onsubmit?.(e)) : undefined} role={as === 'form' ? undefined : 'group'}>
	{@render children()}
</svelte:element>

<style>
	.field-row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		width: 100%;
		min-width: 0;
	}
	.field-row > :global(.btn) {
		flex: none;
	}
	@media (max-width: 420px) {
		.stack-narrow {
			flex-wrap: wrap;
		}
		.stack-narrow > :global(.btn) {
			width: 100%;
		}
	}
</style>
