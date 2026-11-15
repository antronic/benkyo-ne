<!--
	One Kuri on a canvas. Loads the renderer on first use, follows the theme and
	reduced-motion settings, and stops drawing while scrolled off screen.
	Re-created when the outfit or detail level changes.
-->
<script lang="ts">
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

	function mount(node: HTMLCanvasElement, init: { variant: 'bandana' | 'neckerchief'; detail: 'full' | 'low' }) {
		let dead = false;
		let inst: KuriInstance | null = null;
		const dark = matchMedia('(prefers-color-scheme: dark)');
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onTheme = () => inst?.setTheme(currentTheme());
		const onMotion = () => inst?.setReducedMotion(motion.matches);
		const io = new IntersectionObserver(([e]) => inst?.setPaused(!e.isIntersecting));
		void loadEngine().then((m) => {
			if (dead) return;
			try {
				inst = m.create(node, { orbit: false, ...options, variant: init.variant, detail: init.detail, theme: currentTheme(), reducedMotion: reducedMotion() });
			} catch {
				return; // no WebGL: Kuri just doesn't appear
			}
			k = instance = inst;
			dark.addEventListener('change', onTheme);
			motion.addEventListener('change', onMotion);
			io.observe(node);
		});
		return {
			destroy() {
				dead = true;
				io.disconnect();
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

{#key `${useVariant}:${useDetail}`}
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
