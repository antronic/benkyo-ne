<!--
	Fleet console: one bar per UTC day, with hover read-out and a table view
	for screen readers and exact numbers. Used by Settings (sign-ups) and Usage (spend).
-->
<script lang="ts">
	let {
		days,
		label,
		format = (n: number) => String(n),
		column = 'Value'
	}: {
		days: { day: string; value: number }[];
		/** what the chart shows, for its accessible name */
		label: string;
		format?: (n: number) => string;
		column?: string;
	} = $props();

	const W = 300;
	const H = 72;
	let hover = $state<number | null>(null);
	const top = $derived(Math.max(0, ...days.map((d) => d.value)));
	const peak = $derived(top || 1);
	const total = $derived(days.reduce((n, d) => n + d.value, 0));
	const slot = $derived(W / Math.max(1, days.length));
	const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

	function barPath(i: number, value: number) {
		if (!value) return '';
		const gap = slot > 6 ? 2 : 1;
		const w = slot - gap;
		const h = Math.max(3, (value / peak) * (H - 4));
		const x = i * slot + gap / 2;
		const y = H - h;
		const r = Math.min(2, w / 2, h);
		// rounded data end on top, square at the baseline
		return `M${x},${H}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H}Z`;
	}
</script>

<figure class="chart">
	<svg
		viewBox="0 0 {W} {H}"
		preserveAspectRatio="none"
		role="img"
		aria-label="{label} over {days.length} days, {format(total)} in total, at most {format(top)} in a day"
		onmouseleave={() => (hover = null)}
	>
		<line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} class="base" />
		{#each days as d, i (d.day)}
			<path d={barPath(i, d.value)} class="bar" class:dim={hover !== null && hover !== i} />
			<!-- hit target wider and taller than the bar -->
			<rect x={i * slot} y="0" width={slot} height={H} fill="transparent" role="presentation" onmouseenter={() => (hover = i)}>
				<title>{dayLabel(d.day)}: {format(d.value)}</title>
			</rect>
		{/each}
	</svg>
	{#if days.length}
		<figcaption class="caption row">
			<span>{dayLabel(days[0].day)}</span><span class="spacer"></span>
			{#if hover !== null}<b>{dayLabel(days[hover].day)}: {format(days[hover].value)}</b><span class="spacer"></span>{/if}
			<span>Today</span>
		</figcaption>
	{/if}
</figure>
<details>
	<summary class="caption">Show as a table</summary>
	<table class="caption">
		<thead><tr><th>Day (UTC)</th><th>{column}</th></tr></thead>
		<tbody>
			{#each days.filter((d) => d.value) as d (d.day)}<tr><td>{dayLabel(d.day)}</td><td class="num">{format(d.value)}</td></tr>{:else}<tr><td colspan="2">None</td></tr>{/each}
		</tbody>
	</table>
</details>

<style>
	.chart {
		margin: var(--space-1) 0 0;
	}
	svg {
		display: block;
		width: 100%;
		height: 72px;
	}
	.base {
		stroke: var(--hairline);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.bar {
		fill: var(--accent-2);
		transition: opacity 150ms;
	}
	.bar.dim {
		opacity: 0.4;
	}
	figcaption {
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	table {
		width: 100%;
		margin-top: var(--space-1h);
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: var(--space-px) 0;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
