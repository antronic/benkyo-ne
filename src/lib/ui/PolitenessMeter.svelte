<!--
	Where a message sits between casual and keigo, and where it should be for the
	person it is written to. Draft for the Writing helper (docs/EVERYDAY.md).
	`value` and `target` run from 0 (casual) to 1 (keigo); `target` is optional.
-->
<script lang="ts">
	type Props = {
		value: number;
		target?: number;
		/** Scale words, left to right. */
		steps?: [string, string, string];
		/** Words for the two markers, shown in the key. */
		valueLabel?: string;
		targetLabel?: string;
		label?: string;
	};
	let { value, target, steps = ['Casual', 'Polite', 'Keigo'], valueLabel = 'Yours', targetLabel = 'Right for them', label = 'Politeness' }: Props = $props();
	const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
	const word = (n: number) => steps[n < 0.34 ? 0 : n < 0.67 ? 1 : 2];
	const aria = $derived(`${label}: ${valueLabel} ${word(value)}${target === undefined ? '' : `, ${targetLabel} ${word(target)}`}`);
</script>

<div class="meter" role="img" aria-label={aria}>
	<div class="track">
		{#if target !== undefined}<i class="mark target" style:left={pct(target)}></i>{/if}
		<i class="mark yours" style:left={pct(value)}></i>
	</div>
	<div class="steps caption" aria-hidden="true">
		{#each steps as s (s)}<span>{s}</span>{/each}
	</div>
	<div class="key caption" aria-hidden="true">
		<span><i class="dot yours"></i>{valueLabel}</span>
		{#if target !== undefined}<span><i class="dot target"></i>{targetLabel}</span>{/if}
	</div>
</div>

<style>
	.meter {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.track {
		position: relative;
		height: 10px;
		margin: var(--space-2) var(--space-2) 0;
		border-radius: var(--radius-pill);
		background: linear-gradient(90deg, var(--color-warning), var(--color-success) 50%, var(--color-info));
	}
	.mark {
		position: absolute;
		top: 50%;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-round);
		transform: translate(-50%, -50%);
		transition: left var(--dur-slow) var(--ease-spring);
	}
	.mark.yours {
		background: var(--color-surface-strong);
		border: 3px solid var(--color-text);
		box-shadow: var(--shadow-knob);
	}
	.mark.target {
		background: var(--color-success);
		border: 3px solid var(--color-surface-strong);
	}
	.steps,
	.key {
		display: flex;
		justify-content: space-between;
		color: var(--color-text-3);
	}
	.key {
		justify-content: flex-start;
		gap: var(--space-4);
		color: var(--color-text-2);
	}
	.key span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-round);
	}
	.dot.yours {
		border: 2px solid var(--color-text);
	}
	.dot.target {
		background: var(--color-success);
	}
</style>
