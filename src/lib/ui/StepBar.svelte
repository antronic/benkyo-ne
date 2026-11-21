<!--
	A row of steps with every step up to `value` filled, like a progress bar cut
	into labelled steps. Used for a word's politeness (casual → formal).
	`value` is the index of the step reached; null fills every step softly
	("any step fits"). `tones` colours each step; it defaults to the accent.
-->
<script lang="ts">
	type Tone = 'accent' | 'info' | 'success' | 'warning' | 'violet';
	type Props = {
		steps: string[];
		value: number | null;
		tones?: Tone[];
		/** read out with the step reached, e.g. "Politeness" */
		label: string;
		/** read out (and shown) when `value` is null */
		anyLabel?: string;
	};
	let { steps, value, tones, label, anyLabel = 'Any' }: Props = $props();
	const aria = $derived(`${label}: ${value === null ? anyLabel : `${steps[value]}, ${value + 1} / ${steps.length}`}`);
</script>

<div class="stepbar" class:any={value === null} role="img" aria-label={aria} style:--n={steps.length}>
	<div class="track" aria-hidden="true">
		{#each steps as s, i (s)}
			<i class="seg t-{tones?.[i] ?? 'accent'}" class:on={value === null || i <= value} class:here={i === value}></i>
		{/each}
	</div>
	<div class="names caption" aria-hidden="true">
		{#each steps as s, i (s)}<span class:here={i === value}>{s}</span>{/each}
	</div>
</div>

<style>
	.stepbar {
		display: flex;
		flex-direction: column;
		gap: var(--space-1h);
		min-width: 0;
	}
	.track,
	.names {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: var(--space-1);
	}
	.seg {
		--c: var(--color-accent);
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--color-fill);
		transition: background-color var(--dur-fast) var(--ease-out);
	}
	.seg.on {
		background: var(--c);
	}
	.any .seg.on {
		background: color-mix(in srgb, var(--c) 35%, transparent);
	}
	.seg.here {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 30%, transparent);
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
	.t-violet {
		--c: var(--color-violet);
	}
	.names span {
		color: var(--color-text-3);
		text-align: center;
		overflow-wrap: anywhere;
	}
	.names span.here {
		color: var(--color-text);
		font-weight: var(--weight-semibold);
	}
	@media (prefers-reduced-motion: reduce) {
		.seg {
			transition: none;
		}
	}
</style>
