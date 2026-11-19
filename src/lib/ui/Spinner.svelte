<!--
	Activity indicator for work in progress: loading, saving, waiting for the AI.
	Always give it a label (read by screen readers, shown when `showLabel`).
	For content that is about to appear, prefer Skeleton in its shape.
-->
<script lang="ts">
	let { label, size = 'md', showLabel = false }: { label: string; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean } = $props();
</script>

<span class="spinner s-{size}" role="status" aria-live="polite">
	<span class="ring" aria-hidden="true"></span>
	<span class:visually-hidden={!showLabel} class="text">{label}</span>
</span>

<style>
	.spinner {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-2);
		font-size: var(--text-subhead);
	}
	.ring {
		--d: 20px;
		width: var(--d);
		height: var(--d);
		border-radius: var(--radius-round);
		border: 2px solid var(--color-fill-strong);
		border-top-color: var(--color-accent);
		animation: spin 800ms linear infinite;
		flex: none;
	}
	.s-sm .ring {
		--d: 14px;
	}
	.s-lg .ring {
		--d: 32px;
		border-width: 3px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ring {
			animation-duration: 2400ms;
		}
	}
</style>
