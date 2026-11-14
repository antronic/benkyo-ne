<!-- ✨ AI hub: make word-card packs, make lesson packs, ask the tutor. -->
<script lang="ts">
	import LargeTitle from '#lib/components/LargeTitle.svelte';
	import { ai } from '#lib/state/ai.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';

	ui.hue = 265;
	const ACTIONS = [
		{ href: '/words/new?mode=scenario', icon: '🃏', title: 'Make a new word card pack', desc: 'Describe a situation, a photo or a word: AI suggests cards and names the pack.' },
		{ href: '/ai/lesson', icon: '📚', title: 'Make a new lesson pack', desc: 'Pick any topic: AI builds a lesson unit that appears in Learn.' },
		{ href: '/ai/ask', icon: '💬', title: 'Ask AI', desc: 'Grammar, nuance, “how do I say…”: a patient tutor that knows your level.' }
	];
</script>

<main class="page stack" style:--gap="14px">
	<LargeTitle title="AI" />
	{#if ai.checked && !ai.available}
		<a class="glass warn" href="/settings#ai">✨ {ai.reason || 'Set up AI in Settings.'} <b>Open Settings ›</b></a>
	{/if}
	<div class="actions">
		{#each ACTIONS as a, i}
			<a class="action glass sheen rise" style:--i={i} href={a.href} class:disabled={!ai.available}>
				<span class="icon" aria-hidden="true">{a.icon}</span>
				<span class="stack" style:--gap="4px">
					<span class="title-2">{a.title}</span>
					<span class="subhead">{a.desc}</span>
				</span>
				<span class="go" aria-hidden="true">›</span>
			</a>
		{/each}
	</div>
	{#if ai.usage}
		<p class="caption">This month: ${ai.usage.spentUsd.toFixed(3)} of ${ai.usage.capUsd.toFixed(2)} · {ai.usage.calls} calls</p>
	{/if}
</main>

<style>
	.warn {
		display: block;
		padding: 14px 16px;
		border-radius: var(--r-m);
		color: inherit;
		text-decoration: none;
		background: color-mix(in srgb, var(--warn) 18%, var(--glass));
	}
	.actions {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 600px) {
		.actions {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.action {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px;
		border-radius: var(--r-l);
		text-decoration: none;
		color: inherit;
		min-height: 110px;
		transition: transform 450ms var(--spring);
	}
	.action:active {
		transform: scale(0.97);
	}
	.action.disabled {
		opacity: 0.55;
	}
	.icon {
		font-size: 34px;
		flex: none;
	}
	.go {
		margin-left: auto;
		font-size: 30px;
		color: var(--ink-3);
	}
</style>
