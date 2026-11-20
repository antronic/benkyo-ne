<!-- ui-ok-file: app shell navigation, not a kit control -->
<!--
	Navigation, adaptive:
	  compact (folded iPhone Duo / regular iPhones): floating Liquid-Glass tab
	    bar at the bottom. It shrinks while you scroll down, comes back when you
	    scroll up, and tapping the active tab scrolls to top (iOS behaviour).
	  unfolded iPhone Duo, portrait: still the bottom bar (the screen is tall,
	    so a rail would only steal width from the content).
	  regular + landscape, or ≥ 840 px (RAIL_QUERY): a glass side rail,
	    following iOS 27's move of controls to the side to free vertical space.
-->
<script lang="ts">
	import { t as tr, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { backOut, cubicIn } from 'svelte/easing';
	import { insets, rail, SIDE_RAIL_MIN } from '#lib/ios/device.svelte.ts';

	// Compact screens with a right-side status column (iOS 27, folded iPhone Duo):
	// put the tab bar in that column, under the battery.
	const side = $derived(
		!rail.current &&
			(progress.settings.navPosition === 'side' ||
				(progress.settings.navPosition === 'auto' && insets.right >= SIDE_RAIL_MIN))
	);
	$effect(() => {
		document.documentElement.classList.toggle('nav-side', side);
		return () => document.documentElement.classList.remove('nav-side');
	});

	const tabs = [
		{ href: '/', label: 'nav.today' as MessageKey, icon: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z' },
		{ href: '/learn', label: 'nav.learn' as MessageKey, icon: 'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19' },
		{ href: '/words', label: 'nav.words' as MessageKey, icon: 'M4 6.5A2.5 2.5 0 0 1 6.5 4H17a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6.5A2.5 2.5 0 0 1 4 17.5zM8 9h8M8 13h5' },
		{ href: '/community', label: 'nav.community' as MessageKey, icon: 'M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM19 9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2v3l-4-3h-3' },
		{ href: '/ai', label: 'nav.ai' as MessageKey, icon: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' },
		{ href: '/review', label: 'nav.review' as MessageKey, icon: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4' },
		{ href: '/kana', label: 'nav.kana' as MessageKey, icon: '' },
		{ href: '/settings', label: 'nav.settings' as MessageKey, icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z' }
	];

	const activeIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((t) => (t.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(t.href)))
		)
	);

	let minimized = $state(false);
	onMount(() => {
		let lastY = scrollY;
		const onScroll = () => {
			const y = scrollY;
			if (Math.abs(y - lastY) < 6) return;
			minimized = y > lastY && y > 80;
			lastY = y;
		};
		addEventListener('scroll', onScroll, { passive: true });
		return () => removeEventListener('scroll', onScroll);
	});

	function tap(e: MouseEvent, i: number) {
		haptic('selection');
		if (i === activeIndex) {
			e.preventDefault();
			scrollTo({ top: 0, behavior: 'smooth' });
		}
		minimized = false;
	}

	/**
	 * Slide the bar out/in when entering/leaving immersive screens. Animates
	 * the standalone CSS `translate` property so it composes with the bar's
	 * own positioning transform. Direction follows where the bar lives.
	 */
	function barSlide(_node: Element, { out = false } = {}) {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dir = side ? 'right' : rail.current ? 'left' : 'down';
		return {
			duration: reduce ? 0 : out ? 260 : 520,
			easing: out ? cubicIn : backOut,
			css: (t: number) => {
				const d = (1 - t) * (dir === 'down' ? 140 : 110);
				const tr = dir === 'down' ? `0 ${d}px` : dir === 'right' ? `${d}px 0` : `${-d}px 0`;
				return `translate: ${tr}; opacity: ${Math.min(1, t * 1.6)}; filter: blur(${(1 - t) * 4}px);`;
			}
		};
	}
</script>

<nav in:barSlide|global out:barSlide|global={{ out: true }} class="tabbar glass sheen" class:minimized={minimized && !side} class:side style:--i={activeIndex} style:--n={tabs.length} aria-label={tr('nav.main')}>
	<span class="pill" aria-hidden="true"></span>
	{#each tabs as t, i}
		<a href={t.href} class:active={i === activeIndex} aria-current={i === activeIndex ? 'page' : undefined} onclick={(e) => tap(e, i)}>
			<span class="icon">
				{#if t.icon}
					<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={t.icon} /></svg>
				{:else}
					<span class="jp kana-icon" aria-hidden="true">あ</span>
				{/if}
				{#if t.href === '/review' && progress.due.length > 0}
					<span class="badge" aria-label={tr('nav.due', { n: progress.due.length })}>{progress.due.length > 99 ? '99+' : progress.due.length}</span>
				{/if}
			</span>
			<span class="label">{tr(t.label)}</span>
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: fixed;
		z-index: 50;
		/* centred in the area left free by side status bars */
		left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		bottom: calc(var(--safe-bottom) + 12px);
		transform: translateX(-50%);
		width: min(440px, calc(100% - 32px - var(--safe-left) - var(--safe-right)));
		height: var(--tabbar-h);
		border-radius: 999px;
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
		padding: var(--space-1h);
		view-transition-name: tabbar;
		transition:
			width 520ms var(--spring),
			height 520ms var(--spring),
			transform 520ms var(--spring);
	}
	/* iOS 26/27 style: tab bar shrinks while scrolling content */
	.tabbar.minimized {
		height: 50px;
		width: min(300px, calc(100% - 96px));
	}
	.tabbar.minimized .label {
		opacity: 0;
		height: 0;
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
		gap: var(--space-px);
		min-height: 44px;
		text-decoration: none;
		color: var(--ink-2);
		border-radius: 999px;
		-webkit-touch-callout: none;
		transition:
			color 250ms,
			transform 380ms var(--spring);
	}
	a:active {
		transform: scale(0.9);
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
		transition: opacity 200ms;
		overflow: hidden;
	}
	.badge {
		position: absolute;
		top: -4px;
		left: 15px;
		min-width: 18px;
		height: 18px;
		padding: 0 var(--space-1h);
		border-radius: 9px;
		background: var(--accent);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 2px var(--bg);
	}

	/* ---- compact + side status column: icon rail under the battery ---- */
	.tabbar.side {
		left: auto;
		right: max(4px, calc((var(--safe-right) - 60px) / 2));
		top: auto;
		bottom: calc(var(--safe-bottom) + 16px);
		transform: none;
		width: 60px;
		height: auto;
		border-radius: 30px;
		grid-template-columns: 1fr;
		grid-auto-rows: 52px;
		padding: var(--space-1);
	}
	.tabbar.side .label {
		display: none;
	}
	.tabbar.side .pill {
		top: 4px;
		left: 4px;
		right: 4px;
		bottom: auto;
		width: auto;
		height: 52px;
		transform: translateY(calc(var(--i) * 100%));
	}
	.tabbar.side .badge {
		left: 22px;
	}

	/* ---- side rail (RAIL_QUERY: unfolded iPhone Duo landscape, iPad) ---- */
	@media (min-width: 600px) and (orientation: landscape), (min-width: 840px) {
		.tabbar,
		.tabbar.minimized {
			left: calc(env(safe-area-inset-left, 0px) + 10px);
			top: 50%;
			bottom: auto;
			transform: translateY(-50%);
			width: var(--rail-w);
			height: auto;
			border-radius: 26px;
			grid-template-columns: 1fr;
			grid-auto-rows: 62px;
			padding: var(--space-1h);
		}
		.tabbar.minimized .label {
			opacity: 1;
			height: auto;
		}
		.pill {
			top: 6px;
			left: 6px;
			right: 6px;
			bottom: auto;
			width: auto;
			height: 62px;
			border-radius: 20px;
			transform: translateY(calc(var(--i) * 100%));
		}
		a {
			border-radius: 20px;
		}
	}
</style>
