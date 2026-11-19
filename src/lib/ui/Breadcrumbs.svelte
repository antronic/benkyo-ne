<!--
	Where you are, as a trail of links: "Fleet › Accounts › Kenji". Every item
	but the last is a link; the last is the current page (aria-current="page").
	The first link doubles as the way back on screens without a back button.
-->
<script lang="ts">
	type Crumb = { label: string; href?: string };
	let { items, label = 'Breadcrumb' }: { items: Crumb[]; label?: string } = $props();
</script>

<nav class="crumbs" aria-label={label}>
	<ol>
		{#each items as c, i (i)}
			<li>
				{#if i < items.length - 1 && c.href}
					<a href={c.href}>{#if i === items.length - 2}<span class="back" aria-hidden="true">‹</span>{/if}{c.label}</a>
					<span class="sep" aria-hidden="true">›</span>
				{:else}
					<span class="here" aria-current="page">{c.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-footnote);
		color: var(--color-text-2);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 32px;
		color: var(--color-link);
		text-decoration: none;
		font-weight: 500;
	}
	a:hover {
		text-decoration: underline;
	}
	.back {
		display: none;
		font-size: 1.25em;
		line-height: 1;
	}
	.here {
		color: var(--color-text);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 60vw;
	}
	/* Phones: only the parent link shows, as "‹ Accounts", so the trail stays one line. */
	@media (max-width: 599px) {
		li:not(:nth-last-child(2)) {
			display: none;
		}
		.back {
			display: inline;
		}
		.sep {
			display: none;
		}
	}
</style>
