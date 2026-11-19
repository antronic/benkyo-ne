<!--
	Kuri on Today: a small draggable avatar that wanders along the bottom of the
	screen when left alone, sits, and dozes off after half a minute.
	Tap for a hop and a short line; drag to pick Kuri up and put it somewhere else.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Kuri from './Kuri.svelte';
	import { walkerSpot, reducedMotion, kuriSound, type KuriPose } from './kuri.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { t, tn } from '#lib/i18n/index.svelte.ts';

	let { hidden = false }: { hidden?: boolean } = $props();

	const S = 104;
	let x = $state(0);
	let y = $state(0);
	let pose = $state<KuriPose>('idle');
	let facing = $state(0);
	let say = $state('');
	let sayLeft = $state(0);
	let el: HTMLDivElement;

	type Mode = 'idle' | 'walk' | 'held' | 'sleep' | 'react';
	let mode: Mode = 'idle';
	let tx = 0,
		ty = 0,
		nextAt = 0,
		lastTouch = 0,
		reactUntil = 0,
		sayUntil = 0;

	function bounds() {
		const cs = getComputedStyle(document.documentElement);
		const tab = parseFloat(cs.getPropertyValue('--tabbar-h')) || 0;
		const vw = document.documentElement.clientWidth;
		const vh = innerHeight;
		const bottom = vh - tab - 40 - S;
		return { left: 6, right: vw - S - 6, top: Math.max(vh * 0.5, bottom - 200), bottom, vh };
	}
	function set(m: Mode, p: KuriPose = m as KuriPose) {
		mode = m;
		pose = p;
	}
	function face(a: number) {
		while (a - facing > Math.PI) a -= 2 * Math.PI;
		while (a - facing < -Math.PI) a += 2 * Math.PI;
		facing = a;
	}
	function line() {
		const due = progress.due.length;
		const pool = [t('kuri.sayCheer'), t('kuri.sayAsk')];
		if (due) pool.push(tn('kuri.sayDue', due));
		else pool.push(t('kuri.sayRest'));
		if (progress.streak.days > 1) pool.push(tn('kuri.sayStreak', progress.streak.days));
		return pool[Math.floor(Math.random() * pool.length)];
	}
	function speak() {
		say = line();
		sayUntil = performance.now() + 2400;
	}

	let drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
	function down(e: PointerEvent) {
		drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		lastTouch = performance.now();
	}
	function move(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.sx,
			dy = e.clientY - drag.sy;
		if (!drag.moved && Math.hypot(dx, dy) > 6) {
			drag.moved = true;
			face(0);
			set('held');
			haptic('selection');
			kuriSound('held');
		}
		if (drag.moved) {
			const b = bounds();
			x = Math.min(Math.max(-10, drag.ox + dx), b.right + 10);
			y = Math.min(Math.max(60, drag.oy + dy), b.bottom);
		}
	}
	function up() {
		if (!drag) return;
		lastTouch = performance.now();
		if (drag.moved) {
			set('idle');
			nextAt = performance.now() + 4000;
		} else {
			face(0);
			set('react', 'happy');
			haptic('success');
			kuriSound(Math.random() < 0.5 ? 'tap' : 'yip');
			reactUntil = performance.now() + 1500;
			speak();
		}
		drag = null;
	}

	onMount(() => {
		const b = bounds();
		x = b.right - 8;
		y = b.bottom;
		lastTouch = performance.now();
		nextAt = lastTouch + 3000;
		let raf = 0,
			last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const still = reducedMotion();
			if (sayUntil && now > sayUntil) (say = ''), (sayUntil = 0);
			if (mode === 'react' && now > reactUntil) (set('idle'), (nextAt = now + 2500));
			if (!hidden && !still && mode === 'idle' && now - lastTouch > 30000) (set('sleep'), kuriSound('sleep'));
			if (!hidden && !still && progress.settings.kuriWalk && mode === 'idle' && now > nextAt) {
				const b = bounds();
				tx = b.left + Math.random() * (b.right - b.left);
				ty = b.top + Math.random() * (b.bottom - b.top);
				if (Math.hypot(tx - x, ty - y) > 40) (face(Math.atan2(tx - x, ty - y)), set('walk'));
				else nextAt = now + 1500;
			}
			if (mode === 'walk') {
				if (still || !progress.settings.kuriWalk) set('idle');
				else {
					const dx = tx - x,
						dy = ty - y,
						d = Math.hypot(dx, dy),
						v = 58 * dt;
					if (d <= v) {
						x = tx;
						y = ty;
						face(0);
						set('idle');
						nextAt = now + 3500 + Math.random() * 4000;
					} else {
						x += (dx / d) * v;
						y += (dy / d) * v;
					}
				}
			}
			walkerSpot.x = x;
			walkerSpot.y = y;
			if (say && el) sayLeft = Math.min(Math.max(8, x + S / 2 - el.offsetWidth / 2), document.documentElement.clientWidth - el.offsetWidth - 8);
			raf = document.hidden ? 0 : requestAnimationFrame(tick);
		};
		const vis = () => {
			if (!document.hidden && !raf) (last = performance.now()), (raf = requestAnimationFrame(tick));
		};
		document.addEventListener('visibilitychange', vis);
		raf = requestAnimationFrame(tick);
		walkerSpot.visible = true;
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('visibilitychange', vis);
			walkerSpot.visible = false;
		};
	});
</script>

<div
	class="walker"
	class:hidden
	style:transform="translate({x}px, {y}px)"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	role="button"
	tabindex="0"
	aria-label={t('kuri.drag')}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), face(0), set('react', 'happy'), kuriSound('tap'), (reactUntil = performance.now() + 1500), speak());
	}}
>
	<Kuri {pose} {facing} options={{ yaw: 0, pitch: 0.38, distance: 5.4, target: [0, 0.9, 0], fps: 30 }} />
</div>
<div class="say" class:on={!!say && !hidden} bind:this={el} style:transform="translate({sayLeft}px, {y - 24}px)" aria-live="polite">{say}</div>

<style>
	.walker {
		position: fixed;
		left: 0;
		top: 0;
		width: 104px;
		height: 104px;
		z-index: 40;
		touch-action: none;
		cursor: grab;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
		-webkit-user-select: none;
		will-change: transform;
	}
	.walker:active {
		cursor: grabbing;
	}
	.walker:focus-visible {
		outline: 3px solid var(--color-focus, var(--color-info));
		outline-offset: -6px;
		border-radius: 24px;
	}
	.walker.hidden {
		visibility: hidden;
	}
	.say {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 41;
		background: var(--color-surface-strong);
		color: var(--color-text);
		border: var(--hairline-w) solid var(--color-border);
		box-shadow: var(--shadow-raised);
		font-size: var(--text-caption);
		font-weight: var(--weight-semibold);
		padding: var(--space-1h) var(--space-3);
		border-radius: var(--radius-md);
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--dur-fast);
	}
	.say.on {
		opacity: 1;
	}
</style>
