/**
 * iOS gestures as Svelte actions.
 *
 * edgeSwipeBack: drag from the left screen edge to go back. The page follows
 *   your finger, then either completes (distance or flick velocity) or
 *   springs back. Installed web apps have no browser chrome, so without this
 *   there is no swipe-back at all. In Safari's own UI we leave the edge to
 *   the browser's gesture.
 */
import { haptic } from './haptics.ts';

interface SwipeBackOptions {
	enabled: boolean;
	onback: () => void | Promise<boolean | void>;
}

const EDGE = 24;

export function edgeSwipeBack(node: HTMLElement, opts: SwipeBackOptions) {
	let o = opts;
	let startX = 0,
		startY = 0,
		dx = 0,
		tracking = false,
		decided = false,
		samples: { x: number; t: number }[] = [];
	const standalone = () =>
		matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

	function down(e: PointerEvent) {
		if (!o.enabled || e.clientX > EDGE || e.button !== 0) return;
		if (!standalone() && e.pointerType === 'touch') return; // Safari owns the edge
		tracking = true;
		decided = false;
		startX = e.clientX;
		startY = e.clientY;
		dx = 0;
		samples = [{ x: e.clientX, t: e.timeStamp }];
	}

	function move(e: PointerEvent) {
		if (!tracking) return;
		const mx = e.clientX - startX,
			my = e.clientY - startY;
		if (!decided) {
			if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
			if (Math.abs(my) > Math.abs(mx) || mx < 0) {
				tracking = false;
				return;
			}
			decided = true;
			node.style.transition = 'none';
			node.classList.add('swiping-back');
		}
		e.preventDefault();
		dx = Math.max(0, mx);
		samples.push({ x: e.clientX, t: e.timeStamp });
		if (samples.length > 6) samples.shift();
		node.style.transform = `translateX(${dx}px)`;
		node.style.setProperty('--swipe', String(Math.min(1, dx / innerWidth)));
	}

	async function up() {
		if (!tracking) return;
		tracking = false;
		if (!decided) return;
		const a = samples[0],
			b = samples[samples.length - 1];
		const v = (b.x - a.x) / Math.max(1, b.t - a.t); // px/ms
		const complete = dx > innerWidth * 0.35 || v > 0.5;
		node.style.transition = 'transform 420ms var(--spring)';
		if (complete) {
			haptic('impact');
			node.style.transform = `translateX(${innerWidth}px)`;
			const allowed = await o.onback();
			if (allowed === false) node.style.transform = '';
		} else {
			node.style.transform = '';
		}
		setTimeout(() => {
			node.classList.remove('swiping-back');
			node.style.transition = '';
			node.style.transform = '';
			node.style.removeProperty('--swipe');
		}, 440);
	}

	addEventListener('pointerdown', down, { passive: true });
	addEventListener('pointermove', move, { passive: false });
	addEventListener('pointerup', up);
	addEventListener('pointercancel', up);
	return {
		update(next: SwipeBackOptions) {
			o = next;
		},
		destroy() {
			removeEventListener('pointerdown', down);
			removeEventListener('pointermove', move);
			removeEventListener('pointerup', up);
			removeEventListener('pointercancel', up);
		}
	};
}

/**
 * Track the on-screen keyboard. iOS Safari doesn't resize the layout
 * viewport when the keyboard opens, so we expose its height as --kb and
 * keep the focused field in view.
 */
export function trackKeyboard() {
	const vv = window.visualViewport;
	if (!vv) return () => {};
	const update = () => {
		const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
		document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
		document.documentElement.classList.toggle('keyboard', kb > 80);
	};
	vv.addEventListener('resize', update);
	vv.addEventListener('scroll', update);
	update();
	return () => {
		vv.removeEventListener('resize', update);
		vv.removeEventListener('scroll', update);
	};
}
