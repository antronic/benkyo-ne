<!--
	Kuri on Today: a small draggable avatar that wanders around the free parts of the
	screen when left alone, sits, and dozes off after half a minute.
	Tap for a hop and a short line; drag to pick Kuri up and put it somewhere else.
	Shake Kuri while holding it (four quick back-and-forth swings) and it gets dizzy.

	Kuri never covers a button, link, field or the menu bar (keepOut.ts), and never hides. It only
	walks to spots it can reach without passing over one; when the page scrolls or changes under
	it, or it is put down on a control, it hops to the nearest free spot. When no spot is free,
	Kuri gets a little smaller; when even the smallest Kuri has no free spot, it stays in sight
	where it covers least but lets every tap through to what is underneath (`ghost`).

	The first time, Kuri says hello in a speech bubble (`ui.kuriHello`, set by the layout).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Kuri from './Kuri.svelte';
	import { reducedMotion, kuriSound, kuriHello, type KuriPose } from './kuri.svelte.ts';
	import { readObstacles, clear, overlap, freeSpots, nearest, wanderTarget, leastCovered, type Area, type Box, type Point } from './keepOut.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { ui } from '#lib/state/ui.svelte.ts';
	import { haptic } from '#lib/ios/haptics.ts';
	import { t, tn } from '#lib/i18n/index.svelte.ts';
	import { SpeechBubble } from '#lib/ui/index.ts';

	let { hidden = false }: { hidden?: boolean } = $props();

	/** Kuri's size: full, then smaller when the screen is busy */
	const SIZES = [104, 84, 68];
	let S = $state(SIZES[0]);
	let x = $state(0);
	let y = $state(0);
	let pose = $state<KuriPose>('idle');
	let facing = $state(0);
	/** a short line, or the first hello */
	let say = $state('');
	let hello = $state(false);
	let sayLeft = $state(0);
	let sayTop = $state(0);
	let tail = $state<'up' | 'down' | 'left' | 'right'>('down');
	let tailAt = $state(0);
	/** not placed yet (the first frame) */
	let waiting = $state(true);
	/** no free spot even when small, or the page is scrolling under Kuri: visible, but taps go through */
	let ghost = $state(false);
	/** hopping to a free spot (a short glide that takes no taps) */
	let hopping = $state(false);
	let el: HTMLDivElement;
	let bubble: HTMLDivElement;

	type Mode = 'idle' | 'walk' | 'held' | 'sleep' | 'react';
	let mode: Mode = 'idle';
	let tx = 0,
		ty = 0,
		nextAt = 0,
		lastTouch = 0,
		reactUntil = 0,
		sayUntil = 0,
		hopUntil = 0,
		helloPending = false;

	// ---- keep-out zones -------------------------------------------------------------
	let hard: Box[] = [];
	let soft: Box[] = [];
	let readAt = 0;
	let scrolledAt = -1e9;
	let dirty = true;
	function area(size = S): Area {
		const cs = getComputedStyle(document.documentElement);
		const top = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
		const vw = document.documentElement.clientWidth;
		return { left: 4, top: top + 4, right: vw - size - 4, bottom: innerHeight - size - 4 };
	}
	function read(now: number) {
		({ hard, soft } = readObstacles([el, bubble]));
		readAt = now;
		dirty = false;
	}
	const here = (): Point => ({ x, y });

	/**
	 * Move Kuri to the best free spot near where it is, at the largest size that has one. With
	 * no free spot at any size, Kuri stays in sight at the smallest size where it covers least
	 * (keepGhost: or where it is), as a ghost that lets taps through.
	 */
	function relocate(now: number, glide = true, keepGhost = false) {
		const centre = { x: x + S / 2, y: y + S / 2 };
		for (const size of SIZES) {
			const spot = nearest(freeSpots(area(size), size, hard, soft), { x: centre.x - size / 2, y: centre.y - size / 2 });
			if (!spot) continue;
			place(now, spot, size, glide && !waiting && !ghost);
			ghost = false;
			return;
		}
		if (mode === 'walk') set('idle');
		if (keepGhost && !waiting) return void (ghost = true);
		const size = SIZES[SIZES.length - 1];
		place(now, leastCovered(area(size), size, hard, { x: centre.x - size / 2, y: centre.y - size / 2 }), size, false);
		ghost = true;
	}
	function place(now: number, p: Point, size: number, glide: boolean) {
		if (mode === 'walk' || mode === 'sleep') set('idle');
		hopping = glide && !reducedMotion();
		hopUntil = now + 340;
		x = p.x;
		y = p.y;
		S = size;
		waiting = false;
		face(0);
		nextAt = now + 3000 + Math.random() * 3000;
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
	function speak(text = line()) {
		hello = false;
		say = text;
		sayUntil = performance.now() + 2400;
	}
	/** はじめまして: a wave, the hello sound and a bubble that stays a little longer */
	function sayHello(now: number) {
		helloPending = false;
		face(0);
		set('react', 'wave');
		reactUntil = now + 2600;
		lastTouch = now;
		kuriHello();
		haptic('success');
		say = 'hello';
		hello = true;
		sayUntil = now + 9000;
	}
	function hush() {
		say = '';
		hello = false;
		sayUntil = 0;
	}

	/** A shake is a few long strokes that change direction quickly (on either axis). */
	const SHAKE_STROKE = 28,
		SHAKE_FLIPS = 4,
		SHAKE_MS = 1200;
	type Axis = { dir: number; run: number };
	let drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; lx: number; ly: number; ax: Axis; ay: Axis; flips: number[]; dizzy: boolean } | null = null;
	function stroke(a: Axis, d: number, now: number, flips: number[]) {
		if (!d) return;
		const s = Math.sign(d);
		if (a.dir === 0 || s === a.dir) (a.run += Math.abs(d)), (a.dir = s);
		else {
			if (a.run >= SHAKE_STROKE) flips.push(now);
			a.dir = s;
			a.run = Math.abs(d);
		}
	}
	function down(e: PointerEvent) {
		drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false, lx: e.clientX, ly: e.clientY, ax: { dir: 0, run: 0 }, ay: { dir: 0, run: 0 }, flips: [], dizzy: false };
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
			if (hello) hush();
			haptic('selection');
			kuriSound('held');
		}
		if (drag.moved) {
			const b = area();
			x = Math.min(Math.max(-10, drag.ox + dx), b.right + 10);
			y = Math.min(Math.max(b.top, drag.oy + dy), b.bottom);
			if (!drag.dizzy) {
				// a busy frame merges moves into one event; read them all so a fast shake still counts
				const now = performance.now();
				const all = e.getCoalescedEvents?.() ?? [];
				for (const m of all.length ? all : [e]) {
					stroke(drag.ax, m.clientX - drag.lx, now, drag.flips);
					stroke(drag.ay, m.clientY - drag.ly, now, drag.flips);
					drag.lx = m.clientX;
					drag.ly = m.clientY;
				}
				drag.flips = drag.flips.filter((t) => now - t < SHAKE_MS);
				if (drag.flips.length >= SHAKE_FLIPS) {
					drag.dizzy = true;
					set('held', 'dizzy');
					haptic('warning');
					kuriSound('dizzy');
				}
			}
		}
		if (!drag.moved || drag.dizzy) (drag.lx = e.clientX), (drag.ly = e.clientY);
	}
	function up() {
		if (!drag) return;
		const now = performance.now();
		lastTouch = now;
		if (drag.dizzy) {
			// set down still woozy: stars and a line, then back to normal
			set('react', 'dizzy');
			reactUntil = now + 2600;
			speak(t('kuri.sayDizzy'));
		} else if (drag.moved) {
			set('idle');
			nextAt = now + 4000;
		} else if (hello) {
			hush();
		} else {
			face(0);
			set('react', 'happy');
			haptic('success');
			kuriSound(Math.random() < 0.5 ? 'tap' : 'yip');
			reactUntil = now + 1500;
			speak();
		}
		// put down on a control: hop off it at once
		if (drag.moved) dirty = true;
		drag = null;
	}

	/** Place the bubble above Kuri (below when there is no room), inside the screen. */
	function placeBubble() {
		const vw = document.documentElement.clientWidth;
		const w = bubble.offsetWidth;
		const h = bubble.offsetHeight;
		const a = area();
		const cx = Math.min(Math.max(8, x + S / 2 - w / 2), vw - w - 8);
		const cy = Math.min(Math.max(a.top, y + S / 2 - h / 2), innerHeight - h - 8);
		// above, below, then beside Kuri: the first that covers no control and fits on screen
		const options: { side: 'up' | 'down' | 'left' | 'right'; x: number; y: number }[] = [
			{ side: 'down', x: cx, y: y + 6 - h - 10 },
			{ side: 'up', x: cx, y: y + S - 6 },
			{ side: 'right', x: x + 8 - w - 10, y: cy },
			{ side: 'left', x: x + S - 8, y: cy }
		];
		let best = options[0];
		let worst = Infinity;
		for (const o of options) {
			const b = { x: o.x, y: o.y, w, h };
			const off = o.x < 4 || o.y < a.top || o.x + w > vw - 4 || o.y + h > innerHeight - 4 ? 1e9 : 0;
			const cost = off + hard.reduce((sum, k) => sum + overlap(b, k), 0);
			if (cost < worst) (worst = cost), (best = o);
			if (cost === 0) break;
		}
		tail = best.side;
		sayLeft = best.x;
		sayTop = best.y;
		tailAt = best.side === 'up' || best.side === 'down' ? Math.min(Math.max(16, x + S / 2 - best.x), w - 16) : Math.min(Math.max(16, y + S / 2 - best.y), h - 16);
	}

	$effect(() => {
		if (ui.kuriHello) {
			ui.kuriHello = false;
			helloPending = true;
		}
	});

	onMount(() => {
		const b = area();
		x = b.right;
		y = b.bottom;
		lastTouch = performance.now();
		nextAt = lastTouch + 3000;
		let raf = 0,
			last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const still = reducedMotion();
			const scrolling = now - scrolledAt < 180;
			const fresh = !hidden && (dirty || now - readAt > 400);
			if (fresh) read(now);
			if (hopping && now > hopUntil) hopping = false;

			// keep out: never stand on a control or the menu bar
			if (!hidden && mode !== 'held') {
				if (waiting) {
					if (fresh) relocate(now, false);
				} else if (!clear(here(), S, hard)) {
					// the page moved under Kuri: let taps through now, step aside once it settles
					if (scrolling) ghost = true;
					else if (fresh || !ghost) relocate(now, true, true);
				} else if (ghost && !scrolling) ghost = false;
				else if (fresh && !scrolling && S < SIZES[0] && mode === 'idle') {
					// room again for a bigger Kuri?
					const spot = nearest(freeSpots(area(SIZES[0]), SIZES[0], hard, soft), { x: x + S / 2 - SIZES[0] / 2, y: y + S / 2 - SIZES[0] / 2 });
					if (spot && Math.hypot(spot.x - x, spot.y - y) < 160) place(now, spot, SIZES[0], true);
				}
			}
			if (!waiting && helloPending && !hidden && mode !== 'held') sayHello(now);

			if (sayUntil && now > sayUntil) hush();
			if (mode === 'react' && now > reactUntil) (set('idle'), (nextAt = now + 2500));
			if (!hidden && !still && mode === 'idle' && now - lastTouch > 30000) (set('sleep'), kuriSound('sleep'));
			if (!hidden && !waiting && !ghost && !still && progress.settings.kuriWalk && mode === 'idle' && now > nextAt) {
				const to = wanderTarget(freeSpots(area(), S, hard, soft), here(), S, hard);
				if (to) {
					tx = to.x;
					ty = to.y;
					face(Math.atan2(tx - x, ty - y));
					set('walk');
				} else nextAt = now + 2000;
			}
			if (mode === 'walk') {
				if (still || !progress.settings.kuriWalk || ghost) set('idle');
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
			if (say && bubble) placeBubble();
			raf = document.hidden ? 0 : requestAnimationFrame(tick);
		};
		const vis = () => {
			if (!document.hidden && !raf) (last = performance.now()), (raf = requestAnimationFrame(tick));
		};
		const moved = () => ((scrolledAt = performance.now()), (dirty = true));
		// a tap anywhere else closes the hello
		const tapAway = (e: PointerEvent) => {
			if (hello && !el.contains(e.target as Node)) hush();
		};
		document.addEventListener('visibilitychange', vis);
		addEventListener('scroll', moved, { passive: true, capture: true });
		addEventListener('resize', moved, { passive: true });
		document.addEventListener('pointerdown', tapAway, { capture: true, passive: true });
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('visibilitychange', vis);
			removeEventListener('scroll', moved, { capture: true });
			removeEventListener('resize', moved);
			document.removeEventListener('pointerdown', tapAway, { capture: true });
		};
	});
</script>

<div
	class="walker"
	class:hidden
	class:waiting
	class:ghost
	class:hopping
	bind:this={el}
	style:transform="translate({x}px, {y}px)"
	style:width="{S}px"
	style:height="{S}px"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	role="button"
	tabindex={waiting || hidden ? -1 : 0}
	aria-hidden={waiting || hidden || undefined}
	aria-label={t('kuri.drag')}
	onkeydown={(e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (hello) return hush();
		face(0);
		set('react', 'happy');
		kuriSound('tap');
		reactUntil = performance.now() + 1500;
		speak();
	}}
>
	<Kuri {pose} {facing} options={{ yaw: 0, pitch: 0.38, distance: 5.4, target: [0, 0.9, 0], fps: 30 }} />
</div>
<div class="say" class:on={!!say && !hidden && !waiting} class:hello bind:this={bubble} style:transform="translate({sayLeft}px, {sayTop}px)" aria-live="polite">
	{#if say}
		<SpeechBubble label={t('kuri.name')} {tail} {tailAt}>
			{#if hello}
				<b class="jp" lang="ja">はじめまして！</b>
				<span class="line">{t('kuri.intro1')}</span>
				<span class="line sub">{t('kuri.intro2')}</span>
			{:else}{say}{/if}
		</SpeechBubble>
	{/if}
</div>

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
		transition: opacity var(--dur-fast) var(--ease-out);
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
	/* the first frame, before Kuri has a spot */
	.walker.waiting {
		opacity: 0;
		pointer-events: none;
	}
	/* no free spot, or the page is scrolling under Kuri: still in sight, but taps go through */
	.walker.ghost {
		pointer-events: none;
	}
	/* hopping off a control to a free spot: a short glide that takes no taps */
	.walker.hopping {
		pointer-events: none;
		transition:
			transform 320ms var(--ease-out),
			width 320ms var(--ease-out),
			height 320ms var(--ease-out),
			opacity var(--dur-fast) var(--ease-out);
	}
	.say {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 41;
		max-width: min(280px, calc(100vw - 16px)); /* ui-ok: keeps the bubble inside a phone screen */
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--dur-fast);
	}
	.say:not(.hello) {
		white-space: nowrap;
		font-weight: var(--weight-semibold);
	}
	.say:not(.hello) :global(.bubble) {
		font-size: var(--text-caption);
		padding: var(--space-1h) var(--space-3);
	}
	.say.on {
		opacity: 1;
	}
	.say.hello b {
		display: block;
		font-size: var(--text-title-3);
	}
	.say.hello .line {
		display: block;
	}
	.say.hello .sub {
		color: var(--color-text-2);
		font-size: var(--text-footnote);
	}
</style>
