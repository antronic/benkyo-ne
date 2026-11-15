/**
 * Kuri, the Shiba companion: shared state and the typed edge of the renderer.
 *
 * Settings live in progress.settings (kuri, kuriStyle, kuriWalk, kuriReact,
 * kuriLowPoly, kuriSound). The renderer (shiba.ts) is only imported when a Kuri is on
 * screen, so turning Kuri off means it is never downloaded.
 */
import { progress } from '#lib/state/progress.svelte.ts';
import { play, hello, unlock, type KuriSoundName } from './sound.ts';

export type KuriPose = 'idle' | 'happy' | 'thinking' | 'encourage' | 'sleep' | 'wave' | 'walk' | 'held';

export interface KuriOptions {
	variant?: 'bandana' | 'neckerchief';
	detail?: 'full' | 'low';
	theme?: 'light' | 'dark';
	reducedMotion?: boolean;
	/** frame-rate cap; small avatars use 30 */
	fps?: number;
	/** camera: turn around the model, tilt, distance and look-at point */
	yaw?: number;
	pitch?: number;
	distance?: number;
	target?: [number, number, number];
	/** drag to turn the camera (off for avatars) */
	orbit?: boolean;
}

export interface KuriInstance {
	setPose(p: KuriPose): void;
	setFacing(radians: number): void;
	setTheme(t: 'light' | 'dark'): void;
	setReducedMotion(r: boolean): void;
	setPaused(p: boolean): void;
	destroy(): void;
	readonly stats: { triangles: number; gpuBytes: number };
}

let engine: Promise<{ create(canvas: HTMLCanvasElement, opts: KuriOptions): KuriInstance }> | null = null;
/** Load the renderer once (a separate ~9 KB chunk). */
export function loadEngine() {
	return (engine ??= import('./shiba.ts') as never);
}

/** Is Kuri on, and which look and detail should a small Kuri use. */
export const kuriPrefs = {
	get on() {
		return progress.settings.kuri;
	},
	get variant() {
		return progress.settings.kuriStyle;
	},
	get detail(): 'full' | 'low' {
		return progress.settings.kuriLowPoly ? 'low' : 'full';
	}
};

const soundOn = () => progress.settings.kuri && progress.settings.kuriSound;

/** Play one of Kuri's sounds if Kuri and Sound are both on. */
export function kuriSound(name: KuriSoundName) {
	if (soundOn()) play(name);
}
/** Kuri's "はじめまして！" for the first meeting, if Sound is on. */
export function kuriHello() {
	if (soundOn()) hello();
}

// Browsers keep audio locked until the first touch, so get it ready on any tap
// while Sound is on. Later sounds (sleep, the intro timeline) can then play.
if (typeof document !== 'undefined') {
	const ready = () => soundOn() && unlock();
	document.addEventListener('pointerdown', ready, { capture: true, passive: true });
	document.addEventListener('keydown', ready, { capture: true, passive: true });
}

/** One-shot reactions from study screens (right or wrong answers). */
export const kuriBus = $state({ seq: 0, kind: 'happy' as 'happy' | 'encourage' });
export function kuriReact(kind: 'happy' | 'encourage') {
	if (!progress.settings.kuri || !progress.settings.kuriReact) return;
	kuriBus.kind = kind;
	kuriBus.seq++;
}

/** The theme in use: data-theme on <html> if set, else the OS setting. */
export function currentTheme(): 'light' | 'dark' {
	if (typeof document === 'undefined') return 'light';
	const t = document.documentElement.getAttribute('data-theme');
	if (t === 'light' || t === 'dark') return t;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where Kuri sits on Today (page coordinates), so the intro can land there. */
export const walkerSpot = $state({ x: -1, y: -1, size: 104, visible: false });
