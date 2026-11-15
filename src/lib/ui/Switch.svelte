<!-- iOS switch. Give it a `label` (visually hidden) or wrap it in a <label> / ListRow. -->
<script lang="ts">
	let { checked = $bindable(false), label, disabled = false, onchange }: { checked?: boolean; label?: string; disabled?: boolean; onchange?: (checked: boolean) => void } = $props();
</script>

<input
	type="checkbox"
	role="switch"
	class="switch"
	aria-label={label}
	bind:checked
	{disabled}
	onchange={() => onchange?.(checked)}
/>

<style>
	.switch {
		appearance: none;
		flex: none;
		margin: 0;
		width: 51px;
		height: 31px;
		border-radius: var(--radius-pill);
		background: var(--color-fill-strong);
		position: relative;
		cursor: pointer;
		transition: background 250ms;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: var(--radius-round);
		background: var(--color-knob);
		box-shadow: var(--shadow-knob);
		transition: transform 450ms var(--ease-spring-bouncy);
	}
	.switch:checked {
		background: var(--color-success);
	}
	.switch:checked::after {
		transform: translateX(20px);
	}
	.switch:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.switch:focus-visible {
		outline: none;
		box-shadow: 0 0 0 4px var(--color-focus);
	}
</style>
