/**
 * Handwriting as data, for the VIP invite card (draft, not in the app yet):
 * Fleet records it with InkPad, the card plays it back with InkReplay.
 * Points are [x, y, t]: x and y in 0..1 of the pad, t in ms from the first
 * pen-down, so playback keeps the writer's own speed and pauses.
 */
export type InkPoint = [x: number, y: number, t: number];
export interface Ink {
	/** pad shape, width / height */
	aspect: number;
	strokes: InkPoint[][];
}

export const emptyInk = (aspect = 2.4): Ink => ({ aspect, strokes: [] });

/** total playback time in ms */
export const inkDuration = (ink: Ink) => ink.strokes.reduce((m, s) => Math.max(m, s.at(-1)?.[2] ?? 0), 0);

/** SVG path of one stroke in a w × h box; `until` (ms) cuts it where the pen was then. */
export function strokePath(stroke: InkPoint[], w: number, h: number, until = Infinity): string {
	const pts = stroke.filter((p) => p[2] <= until);
	if (!pts.length) return '';
	const f = (n: number) => Math.round(n * 10) / 10;
	if (pts.length === 1) {
		const [x, y] = pts[0];
		return `M${f(x * w)} ${f(y * h)}l0.1 0`; // a dot
	}
	let d = `M${f(pts[0][0] * w)} ${f(pts[0][1] * h)}`;
	// midpoint smoothing: quadratic curves through the midpoints
	for (let i = 1; i < pts.length - 1; i++) {
		const [x, y] = pts[i];
		const [nx, ny] = pts[i + 1];
		d += `Q${f(x * w)} ${f(y * h)} ${f(((x + nx) / 2) * w)} ${f(((y + ny) / 2) * h)}`;
	}
	const last = pts.at(-1)!;
	return d + `L${f(last[0] * w)} ${f(last[1] * h)}`;
}

/** Drop points closer than `min` (0..1 units) to the last kept one, so stored ink stays small. */
export function simplify(stroke: InkPoint[], min = 0.004): InkPoint[] {
	const out: InkPoint[] = [];
	for (const p of stroke) {
		const q = out.at(-1);
		if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= min) out.push(p);
	}
	const last = stroke.at(-1);
	if (last && out.at(-1) !== last) out.push(last);
	return out;
}

/** Long pauses between strokes are shortened to `gap` ms so playback doesn't stall. */
export function tighten(ink: Ink, gap = 350): Ink {
	let shift = 0;
	let prevEnd = 0;
	const strokes = ink.strokes.map((s, i) => {
		const start = s[0]?.[2] ?? 0;
		if (i > 0 && start - shift - prevEnd > gap) shift = start - prevEnd - gap;
		const out = s.map(([x, y, t]) => [x, y, t - shift] as InkPoint);
		prevEnd = out.at(-1)?.[2] ?? prevEnd;
		return out;
	});
	return { ...ink, strokes };
}

/** A sample for /design: a little heart and a flourish under it. */
export function sampleInk(): Ink {
	const heart: InkPoint[] = [];
	for (let i = 0; i <= 60; i++) {
		const a = (i / 60) * Math.PI * 2;
		const x = 16 * Math.sin(a) ** 3;
		const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
		heart.push([0.2 + x / 110, 0.45 - y / 45, i * 18]);
	}
	const swish: InkPoint[] = [];
	for (let i = 0; i <= 40; i++) {
		const u = i / 40;
		swish.push([0.4 + u * 0.5, 0.62 + Math.sin(u * Math.PI * 3) * 0.08 * (1 - u), 1500 + i * 16]);
	}
	return { aspect: 2.4, strokes: [heart, swish] };
}
