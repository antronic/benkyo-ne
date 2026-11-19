<!--
	A table for lists of records (accounts, audit rows, grants). Wide: real
	columns with headers. Narrow (under 560px of its own width): each row
	becomes a stacked card with "Label  value" lines, so phones never scroll
	sideways. With `href`, the whole row opens that page. Cells come from the
	`cell` snippet: {#snippet cell(row, col)}…{/snippet}.
-->
<script lang="ts" module>
	export type DataColumn = {
		key: string;
		label: string;
		align?: 'start' | 'end';
		/** e.g. '30%' or '120px'; the rest share what is left */
		width?: string;
	};
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Card from './Card.svelte';

	type Props = {
		columns: DataColumn[];
		rows: T[];
		key: (row: T) => string | number;
		/** names the table for screen readers */
		label: string;
		cell: Snippet<[T, DataColumn]>;
		href?: (row: T) => string | null;
	};
	let { columns, rows, key, label, cell, href }: Props = $props();
</script>

<Card padding="none" class="ui-table-card">
	<div class="ui-table-wrap">
		<table aria-label={label}>
			<thead>
				<tr>
					{#each columns as c (c.key)}<th scope="col" class:end={c.align === 'end'} style:width={c.width}>{c.label}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as r (key(r))}
					{@const link = href?.(r) ?? null}
					<tr class:link={!!link}>
						{#each columns as c, i (c.key)}
							<td class:end={c.align === 'end'} data-label={c.label}>
								{#if i === 0 && link}
									<a class="row-link" href={link}>{@render cell(r, c)}</a>
								{:else}
									<span class="v">{@render cell(r, c)}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Card>

<style>
	.ui-table-wrap {
		container-type: inline-size;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-subhead);
	}
	th {
		text-align: left;
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-2);
		padding: var(--space-3) var(--space-4) var(--space-2);
		border-bottom: var(--hairline-w) solid var(--color-border);
		white-space: nowrap;
	}
	td {
		padding: var(--space-3) var(--space-4);
		vertical-align: middle;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	tbody tr + tr td {
		border-top: var(--hairline-w) solid var(--color-border);
	}
	.end {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	tr.link {
		position: relative;
		cursor: pointer;
		transition: background 160ms;
	}
	tr.link:hover {
		background: var(--color-fill);
	}
	td :global(a:not(.row-link)) {
		position: relative;
		z-index: 1;
		color: var(--color-link);
		text-decoration: none;
	}
	td :global(a:not(.row-link):hover) {
		text-decoration: underline;
	}
	.row-link {
		color: inherit;
		text-decoration: none;
	}
	/* the first cell's link covers the whole row */
	.row-link::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.row-link:focus-visible {
		outline: none;
	}
	tr.link:has(.row-link:focus-visible) {
		box-shadow: inset 0 0 0 3px var(--color-focus);
	}

	/* Narrow: one card-like block per row, a label before each value. */
	@container (max-width: 559px) {
		table,
		tbody,
		tr,
		td {
			display: block;
		}
		thead {
			display: none;
		}
		tr {
			padding: var(--space-3) var(--space-4);
		}
		tbody tr + tr {
			border-top: var(--hairline-w) solid var(--color-border);
		}
		tbody tr + tr td {
			border-top: 0;
		}
		td {
			padding: var(--space-px) 0;
			display: flex;
			gap: var(--space-3);
			justify-content: space-between;
			align-items: baseline;
			text-align: right;
		}
		td::before {
			content: attr(data-label);
			flex: none;
			color: var(--color-text-2);
			font-size: var(--text-footnote);
			text-align: left;
		}
		td:first-child {
			text-align: left;
			font-weight: 600;
			padding-bottom: var(--space-1);
		}
		td:first-child::before {
			content: none;
		}
		/* nothing to show: skip the line */
		td:has(> .v:empty) {
			display: none;
		}
	}
</style>
