<!-- iOS action sheet + HUD toast, driven by lib/ios/overlay.svelte.ts -->
<script lang="ts">
	import { fly, fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { overlay } from '#lib/ios/overlay.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';

	const s = $derived(overlay.sheet);
	const cancelIndex = $derived(s ? s.actions.findIndex((a) => a.role === 'cancel') : -1);
	$effect(() => {
		if (s) haptic('warning');
	});
</script>

{#if s}
	<button class="scrim" aria-hidden="true" tabindex="-1" onclick={() => s.resolve(-1)} transition:fade={{ duration: 200 }}></button>
	<div class="action-sheet" role="alertdialog" aria-modal="true" aria-label={s.title} transition:fly={{ y: 300, duration: 420, easing: cubicOut, opacity: 1 }}>
		<div class="group glass glass-strong">
			{#if s.title || s.message}
				<div class="head">
					{#if s.title}<div class="t">{s.title}</div>{/if}
					{#if s.message}<div class="m">{s.message}</div>{/if}
				</div>
			{/if}
			{#each s.actions as a, i}
				{#if a.role !== 'cancel'}
					<button class="act" class:destructive={a.role === 'destructive'} onclick={() => s.resolve(i)}>{a.label}</button>
				{/if}
			{/each}
		</div>
		{#if cancelIndex >= 0}
			<button class="act cancel glass glass-strong" onclick={() => s.resolve(-1)}>{s.actions[cancelIndex].label}</button>
		{/if}
	</div>
{/if}

{#if overlay.toast}
	{#key overlay.toast.id}
		<div class="toast glass glass-strong" role="status" in:scale={{ start: 0.85, duration: 380, easing: cubicOut }} out:fade={{ duration: 200 }}>
			{#if overlay.toast.icon}<span>{overlay.toast.icon}</span>{/if}
			{overlay.toast.text}
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
		gap: 8px;
	}
	.group {
		border-radius: 16px;
		overflow: hidden;
	}
	.head {
		padding: 14px 16px;
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
		margin-top: 2px;
	}
	.act {
		display: block;
		width: 100%;
		min-height: 57px;
		border: 0;
		background: none;
		font-size: 1.25rem;
		color: var(--accent-2);
		cursor: pointer;
	}
	.group .act + .act,
	.head + .act {
		border-top: 0.5px solid var(--hairline);
	}
	.act:active {
		background: var(--hairline);
	}
	.destructive {
		color: var(--danger);
	}
	.cancel {
		font-weight: 600;
		border-radius: 16px;
	}
	.toast {
		position: fixed;
		z-index: 95;
		top: calc(var(--safe-top) + 12px);
		left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		translate: -50% 0;
		padding: 10px 18px;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.9375rem;
		display: flex;
		gap: 8px;
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
