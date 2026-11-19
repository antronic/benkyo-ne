<!-- Text input with an optional label, hint and error. bind:value for the text. -->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	type Props = Omit<HTMLInputAttributes, 'value'> & {
		value?: string;
		label?: string;
		hint?: string;
		error?: string;
		jp?: boolean;
	};
	let { value = $bindable(''), label, hint, error, jp = false, type = 'text', id, ...rest }: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? `tf-${uid}`);
</script>

<div class="field" class:invalid={!!error}>
	{#if label}<label class="label" for={fieldId}>{label}</label>{/if}
	<input
		id={fieldId}
		{type}
		class:jp
		bind:value
		aria-invalid={!!error || undefined}
		aria-describedby={error || hint ? `${fieldId}-note` : undefined}
		{...rest}
	/>
	{#if error}<span class="note err" id="{fieldId}-note">{error}</span>{:else if hint}<span class="note caption" id="{fieldId}-note">{hint}</span>{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
	}
	.label {
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
		color: var(--color-text-2);
		padding-left: var(--space-1);
	}
	input {
		font: inherit;
		width: 100%;
		min-height: var(--field-h);
		padding: 0 var(--space-5);
		border-radius: var(--radius-control);
		border: var(--hairline-w) solid var(--color-border);
		background: var(--color-surface-strong);
		color: var(--color-text);
		outline: none;
		transition: box-shadow var(--dur-fast);
	}
	input::placeholder {
		color: var(--color-text-3);
	}
	input:focus {
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	.invalid input {
		border-color: var(--color-danger);
	}
	.invalid input:focus {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 28%, transparent);
	}
	.note {
		padding-left: var(--space-1);
	}
	.err {
		font-size: var(--text-caption);
		color: var(--color-danger);
	}
</style>
