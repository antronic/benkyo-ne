<!-- iOS action sheet + HUD toast, driven by lib/ios/overlay.svelte.ts -->
<script lang="ts">
	import { fly, fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { overlay } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { Button, Card, Spinner } from '#lib/ui/index.ts';

	const s = $derived(overlay.sheet);
	const cancelIndex = $derived(s ? s.actions.findIndex((a) => a.role === 'cancel') : -1);
	$effect(() => {
		if (s) haptic('warning');
	});
</script>

{#if s}
	<!-- ui-ok: aria-hidden scrim that only catches taps outside the sheet --><button class="scrim" aria-hidden="true" tabindex="-1" onclick={() => s.resolve(-1)} transition:fade={{ duration: 200 }}></button>
	<div class="action-sheet" role="alertdialog" aria-modal="true" aria-label={s.title} transition:fly={{ y: 300, duration: 420, easing: cubicOut, opacity: 1 }}>
		<Card strong padding="none" class="sheet-group">
			{#if s.title || s.message}
				<div class="head">
					{#if s.title}<div class="t">{s.title}</div>{/if}
					{#if s.message}<div class="m">{s.message}</div>{/if}
				</div>
			{/if}
			{#each s.actions as a, i}
				{#if a.role !== 'cancel'}
					<Button variant="plain" block class={a.role === 'destructive' ? 'sheet-act destructive' : 'sheet-act'} onclick={() => s.resolve(i)}>{a.label}</Button>
				{/if}
			{/each}
		</Card>
		{#if cancelIndex >= 0}
			<Card strong padding="none" class="sheet-group">
				<Button variant="plain" block class="sheet-act cancel" onclick={() => s.resolve(-1)}>{s.actions[cancelIndex].label}</Button>
			</Card>
		{/if}
	</div>
{/if}

{#if overlay.toast}
	{#key overlay.toast.id}
		<div class="toast" role="status" in:scale={{ start: 0.85, duration: 380, easing: cubicOut }} out:fade={{ duration: 200 }}>
			<Card strong padding="none" class="toast-pill">
				{#if overlay.toast.busy}<Spinner size="sm" label={overlay.toast.text} />{:else if overlay.toast.icon}<span>{overlay.toast.icon}</span>{/if}
				{overlay.toast.text}
			</Card>
		</div>
	{/key}
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		border: 0;
		background: rgb(0 0 0 / 0.32);
		z-index: 90;
	}
	.action-sheet {
		position: fixed;
		z-index: 91;
		left: max(8px, var(--safe-left));
		right: max(8px, var(--safe-right));
		bottom: calc(var(--safe-bottom) + 8px);
		max-width: 420px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.action-sheet :global(.sheet-group) {
		border-radius: 16px;
		overflow: hidden;
	}
	.head {
		padding: var(--space-4) var(--space-4);
		text-align: center;
		border-bottom: 0.5px solid var(--hairline);
	}
	.t {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink-2);
	}
	.m {
		font-size: 0.8125rem;
		color: var(--ink-2);
		margin-top: var(--space-px);
	}
	.action-sheet :global(.sheet-act) {
		display: flex;
		min-height: 57px;
		border-radius: 0;
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--accent-2);
	}
	.action-sheet :global(.sheet-act + .sheet-act),
	.head + :global(.sheet-act) {
		border-top: 0.5px solid var(--hairline);
	}
	.action-sheet :global(.sheet-act:active) {
		transform: none;
		background: var(--hairline);
	}
	.action-sheet :global(.sheet-act.destructive) {
		color: var(--danger);
	}
	.action-sheet :global(.sheet-act.cancel) {
		font-weight: 600;
	}
	.toast {
		position: fixed;
		z-index: 95;
		top: calc(var(--safe-top) + 12px);
		left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		translate: -50% 0;
	}
	.toast :global(.toast-pill) {
		padding: var(--space-3) var(--space-5);
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.9375rem;
		display: flex;
		gap: var(--space-2);
		align-items: center;
		white-space: nowrap;
	}
	/* iOS shows alerts centred on larger screens (e.g. unfolded iPhone Duo) */
	@media (min-width: 600px) {
		.action-sheet {
			top: 50%;
			bottom: auto;
			translate: 0 -50%;
			width: 320px;
		}
	}
</style>
