<!--
	One Kuri on a canvas. Loads the renderer on first use, follows the theme and
	reduced-motion settings, and stops drawing while scrolled off screen.
	Re-created when the outfit or detail level changes, and when the browser drops the
	WebGL context (Safari does after the app sat in the background).
	Kuri never stays blank for good: when the renderer can't load or WebGL can't start
	(too many contexts at once, a context lost again and again), it tries again a little
	later, and a renderer file removed by a newer deploy reloads the app (staleReload).
-->
<script lang="ts">
	import { safeMode, staleReload, isStable, STABLE_EVENT } from '#lib/boot.ts';
	import { loadEngine, currentTheme, reducedMotion, kuriPrefs, type KuriInstance, type KuriOptions, type KuriPose } from './kuri.svelte.ts';

	let {
		pose = 'idle',
		facing = 0,
		options = {},
		detail,
		variant,
		label,
		class: cls = '',
		instance = $bindable(null)
	}: {
		pose?: KuriPose;
		facing?: number;
		options?: KuriOptions;
		/** override the low-poly setting (the intro always uses full detail) */
		detail?: 'full' | 'low';
		/** override the outfit setting (style previews in Settings) */
		variant?: 'bandana' | 'neckerchief';
		/** accessible name; without one the canvas is decorative */
		label?: string;
		class?: string;
		instance?: KuriInstance | null;
	} = $props();

	const useVariant = $derived(variant ?? kuriPrefs.variant);
	const useDetail = $derived(detail ?? kuriPrefs.detail);
	let k = $state<KuriInstance | null>(null);
	/**
	 * Bumped when the browser takes the canvas's WebGL context away (Safari does after the app
	 * sat in the background, a sleep, a GPU switch or memory pressure). A lost context never draws
	 * again, so the canvas is replaced and Kuri is built afresh.
	 */
	let generation = $state(0);
	let rebuilds: number[] = [];
	let later: ReturnType<typeof setTimeout> | undefined;
	function rebuild() {
		const now = Date.now();
		rebuilds = rebuilds.filter((t) => now - t < 60_000);
		// lost again and again (too many contexts): wait out the minute rather than thrash
		if (rebuilds.length >= 3) return retry(60_000);
		rebuilds.push(now);
		generation++;
	}
	/** Try building Kuri again after `ms`, once the page is on screen. */
	let tries = 0;
	function retry(ms = [2_000, 8_000, 30_000][tries] ?? 60_000) {
		tries++;
		clearTimeout(later);
		later = setTimeout(function go() {
			if (document.hidden) return void document.addEventListener('visibilitychange', go, { once: true });
			generation++;
		}, ms);
	}
	$effect(() => () => clearTimeout(later));

	function mount(node: HTMLCanvasElement, init: { variant: 'bandana' | 'neckerchief'; detail: 'full' | 'low' }) {
		let dead = false;
		let inst: KuriInstance | null = null;
		if (safeMode && !isStable()) {
			// the last launches never finished starting: no WebGL until this visit has stayed up a while
			const go = () => void generation++;
			addEventListener(STABLE_EVENT, go, { once: true });
			return { destroy: () => removeEventListener(STABLE_EVENT, go) };
		}
		const dark = matchMedia('(prefers-color-scheme: dark)');
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onTheme = () => inst?.setTheme(currentTheme());
		const onMotion = () => inst?.setReducedMotion(motion.matches);
		const io = new IntersectionObserver(([e]) => inst?.setPaused(!e.isIntersecting));
		let waiting: (() => void) | null = null;
		const onLost = (e: Event) => {
			if (dead || !inst) return; // our own destroy() drops the context on purpose
			e.preventDefault();
			// build again once the page is on screen; a hidden page would only lose it again
			if (!document.hidden) return void rebuild();
			waiting = () => {
				if (document.hidden) return;
				document.removeEventListener('visibilitychange', waiting!);
				waiting = null;
				if (!dead) rebuild();
			};
			document.addEventListener('visibilitychange', waiting);
		};
		node.addEventListener('webglcontextlost', onLost);
		void loadEngine()
			.catch((e) => {
				console.warn('[kuri] renderer could not be loaded', e);
				// a newer deploy removed this build's renderer file: load the new build
				if (/dynamically imported module|Importing a module script failed|Load failed/i.test(String(e?.message ?? e)) && staleReload()) return null;
				if (!dead) retry(); // offline or a hiccup: the app carries on and Kuri tries again
				return null;
			})
			.then((m) => { // ui-ok: decorative companion, Kuri simply appears once the 3D renderer loads (nothing to wait for)
				if (!m || dead) return;
				try {
					inst = m.create(node, { orbit: false, ...options, variant: init.variant, detail: init.detail, theme: currentTheme(), reducedMotion: reducedMotion() });
				} catch (e) {
					console.warn('[kuri] WebGL could not start', e);
					return void retry(); // no WebGL right now (too many contexts): try again shortly
				}
				tries = 0;
				k = instance = inst;
				dark.addEventListener('change', onTheme);
				motion.addEventListener('change', onMotion);
				io.observe(node);
			});
		return {
			destroy() {
				dead = true;
				io.disconnect();
				node.removeEventListener('webglcontextlost', onLost);
				if (waiting) document.removeEventListener('visibilitychange', waiting);
				dark.removeEventListener('change', onTheme);
				motion.removeEventListener('change', onMotion);
				inst?.destroy();
				if (k === inst) k = instance = null;
			}
		};
	}

	$effect(() => {
		k?.setPose(pose);
	});
	$effect(() => {
		k?.setFacing(facing);
	});
</script>

{#key `${useVariant}:${useDetail}:${generation}`}
	<canvas
		class="kuri {cls}"
		use:mount={{ variant: useVariant, detail: useDetail }}
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	></canvas>
{/key}

<style>
	.kuri {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
</style>
