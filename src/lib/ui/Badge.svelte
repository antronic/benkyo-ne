<!--
	Small status label. variant="soft" (tinted, default), "solid", or "tag"
	(uppercase, for "NEW" / "OFFLINE" style markers).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'violet';
	let { tone = 'neutral', variant = 'soft', children }: { tone?: Tone; variant?: 'soft' | 'solid' | 'tag'; children: Snippet } = $props();
</script>

<span class="badge {variant} t-{tone}">{@render children()}</span>

<style>
	.badge {
		--c: var(--color-text-2);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-px) var(--space-2);
		border-radius: var(--radius-pill);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
		line-height: 1.3;
		white-space: nowrap;
		vertical-align: 1px;
	}
	.t-accent {
		--c: var(--color-accent);
	}
	.t-info {
		--c: var(--color-info);
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
	.t-violet {
		--c: var(--color-violet);
	}
	.soft,
	.tag {
		background: color-mix(in srgb, var(--c) 18%, transparent);
		color: color-mix(in srgb, var(--c) 80%, var(--color-text));
	}
	.t-neutral.soft,
	.t-neutral.tag {
		background: var(--color-fill);
		color: var(--color-text-2);
	}
	.solid {
		background: var(--c);
		color: var(--color-on-solid);
	}
	.t-neutral.solid {
		background: var(--color-text);
		color: var(--color-bg);
	}
	.tag {
		font-size: var(--text-caption-2);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
