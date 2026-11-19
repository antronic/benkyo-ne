<!--
	Section navigation: a vertical list of links in optional groups, with the
	current page marked (aria-current="page", accent tint). In flow; the screen
	that uses it decides where it sits (a fixed sidebar on wide screens, inside
	a Sheet on phones). `current` is the href of the page you are on.
-->
<script lang="ts" module>
	export type SideNavItem = {
		href: string;
		label: string;
		/** a 24×24 stroke icon path (same style as the tab bar) */
		icon?: string;
		/** items with the same group sit together under that heading */
		group?: string;
		/** a short count or note at the end of the row */
		note?: string;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		items: SideNavItem[];
		current: string | null;
		label: string;
		header?: Snippet;
		footer?: Snippet;
		onnavigate?: (href: string) => void;
	};
	let { items, current, label, header, footer, onnavigate }: Props = $props();

	const groups = $derived.by(() => {
		const out: { name: string | undefined; items: SideNavItem[] }[] = [];
		for (const it of items) {
			const last = out.at(-1);
			if (last && last.name === it.group) last.items.push(it);
			else out.push({ name: it.group, items: [it] });
		}
		return out;
	});
</script>

<nav class="side-nav" aria-label={label}>
	{#if header}<div class="head">{@render header()}</div>{/if}
	{#each groups as g, gi (gi)}
		<div class="group">
			{#if g.name}<p class="group-name">{g.name}</p>{/if}
			<ul>
				{#each g.items as it (it.href)}
					<li>
						<a href={it.href} class:current={it.href === current} aria-current={it.href === current ? 'page' : undefined} onclick={() => onnavigate?.(it.href)}>
							{#if it.icon}
								<svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={it.icon} /></svg>
							{/if}
							<span class="label">{it.label}</span>
							{#if it.note}<span class="note">{it.note}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
	{#if footer}<div class="foot">{@render footer()}</div>{/if}
</nav>

<style>
	.side-nav {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.group-name {
		margin: 0;
		padding: 0 var(--space-3);
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-2);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-px);
	}
	a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-control);
		color: inherit;
		text-decoration: none;
		font-size: var(--text-subhead);
		transition:
			background 160ms,
			color 160ms;
	}
	a:hover {
		background: var(--color-fill);
	}
	a:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 1px;
	}
	a.current {
		background: color-mix(in srgb, var(--color-accent) 14%, transparent);
		color: var(--color-accent);
		font-weight: 600;
	}
	.icon {
		flex: none;
	}
	.icon path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note {
		font-size: var(--text-footnote);
		font-variant-numeric: tabular-nums;
		color: var(--color-text-2);
	}
	.head,
	.foot {
		padding: 0 var(--space-3);
	}
</style>
