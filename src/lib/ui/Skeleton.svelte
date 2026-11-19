<!--
	Shimmering placeholder while content loads.
	  variant "row"  : avatar circle + two text lines (list items)
	  variant "card" : a tall glass card with a title and lines
	  variant "tile" : a square-ish tile (pack grid)
	  variant "line" : a single text line
-->
<script lang="ts">
	let {
		variant = 'row',
		count = 3,
		label = 'Loading'
	}: { variant?: 'row' | 'card' | 'tile' | 'line'; count?: number; label?: string } = $props();
</script>

<div class="sk {variant}s" role="status" aria-live="polite" aria-label={label}>
	{#each Array(count) as _, i}
		<div class="sk-item glass {variant}" style:--d="{i * 90}ms">
			{#if variant === 'row'}
				<span class="b circle"></span>
				<span class="lines"><span class="b l1"></span><span class="b l2"></span></span>
			{:else if variant === 'card'}
				<span class="b t"></span><span class="b l1"></span><span class="b l2"></span>
			{:else if variant === 'tile'}
				<span class="b l1"></span><span class="b l2"></span>
			{:else}
				<span class="b l1"></span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.sk {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
	}
	.sk.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	}
	.sk-item {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--r-m);
		animation: sk-in 500ms var(--ease-out) both;
		animation-delay: var(--d);
	}
	.sk-item.card {
		flex-direction: column;
		min-height: 120px;
		border-radius: var(--r-l);
	}
	.sk-item.tile {
		flex-direction: column;
		justify-content: flex-end;
		min-height: 104px;
	}
	.sk-item.line {
		padding: 0;
		background: none;
		border: 0;
		box-shadow: none;
	}
	.lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		justify-content: center;
	}
	.b {
		display: block;
		border-radius: 8px;
		height: 12px;
		background: linear-gradient(
			100deg,
			color-mix(in srgb, var(--ink) 7%, transparent) 30%,
			color-mix(in srgb, var(--ink) 15%, transparent) 50%,
			color-mix(in srgb, var(--ink) 7%, transparent) 70%
		);
		background-size: 300% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	.circle {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
	}
	.t {
		height: 20px;
		width: 55%;
	}
	.l1 {
		width: 80%;
	}
	.l2 {
		width: 50%;
	}
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
	@keyframes sk-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.b {
			animation: none;
		}
	}
</style>
