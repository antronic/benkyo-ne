<!-- ui-ok-file: app shell navigation, not a kit control -->
<!--
	Main navigation, adaptive (src/lib/nav.ts, docs/DESIGN-SYSTEM.md "Navigation for many items"):
	  bottom bar (phones, unfolded iPhone Duo portrait, iPad portrait): a floating
	    Liquid-Glass bar with the learner's pinned tabs and More (5 places on a phone,
	    7 from 600 px). More opens a sheet with the other screens and "Edit tab bar".
	    While you are on a screen from More, the More tab takes its icon and name, so
	    the bar always shows where you are. The bar shrinks while you scroll down, comes
	    back when you scroll up, and tapping the active tab scrolls to top (iOS).
	  folded Duo / iOS 27 side status column: the same tabs as an icon column under
	    the battery.
	  side rail (RAIL_QUERY: regular + landscape, or ≥ 840 px): every screen, in groups,
	    Settings last. Too short for all of them (railFits), it shows the pinned tabs + More.
	  sidebar (SIDEBAR_QUERY, ≥ 1200 px): every screen with its label under group headings.
-->
<script lang="ts">
	import { t as tr } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { backOut, cubicIn } from 'svelte/easing';
	import { insets, rail, railFits, sidebar, SIDE_RAIL_MIN } from '#lib/ios/device.svelte.ts';
	import { barSlots, cleanPins, GROUP_LABEL, grouped, itemFor, MORE_ICON, NAV_ITEMS, splitBar, type NavItem } from '#lib/nav.ts';
	import NavIcon from './NavIcon.svelte';
	import NavMore from './NavMore.svelte';

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

	let vw = $state(typeof innerWidth === 'number' ? innerWidth : 390);
	const layout = $derived<'bar' | 'side' | 'rail' | 'sidebar'>(sidebar.current ? 'sidebar' : rail.current ? 'rail' : side ? 'side' : 'bar');
	/** every screen in groups, or pinned tabs + More */
	const full = $derived(layout === 'sidebar' || (layout === 'rail' && railFits.current));
	const slots = $derived(full ? NAV_ITEMS.length : layout === 'bar' ? barSlots(vw) : 5);
	const pins = $derived(cleanPins(progress.settings.navPins));
	const split = $derived(splitBar(slots, pins));
	const here = $derived(itemFor(page.url.pathname));
	const inMore = $derived(!!here && split.more.includes(here));
	const due = $derived(progress.due.length);
	const dueText = $derived(due > 99 ? '99+' : String(due));
	const reviewInMore = $derived(split.more.some((i) => i.href === '/review'));
	/** the sliding pill's place in the compact bar */
	const activeIndex = $derived(inMore ? split.tabs.length : Math.max(0, split.tabs.findIndex((i) => i === here)));
	const places = $derived(split.tabs.length + (split.more.length ? 1 : 0));

	let moreOpen = $state(false);
	// a link in the sheet navigates: close it on arrival
	$effect(() => {
		void page.url.pathname;
		moreOpen = false;
	});

	let minimized = $state(false);
	onMount(() => {
		let lastY = scrollY;
		const onScroll = () => {
			const y = scrollY;
			if (Math.abs(y - lastY) < 6) return;
			minimized = y > lastY && y > 80;
			lastY = y;
		};
		const onResize = () => (vw = innerWidth);
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', onResize);
		return () => {
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onResize);
		};
	});

	function tap(e: MouseEvent, item: NavItem) {
		haptic('selection');
		if (item === here && page.url.pathname === item.href) {
			e.preventDefault();
			scrollTo({ top: 0, behavior: 'smooth' });
		}
		minimized = false;
	}
	function openMore() {
		haptic('selection');
		minimized = false;
		moreOpen = true;
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

{#snippet link(item: NavItem)}
	<a href={item.href} class:active={item === here} aria-current={item === here ? 'page' : undefined} onclick={(e) => tap(e, item)}>
		<span class="icon">
			<NavIcon path={item.icon} />
			{#if item.href === '/review' && due > 0 && layout !== 'sidebar'}
				<span class="badge" aria-label={tr('nav.due', { n: due })}>{dueText}</span>
			{/if}
		</span>
		<span class="label">{tr(item.label)}</span>
		{#if item.href === '/review' && due > 0 && layout === 'sidebar'}
			<span class="badge end" aria-label={tr('nav.due', { n: due })}>{dueText}</span>
		{/if}
	</a>
{/snippet}

<nav
	in:barSlide|global
	out:barSlide|global={{ out: true }}
	class="tabbar glass sheen {layout}"
	class:full
	class:minimized={minimized && layout === 'bar'}
	style:--i={activeIndex}
	style:--n={places}
	aria-label={tr('nav.main')}
>
	{#if full}
		{#if layout === 'sidebar'}<div class="brand"><span class="jp">勉強ね</span> Benkyo</div>{/if}
		{#each grouped() as g (g.group)}
			<div class="group g-{g.group}" role="group" aria-label={tr(GROUP_LABEL[g.group])}>
				{#if layout === 'sidebar' && g.group !== 'you'}<div class="heading" aria-hidden="true">{tr(GROUP_LABEL[g.group])}</div>{/if}
				{#each g.items as item (item.href)}{@render link(item)}{/each}
			</div>
		{/each}
	{:else}
		<span class="pill" aria-hidden="true"></span>
		{#each split.tabs as item (item.href)}{@render link(item)}{/each}
		{#if split.more.length}
			<button
				type="button"
				class="more"
				class:active={inMore}
				aria-haspopup="dialog"
				aria-expanded={moreOpen}
				aria-label={inMore && here ? tr('nav.moreHere', { screen: tr(here.label) }) : tr('nav.more')}
				onclick={openMore}
			>
				<span class="icon">
					<NavIcon path={inMore && here ? here.icon : MORE_ICON} />
					{#if reviewInMore && due > 0}<span class="badge" aria-hidden="true">{dueText}</span>{/if}
				</span>
				<span class="label">{inMore && here ? tr(here.label) : tr('nav.more')}</span>
			</button>
		{/if}
	{/if}
</nav>

<NavMore open={moreOpen} onclose={() => (moreOpen = false)} more={split.more} current={here?.href ?? null} room={slots - 1} {pins} {due} onpins={(p) => progress.saveSettings({ navPins: p })} />

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
	/* seven places from 600 px (unfolded Duo portrait, iPad portrait) */
	@media (min-width: 600px) {
		.tabbar.bar {
			width: min(600px, calc(100% - 48px - var(--safe-left) - var(--safe-right)));
		}
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
	a,
	.more {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-px);
		min-height: 44px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-decoration: none;
		color: var(--ink-2);
		border-radius: 999px;
		cursor: pointer;
		-webkit-touch-callout: none;
		transition:
			color 250ms,
			background-color 250ms,
			transform 380ms var(--spring);
	}
	a:active,
	.more:active {
		transform: scale(0.9);
	}
	a.active,
	.more.active {
		color: var(--accent);
	}
	a:focus-visible,
	.more:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.icon {
		position: relative;
		height: 26px;
		display: grid;
		place-items: center;
		font-size: 21px;
	}
	.label {
		max-width: 100%;
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.01em;
		transition: opacity 200ms;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
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
		line-height: 1;
		display: grid;
		place-items: center;
		box-shadow: 0 0 0 2px var(--bg);
	}

	/* ---- compact + side status column: icon column under the battery ---- */
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
	.tabbar.rail {
		left: calc(env(safe-area-inset-left, 0px) + 10px);
		top: 50%;
		bottom: auto;
		transform: translateY(-50%);
		width: var(--rail-w);
		height: auto;
		border-radius: 26px;
		grid-template-columns: 1fr;
		grid-auto-rows: 58px;
		padding: var(--space-1h);
	}
	.tabbar.rail .pill {
		top: 6px;
		left: 6px;
		right: 6px;
		bottom: auto;
		width: auto;
		height: 58px;
		border-radius: 20px;
		transform: translateY(calc(var(--i) * 100%));
	}
	.tabbar.rail a,
	.tabbar.rail .more {
		border-radius: 20px;
		min-height: 58px;
	}
	/* every screen, in groups: a hairline between groups, the active one tinted */
	.tabbar.full {
		display: flex;
		flex-direction: column;
	}
	.group {
		display: flex;
		flex-direction: column;
	}
	.tabbar.rail.full .group + .group {
		margin-top: var(--space-1h);
		padding-top: var(--space-1h);
		border-top: 1px solid var(--hairline);
	}
	.tabbar.full a.active {
		background: color-mix(in srgb, var(--ink) 9%, transparent);
	}

	/* ---- sidebar (SIDEBAR_QUERY: desktop) ---- */
	.tabbar.sidebar {
		left: calc(env(safe-area-inset-left, 0px) + 12px);
		top: calc(var(--safe-top) + 12px);
		bottom: 12px;
		transform: none;
		width: var(--rail-w);
		height: auto;
		border-radius: 26px;
		padding: var(--space-4) var(--space-3);
		gap: var(--space-4);
		overflow-y: auto;
	}
	.brand {
		padding: 0 var(--space-3);
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--ink);
	}
	.brand .jp {
		color: var(--accent);
	}
	.heading {
		padding: 0 var(--space-3) var(--space-1);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-3);
	}
	.g-you {
		margin-top: auto;
	}
	.tabbar.sidebar .group {
		gap: var(--space-px);
	}
	.tabbar.sidebar a {
		flex-direction: row;
		justify-content: flex-start;
		gap: var(--space-3);
		min-height: 44px;
		padding: 0 var(--space-3);
		border-radius: 14px;
	}
	.tabbar.sidebar a:active {
		transform: scale(0.97);
	}
	.tabbar.sidebar .label {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0;
	}
	.tabbar.sidebar .icon {
		width: 26px;
	}
	.badge.end {
		position: static;
		margin-left: auto;
		box-shadow: none;
	}
</style>
