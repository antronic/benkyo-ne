<!-- A main-navigation icon (src/lib/nav.ts): a stroked 24×24 path, or あ for Kana. -->
<script lang="ts">
	let { path, size = 24 }: { path: string; size?: number } = $props();
</script>

{#if path}
	<svg class="nav-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={path} /></svg>
{:else}
	<span class="jp kana-icon" style:font-size="{Math.round(size * 0.875)}px" aria-hidden="true">あ</span>
{/if}

<style>
	.nav-icon {
		flex: none;
	}
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.kana-icon {
		display: inline-grid;
		place-items: center;
		width: 1.15em;
		font-weight: 700;
		line-height: 1;
	}
</style>
