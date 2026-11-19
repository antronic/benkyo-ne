<!--
	A checkbox with its label, for agreeing to something (consent) or ticking an
	item in a list. For an on/off setting use Switch.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { checked = $bindable(false), disabled = false, onchange, children }: { checked?: boolean; disabled?: boolean; onchange?: (checked: boolean) => void; children: Snippet } = $props();
</script>

<label class="check" class:disabled>
	<input type="checkbox" bind:checked {disabled} onchange={() => onchange?.(checked)} />
	<span class="box" aria-hidden="true"></span>
	<span class="text">{@render children()}</span>
</label>

<style>
	.check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--control-md);
		padding: var(--space-2) 0;
		cursor: pointer;
		position: relative;
	}
	input {
		position: absolute;
		opacity: 0;
		width: 22px;
		height: 22px;
		margin: 0;
	}
	.box {
		flex: none;
		width: 22px;
		height: 22px;
		margin-top: var(--space-px);
		border-radius: var(--radius-xs);
		border: 1.5px solid var(--color-text-3);
		display: grid;
		place-items: center;
		transition: background var(--dur-fast), border-color var(--dur-fast);
	}
	input:checked + .box {
		background: var(--color-accent);
		border-color: var(--color-accent);
	}
	input:checked + .box::after {
		content: '';
		width: 6px;
		height: 11px;
		border: solid #fff;
		border-width: 0 2px 2px 0;
		transform: translateY(-1px) rotate(45deg);
	}
	input:focus-visible + .box {
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	.text {
		line-height: 1.4;
	}
	.disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
