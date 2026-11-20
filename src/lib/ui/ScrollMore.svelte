<!--
	"More below" button. It floats above the bottom of the screen while more than about half a
	screen of the page is still below, and scrolls smoothly to the end when tapped (instantly
	under prefers-reduced-motion). It hides near the bottom.

	The root layout puts one on every screen, so a screen only needs to tell it what to clear:
	- `nav`: the bottom tab bar is on this screen (ignored on the side rail, where there is none)
	- `clear`: px of a fixed bar of the screen's own, such as the Ask AI composer
	A full-screen sheet that scrolls itself (the beta consent) puts its own inside the sheet with
	`target` set to the scrolling element.
	The safe area and the on-screen keyboard (--kb) are always cleared.
	`demo` draws it in place and always shown, for /design.
-->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from './Button.svelte';
	import { showMore } from './scrollMore.ts';

	type Props = { nav?: boolean; clear?: number; demo?: boolean; target?: HTMLElement };
	let { nav = false, clear = 0, demo = false, target }: Props = $props();

	let shown = $state(false);

	// The page (window) scrolls, unless `target` is given: a full-screen sheet that scrolls itself.
	$effect(() => {
		if (demo) return;
		const el = target;
		let frame = 0;
		const measure = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				shown = el ? showMore(el.scrollTop, el.clientHeight, el.scrollHeight) : showMore(scrollY, innerHeight, document.documentElement.scrollHeight);
			});
		};
		const scroller: HTMLElement | Window = el ?? window;
		scroller.addEventListener('scroll', measure, { passive: true });
		addEventListener('resize', measure);
		// content that grows or shrinks (a lesson loading, a chat answer streaming in, a section opening)
		const ro = new ResizeObserver(measure);
		ro.observe(el ?? document.body);
		for (const child of el?.children ?? []) ro.observe(child);
		measure();
		return () => {
			scroller.removeEventListener('scroll', measure);
			removeEventListener('resize', measure);
			ro.disconnect();
			cancelAnimationFrame(frame);
		};
	});

	function jump() {
		const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
		if (target) target.scrollTo({ top: target.scrollHeight, behavior });
		else scrollTo({ top: document.documentElement.scrollHeight, behavior });
		// the button hides on the way down; keep keyboard focus on the page, not on nothing
		const home = target ?? document.querySelector('main');
		if (home && document.activeElement?.closest('.scroll-more')) {
			if (!home.hasAttribute('tabindex')) home.setAttribute('tabindex', '-1');
			home.focus({ preventScroll: true });
		}
	}
</script>

<div class="scroll-more" class:demo class:shown={demo || shown} class:nav class:sheet={!!target} style:--clear="{clear}px" inert={!demo && !shown}>
	<Button variant="ghost" size="md" class="scroll-more-btn" aria-label={t('scrollMore.label')} onclick={jump}>
		{#snippet icon()}
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v13M6 12l6 6 6-6" /></svg>
		{/snippet}
		{t('scrollMore.text')}
	</Button>
</div>

<style>
	.scroll-more {
		position: fixed;
		z-index: 45; /* above the page and the Ask composer (30), under the tab bar (50) and sheets (60) */
		/* centred in the area left free by side status bars, like the tab bar */
		left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		bottom: calc(var(--safe-bottom) + var(--kb) + var(--clear) + var(--space-3));
		transform: translate(-50%, var(--space-4));
		opacity: 0;
		pointer-events: none;
		transition:
			opacity var(--dur-fast),
			transform var(--dur-base) var(--spring);
	}
	/* the bottom tab bar sits 12px above the safe area and is --tabbar-h tall */
	.scroll-more.nav {
		bottom: calc(var(--safe-bottom) + 12px + var(--tabbar-h) + var(--clear) + var(--space-3)); /* ui-ok: 12px is the tab bar's own offset (TabBar.svelte) */
	}
	/* Side rail (RAIL_QUERY): no bottom bar, and the column starts right of the rail. */
	@media (min-width: 600px) and (orientation: landscape), (min-width: 840px) {
		.scroll-more {
			left: calc(var(--rail) + (100% - var(--rail) - var(--safe-right)) / 2);
		}
		.scroll-more.nav {
			bottom: calc(var(--safe-bottom) + var(--kb) + var(--clear) + var(--space-5));
		}
	}
	/* inside a full-screen sheet there is no rail: centre on the screen */
	@media (min-width: 600px) and (orientation: landscape), (min-width: 840px) {
		.scroll-more.sheet {
			left: calc(var(--safe-left) + (100% - var(--safe-left) - var(--safe-right)) / 2);
		}
	}
	:global(html.nav-side) .scroll-more.nav {
		bottom: calc(var(--safe-bottom) + var(--kb) + var(--clear) + var(--space-3));
	}
	.scroll-more.shown {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: auto;
	}
	.scroll-more.demo {
		position: static;
		transform: none;
		display: inline-block;
	}
	.scroll-more :global(.scroll-more-btn) {
		background: var(--glass-strong);
		box-shadow: var(--shadow-raised), var(--glass-shadow);
	}
	svg path {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	@media (prefers-reduced-motion: reduce) {
		.scroll-more {
			transition: opacity var(--dur-fast);
		}
	}
</style>
