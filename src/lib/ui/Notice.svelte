<!-- Inline message on a tinted surface: tips, warnings, errors. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string; action?: Snippet; children: Snippet };
	let { tone = 'info', title, action, children }: Props = $props();
</script>

<div class="notice t-{tone}" role={tone === 'danger' ? 'alert' : 'status'}>
	<div class="text">
		{#if title}<strong>{title}</strong>{/if}
		<span>{@render children()}</span>
	</div>
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.notice {
		--c: var(--color-info);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-control);
		background: color-mix(in srgb, var(--c) 12%, var(--color-surface-strong));
		border: var(--hairline-w) solid color-mix(in srgb, var(--c) 30%, transparent);
		font-size: var(--text-subhead);
	}
	.t-success {
		--c: var(--color-success);
	}
	.t-warning {
		--c: var(--color-warning);
	}
	.t-danger {
		--c: var(--color-danger);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
		flex: 1;
		min-width: 0;
	}
	strong {
		font-weight: var(--weight-semibold);
	}
	.action {
		flex: none;
	}
</style>
