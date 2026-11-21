<!--
	A short checklist of optional set-up steps (docs/UX-FLOW.md): each row has an icon, a title,
	one line and one small button, and shows a tick once it is done. Steps wait here instead of
	standing between a new learner and the first lesson. The header counts what is done; ✕ hides
	the whole card. A step whose action is running shows `busy` on its button.
-->
<script module lang="ts">
	export interface SetupItem {
		id: string;
		icon: string;
		title: string;
		body?: string;
		done?: boolean;
		action?: string;
		busy?: boolean;
		onclick?: () => void;
	}
</script>

<script lang="ts">
	import Button from './Button.svelte';
	import IconButton from './IconButton.svelte';
	import Card from './Card.svelte';

	let {
		title,
		count,
		items,
		hideLabel = 'Hide',
		doneLabel = 'Done',
		ondismiss
	}: {
		title: string;
		/** "2 of 4 done" */
		count?: string;
		items: SetupItem[];
		hideLabel?: string;
		/** read out for a ticked step */
		doneLabel?: string;
		ondismiss?: () => void;
	} = $props();
</script>

<Card as="section" sheen padding="lg" radius="large" class="setup-card" aria-label={title}>
	<header>
		<div class="stack" style:--gap="var(--space-px)">
			<h2 class="setup-title">{title}</h2>
			{#if count}<span class="caption">{count}</span>{/if}
		</div>
		{#if ondismiss}<IconButton size="sm" label={hideLabel} onclick={ondismiss}>✕</IconButton>{/if}
	</header>
	<ul>
		{#each items as it (it.id)}
			<li class:done={it.done}>
				<span class="icon" aria-hidden="true">{it.done ? '✓' : it.icon}</span>
				<span class="stack grow" style:--gap="1px">
					<span class="item-title">{it.title}{#if it.done}<span class="sr">, {doneLabel}</span>{/if}</span>
					{#if it.body && !it.done}<span class="caption">{it.body}</span>{/if}
				</span>
				{#if !it.done && it.action}
					<Button size="sm" variant="ghost" busy={it.busy} onclick={it.onclick}>{it.action}</Button>
				{/if}
			</li>
		{/each}
	</ul>
</Card>

<style>
	:global(.setup-card) {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.setup-title {
		margin: 0;
		font-size: 1.0625rem;
		font-weight: 700;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 7%, transparent);
	}
	.icon {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		font-size: 1.1rem;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	li.done .icon {
		background: color-mix(in srgb, var(--success) 18%, transparent);
		color: var(--success);
		font-weight: 700;
	}
	li.done .item-title {
		color: var(--ink-2);
		text-decoration: line-through;
	}
	.item-title {
		font-weight: 600;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
