<!-- Floating Liquid-Glass tab bar with a spring-animated selection pill. -->
<script lang="ts">
	import { page } from '$app/state';
	import { progress } from '#lib/state/progress.svelte.ts';

	const tabs = [
		{ href: '/', label: 'Today', icon: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z' },
		{ href: '/learn', label: 'Learn', icon: 'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19' },
		{ href: '/review', label: 'Review', icon: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' },
		{ href: '/kana', label: 'Kana', icon: '' },
		{ href: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z' }
	];

	const activeIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((t) => (t.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(t.href)))
		)
	);
</script>

<nav class="tabbar glass sheen" style:--i={activeIndex} style:--n={tabs.length}>
	<span class="pill" aria-hidden="true"></span>
	{#each tabs as t, i}
		<a href={t.href} class:active={i === activeIndex} aria-current={i === activeIndex ? 'page' : undefined}>
			<span class="icon">
				{#if t.icon}
					<svg viewBox="0 0 24 24" width="24" height="24"><path d={t.icon} /></svg>
				{:else}
					<span class="jp kana-icon">あ</span>
				{/if}
				{#if t.href === '/review' && progress.due.length > 0}
					<span class="badge">{progress.due.length > 99 ? '99+' : progress.due.length}</span>
				{/if}
			</span>
			<span class="label">{t.label}</span>
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: fixed;
		z-index: 50;
		left: 50%;
		bottom: calc(var(--safe-bottom) + 12px);
		transform: translateX(-50%);
		width: min(440px, calc(100% - 32px));
		height: var(--tabbar-h);
		border-radius: 999px;
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
		padding: 5px;
		view-transition-name: tabbar;
	}
	.pill {
		position: absolute;
		top: 5px;
		bottom: 5px;
		left: 5px;
		width: calc((100% - 10px) / var(--n));
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		transform: translateX(calc(var(--i) * 100%));
		transition: transform 560ms var(--spring-bouncy);
	}
	a {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		text-decoration: none;
		color: var(--ink-2);
		border-radius: 999px;
		transition:
			color 250ms,
			transform 380ms var(--spring);
	}
	a:active {
		transform: scale(0.92);
	}
	a.active {
		color: var(--accent);
	}
	.icon {
		position: relative;
		height: 26px;
		display: grid;
		place-items: center;
	}
	svg path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.kana-icon {
		font-size: 21px;
		font-weight: 700;
		line-height: 1;
	}
	.label {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.badge {
		position: absolute;
		top: -4px;
		left: 15px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--accent);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 2px var(--bg);
	}
</style>
