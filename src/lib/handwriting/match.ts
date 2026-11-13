/**
 * Handwriting matching. The fast path is the Rust/WASM module
 * (`wasm/stroke`, served at /wasm/stroke.wasm). This file holds:
 *   - point resampling (shared by both paths)
 *   - a TypeScript port of the same maths, used if WASM fails to load
 *   - the `Matcher` interface the UI talks to
 */
import { STROKES } from '#lib/content/strokes.ts';

export const SAMPLES = 24;
export const COUNT_PENALTY = 0.2;
export const DIRECTION_PENALTY = 0.25;
export type Pt = [number, number];
type Flat = Float32Array; // SAMPLES*2 per stroke

export function resample(points: Pt[], n = SAMPLES): Flat {
	const out = new Float32Array(n * 2);
	if (points.length === 0) return out;
	const lens = [0];
	for (let k = 1; k < points.length; k++) {
		lens.push(lens[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
	}
	const total = lens[lens.length - 1] || 1;
	let j = 0;
	for (let k = 0; k < n; k++) {
		const target = (k / (n - 1)) * total;
		while (j < lens.length - 2 && lens[j + 1] < target) j++;
		const seg = lens[j + 1] - lens[j] || 1;
		const t = Math.min(1, Math.max(0, (target - lens[j]) / seg));
		const a = points[j];
		const b = points[Math.min(j + 1, points.length - 1)];
		out[k * 2] = a[0] + (b[0] - a[0]) * t;
		out[k * 2 + 1] = a[1] + (b[1] - a[1]) * t;
	}
	return out;
}

export function normalize(strokes: Flat[]): Flat[] {
	let minx = Infinity,
		miny = Infinity,
		maxx = -Infinity,
		maxy = -Infinity;
	for (const s of strokes)
		for (let i = 0; i < s.length; i += 2) {
			minx = Math.min(minx, s[i]);
			maxx = Math.max(maxx, s[i]);
			miny = Math.min(miny, s[i + 1]);
			maxy = Math.max(maxy, s[i + 1]);
		}
	const size = Math.max(maxx - minx, maxy - miny, 1e-3);
	const cx = (minx + maxx) / 2,
		cy = (miny + maxy) / 2;
	return strokes.map((s) => {
		const o = new Float32Array(s.length);
		for (let i = 0; i < s.length; i += 2) {
			o[i] = (s[i] - cx) / size + 0.5;
			o[i + 1] = (s[i + 1] - cy) / size + 0.5;
		}
		return o;
	});
}

export function dtw(a: Flat, b: Flat): number {
	const N = SAMPLES;
	let prev = new Float32Array(N + 1).fill(Infinity);
	let cur = new Float32Array(N + 1).fill(Infinity);
	prev[0] = 0;
	for (let i = 1; i <= N; i++) {
		cur[0] = Infinity;
		const ax = a[(i - 1) * 2],
			ay = a[(i - 1) * 2 + 1];
		for (let j = 1; j <= N; j++) {
			const dx = ax - b[(j - 1) * 2],
				dy = ay - b[(j - 1) * 2 + 1];
			cur[j] = Math.sqrt(dx * dx + dy * dy) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
		}
		[prev, cur] = [cur, prev];
	}
	return prev[N] / (2 * N);
}

const dist = (a: Flat, i: number, b: Flat, j: number) => Math.hypot(a[i * 2] - b[j * 2], a[i * 2 + 1] - b[j * 2 + 1]);

/** True if `a` runs end-to-start relative to `b` (clearly, not by a hair). */
export function reversed(a: Flat, b: Flat): boolean {
	const l = SAMPLES - 1;
	const same = dist(a, 0, b, 0) + dist(a, l, b, l);
	const flip = dist(a, 0, b, l) + dist(a, l, b, 0);
	return flip + 0.05 < same;
}

export const strokeDistance = (a: Flat, b: Flat) => dtw(a, b) + (reversed(a, b) ? DIRECTION_PENALTY : 0);

export function compareStrokes(user: Flat[], tpl: Flat[]): { score: number; perStroke: number[] } {
	const n = Math.min(user.length, tpl.length);
	const perStroke: number[] = [];
	let sum = 0;
	for (let i = 0; i < tpl.length; i++) {
		const d = i < n ? strokeDistance(user[i], tpl[i]) : -1;
		if (d >= 0) sum += d;
		perStroke.push(d);
	}
	const mean = n > 0 ? sum / n : 1;
	return { score: mean + COUNT_PENALTY * Math.abs(user.length - tpl.length), perStroke };
}

// ------------------------------------------------------------ Matcher ----

export interface Ranked {
	char: string;
	score: number;
}

export interface Matcher {
	readonly kind: 'wasm' | 'js';
	/** Recognise: best candidates, shape-only (position/size independent). */
	recognize(strokes: Pt[][], limit?: number, only?: string[]): Ranked[];
	/** Grade a trace over the guide (absolute position matters). */
	grade(char: string, strokes: Pt[][]): { score: number; perStroke: number[] };
}

const CHARS = Object.keys(STROKES);
const TPL_RAW: Flat[][] = CHARS.map((c) => STROKES[c].p.map((s) => Float32Array.from(s)));

export function createJsMatcher(): Matcher {
	const tplNorm = TPL_RAW.map(normalize);
	return {
		kind: 'js',
		recognize(strokes, limit = 5, only) {
			const user = normalize(strokes.map((s) => resample(s)));
			const out: Ranked[] = [];
			CHARS.forEach((char, k) => {
				if (only && !only.includes(char)) return;
				out.push({ char, score: compareStrokes(user, tplNorm[k]).score });
			});
			return out.sort((a, b) => a.score - b.score).slice(0, limit);
		},
		grade(char, strokes) {
			const k = CHARS.indexOf(char);
			return compareStrokes(strokes.map((s) => resample(s)), TPL_RAW[k]);
		}
	};
}

interface StrokeExports {
	memory: WebAssembly.Memory;
	alloc(bytes: number): number;
	dealloc(ptr: number, bytes: number): void;
	samples(): number;
	set_templates(ptr: number, len: number): number;
	score_all(ptr: number, strokes: number, out: number): number;
	compare(index: number, ptr: number, strokes: number, absolute: number, raw: number, per: number): number;
}

export async function createWasmMatcher(bytes: BufferSource | Promise<Response>): Promise<Matcher> {
	const { instance } =
		bytes instanceof Promise
			? await WebAssembly.instantiateStreaming(bytes, {})
			: await WebAssembly.instantiate(bytes, {});
	const x = instance.exports as unknown as StrokeExports;
	if (x.samples() !== SAMPLES) throw new Error('stroke.wasm sample count mismatch');

	const F = 4; // bytes per f32
	const writeFloats = (data: ArrayLike<number>) => {
		const ptr = x.alloc(data.length * F);
		new Float32Array(x.memory.buffer, ptr, data.length).set(data);
		return ptr;
	};
	const flatten = (strokes: Flat[]) => {
		const buf = new Float32Array(strokes.length * SAMPLES * 2);
		strokes.forEach((s, i) => buf.set(s, i * SAMPLES * 2));
		return buf;
	};

	// Upload templates: [count, ...floats]*
	const tplBuf: number[] = [];
	for (const t of TPL_RAW) {
		tplBuf.push(t.length);
		for (const s of t) tplBuf.push(...s);
	}
	const tplPtr = writeFloats(tplBuf);
	x.set_templates(tplPtr, tplBuf.length);
	x.dealloc(tplPtr, tplBuf.length * F);

	const rawPtrs = TPL_RAW.map((t) => writeFloats(flatten(t))); // kept for tracing
	const scoresPtr = x.alloc(CHARS.length * F);
	const perPtr = x.alloc(32 * F);

	return {
		kind: 'wasm',
		recognize(strokes, limit = 5, only) {
			const buf = flatten(strokes.map((s) => resample(s)));
			const p = writeFloats(buf);
			x.score_all(p, strokes.length, scoresPtr);
			x.dealloc(p, buf.length * F);
			const scores = new Float32Array(x.memory.buffer, scoresPtr, CHARS.length);
			const out: Ranked[] = [];
			CHARS.forEach((char, k) => {
				if (!only || only.includes(char)) out.push({ char, score: scores[k] });
			});
			return out.sort((a, b) => a.score - b.score).slice(0, limit);
		},
		grade(char, strokes) {
			const k = CHARS.indexOf(char);
			const buf = flatten(strokes.map((s) => resample(s)));
			const p = writeFloats(buf);
			const score = x.compare(k, p, strokes.length, 1, rawPtrs[k], perPtr);
			x.dealloc(p, buf.length * F);
			const n = TPL_RAW[k].length;
			return { score, perStroke: Array.from(new Float32Array(x.memory.buffer, perPtr, n)) };
		}
	};
}

let matcher: Promise<Matcher> | null = null;

/** Lazily load the WASM matcher; fall back to JS on any failure. */
export function getMatcher(): Promise<Matcher> {
	matcher ??= createWasmMatcher(fetch('/wasm/stroke.wasm')).catch((e) => {
		console.warn('stroke.wasm unavailable, using JS matcher', e);
		return createJsMatcher();
	});
	return matcher;
}
