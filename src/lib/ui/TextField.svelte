<!--
	Text input with an optional label, hint and error. bind:value for the text.
	size: sm 36px, md 44px (default), lg 50px; inside a FieldRow it takes the
	row's size so the field and its button are the same height.
	variant "answer" is the big centred field for typed answers in lessons and
	review; "bare" has no box, for a field that sits inside its own bar (chat).
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { inheritedControlSize, type ControlSize } from './size.ts';
	type Props = Omit<HTMLInputAttributes, 'value' | 'size'> & {
		value?: string | number | null;
		label?: string;
		hint?: string;
		error?: string;
		jp?: boolean;
		size?: ControlSize;
		variant?: 'default' | 'answer' | 'bare';
		/** Fill the free space in a row. */
		grow?: boolean;
		/** The <input>, for focus(). */
		ref?: HTMLInputElement;
		class?: string;
	};
	const inherited = inheritedControlSize();
	let {
		value = $bindable(''),
		label,
		hint,
		error,
		jp = false,
		type = 'text',
		id,
		size = inherited ?? 'md',
		variant = 'default',
		grow = false,
		ref = $bindable(),
		class: cls = '',
		...rest
	}: Props = $props();
	const uid = $props.id();
	const fieldId = $derived(id ?? `tf-${uid}`);
</script>

<div class="field s-{size} v-{variant} {cls}" class:invalid={!!error} class:grow>
	{#if label}<label class="label" for={fieldId}>{label}</label>{/if}
	<input
		bind:this={ref}
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
		min-width: 0;
	}
	.grow {
		flex: 1 1 auto;
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
		min-width: 0;
		height: var(--control-md);
		padding: 0 var(--space-4);
		border-radius: var(--radius-control);
		border: var(--hairline-w) solid var(--color-border);
		background: var(--color-surface-strong);
		color: var(--color-text);
		outline: none;
		transition: box-shadow var(--dur-fast);
	}
	.s-sm input {
		height: var(--control-sm);
		padding: 0 var(--space-3);
		font-size: var(--text-subhead);
		border-radius: var(--radius-md);
	}
	.s-lg input {
		height: var(--control-lg);
		padding: 0 var(--space-5);
	}
	.v-answer input {
		height: auto;
		min-height: var(--field-h);
		padding: var(--space-3) var(--space-5);
		text-align: center;
		font-size: var(--text-title-3);
		border-radius: var(--radius-card);
	}
	.v-bare input {
		height: var(--control-md);
		border: 0;
		background: none;
		padding: 0 var(--space-2);
	}
	.v-bare input:focus {
		box-shadow: none;
	}
	input::placeholder {
		color: var(--color-text-3);
	}
	input:focus {
		box-shadow: 0 0 0 4px var(--color-focus);
	}
	input:disabled {
		opacity: 0.5;
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
