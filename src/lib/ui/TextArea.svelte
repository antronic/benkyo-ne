<!--
	Multi-line text field: notes, chat composers, prompts. Same surface,
	radius and focus ring as TextField. `autogrow` grows with the text up to
	`maxRows`, then scrolls.
-->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = Omit<HTMLTextareaAttributes, 'value'> & {
		value?: string | null;
		label?: string;
		hint?: string;
		error?: string;
		jp?: boolean;
		rows?: number;
		autogrow?: boolean;
		maxRows?: number;
		/** Fill the free space in a row. */
		grow?: boolean;
		ref?: HTMLTextAreaElement;
		class?: string;
	};
	let {
		value = $bindable(''),
		label,
		hint,
		error,
		jp = false,
		rows = 3,
		autogrow = false,
		maxRows = 8,
		grow = false,
		id,
		ref = $bindable(),
		class: cls = '',
		...rest
	}: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? `ta-${uid}`);

	$effect(() => {
		void value;
		if (!autogrow || !ref) return;
		ref.style.height = 'auto';
		const line = parseFloat(getComputedStyle(ref).lineHeight) || 22;
		ref.style.height = `${Math.min(ref.scrollHeight, line * maxRows + 24)}px`;
	});
</script>

<div class="field {cls}" class:invalid={!!error} class:grow>
	{#if label}<label class="label" for={fieldId}>{label}</label>{/if}
	<textarea
		bind:this={ref}
		id={fieldId}
		{rows}
		class:jp
		bind:value
		aria-invalid={!!error || undefined}
		aria-describedby={error || hint ? `${fieldId}-note` : undefined}
		{...rest}
	></textarea>
	{#if error}<span class="note err" id="{fieldId}-note">{error}</span>{:else if hint}<span class="note caption" id="{fieldId}-note">{hint}</span>{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
		min-width: 0;
	}
	.grow {
		flex: 1 1 auto;
	}
	.label {
		font-size: var(--text-footnote);
		font-weight: var(--weight-semibold);
		color: var(--color-text-2);
	}
	textarea {
		font: inherit;
		width: 100%;
		min-width: 0;
		min-height: var(--control-md);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-control);
		border: var(--hairline-w) solid var(--color-border);
		background: var(--color-surface-strong);
		color: var(--color-text);
		outline: none;
		resize: vertical;
		line-height: 1.45;
		transition: box-shadow var(--dur-fast);
	}
	textarea::placeholder {
		color: var(--color-text-3);
	}
	textarea:focus {
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	textarea:disabled {
		opacity: 0.5;
	}
	.invalid textarea {
		border-color: var(--color-danger);
	}
	.err {
		font-size: var(--text-caption);
		color: var(--color-danger);
	}
</style>
