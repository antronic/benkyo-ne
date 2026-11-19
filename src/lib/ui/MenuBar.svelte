<!--
	Phone section switcher: a glass pill that names the page you are on and
	opens the section menu (usually a Sheet with a SideNav). Floats above the
	bottom edge where the tab bar would be; `floating={false}` keeps it in flow
	(the /design catalog).
-->
<script lang="ts">
	type Props = {
		/** the current page, shown on the pill */
		current: string;
		/** what the pill opens, for screen readers: "Fleet menu" */
		label: string;
		icon?: string;
		expanded?: boolean;
		floating?: boolean;
		onmenu: () => void;
	};
	let { current, label, icon, expanded = false, floating = true, onmenu }: Props = $props();
</script>

<div class="menu-bar" class:floating>
	<button type="button" class="pill glass sheen" aria-haspopup="dialog" aria-expanded={expanded} aria-label="{label}: {current}" onclick={onmenu}>
		{#if icon}
			<svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={icon} /></svg>
		{/if}
		<span class="current">{current}</span>
		<svg class="burger" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
	</button>
</div>

<style>
	.menu-bar {
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.menu-bar.floating {
		position: fixed;
		z-index: 45;
		left: 0;
		right: 0;
		bottom: calc(var(--safe-bottom) + var(--space-3));
	}
	.pill {
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 48px;
		max-width: min(360px, calc(100vw - 2 * var(--space-6)));
		padding: var(--space-2) var(--space-5);
		border-radius: var(--radius-pill);
		color: inherit;
		font: inherit;
		font-weight: 600;
		font-size: var(--text-subhead);
		cursor: pointer;
		transition: transform 380ms var(--spring);
	}
	.pill:active {
		transform: scale(0.96);
	}
	.pill:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}
	.icon {
		color: var(--color-accent);
		flex: none;
	}
	.current {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.burger {
		flex: none;
		opacity: 0.6;
	}
	svg path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
