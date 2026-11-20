/**
 * Selfie measurements: a few numbers from what the on-device models see (docs/AVATAR.md).
 *
 * Input: MediaPipe Face Landmarker's 478 points and blendshapes, the hair segmenter's mask and
 * the photo's pixels, all on the phone. Output: `Measurements`, a dozen plain numbers that
 * ./mapping.ts turns into avatar parts. Nothing here (or kept from here) could rebuild a face,
 * and nothing guesses age, gender, ethnicity or religion.
 *
 * Pure functions over arrays, so the rules can be tested without a camera.
 */

export interface Measurements {
	/** face width / length (cheekbones / forehead to chin) */
	faceRatio: number;
	/** jaw width / cheekbone width */
	jawRatio: number;
	/** skin colour on the side of the face that faces the light, CIE L*a*b* */
	skinLab: [number, number, number];
	/** the brightest the face gets (99th percentile L* inside the face, hair left out): how well exposed the photo is */
	faceBright: number;
	/** lightness of the teeth (L*) when a smile shows them, else null: a white reference for dim photos */
	teethL: number | null;
	/** hair pixels / (face width × face length) */
	hairArea: number;
	/** how far hair reaches below the chin, in face lengths (0: not below) */
	hairBelowChin: number;
	/** share of the forehead covered by hair (fringe) */
	hairFringe: number;
	/** hair piled above the crown, narrower than the head (a bun) */
	hairTop: boolean;
	/** outline roughness 0..1 (curls) */
	hairRough: number;
	/** median hair colour, CIE L*a*b* */
	hairLab: [number, number, number];
	/** the hair is hidden around the face by something that is neither skin nor background */
	hairCovered: boolean;
	/** eyelid gap / eye width */
	eyeOpen: number;
	/** 0..1 */
	smile: number;
	/** 0..1 */
	jawOpen: number;
	/** brow arch 0..1 */
	browArch: number;
	/** glasses edge score 0..1 */
	glasses: number;
	/** dark-hair share of the jaw band, the upper lip and the chin, 0..1 */
	beardJaw: number;
	beardLip: number;
	beardChin: number;
}

export interface Pt {
	x: number;
	y: number;
}
export interface SelfieInput {
	/** Face Landmarker points, normalised 0..1 */
	landmarks: Pt[];
	/** blendshape name → score */
	blend: Record<string, number>;
	/** RGBA pixels */
	rgba: Uint8ClampedArray;
	width: number;
	height: number;
	/** hair segmenter category mask (non-zero = hair), same size as the image */
	hair: Uint8Array;
}

/** sRGB 0..255 → CIE L*a*b* (D65) */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
	const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const R = lin(r),
		G = lin(g),
		B = lin(b);
	const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047,
		y = 0.2126 * R + 0.7152 * G + 0.0722 * B,
		z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export function hexToLab(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return rgbToLab(n >> 16, (n >> 8) & 255, n & 255);
}
export const deltaE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const median = (v: number[]) => {
	if (!v.length) return 0;
	const s = [...v].sort((a, b) => a - b);
	return s[s.length >> 1];
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Face Landmarker indices (canonical face mesh)
const L = {
	top: 10,
	chin: 152,
	cheekL: 234,
	cheekR: 454,
	jawL: 172,
	jawR: 397,
	cheekPatchL: 50,
	cheekPatchR: 280,
	forehead: 151,
	bridge: 168,
	noseBottom: 2,
	upperLip: 0,
	lowerLip: 17,
	innerTop: 13,
	innerBottom: 14,
	mouthL: 78,
	mouthR: 308,
	eyeLT: 159,
	eyeLB: 145,
	eyeLO: 33,
	eyeLI: 133,
	eyeRT: 386,
	eyeRB: 374,
	eyeRI: 362,
	eyeRO: 263,
	browLOut: 70,
	browLPeak: 105,
	browLIn: 107,
	browROut: 300,
	browRPeak: 334,
	browRIn: 336
};

export function measure(s: SelfieInput): Measurements {
	const { width: W, height: H, rgba, hair } = s;
	const P = (i: number) => ({ x: s.landmarks[i].x * W, y: s.landmarks[i].y * H });
	const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
	const top = P(L.top),
		chin = P(L.chin),
		cl = P(L.cheekL),
		cr = P(L.cheekR);
	const fw = dist(cl, cr),
		fl = dist(top, chin);
	const cx = (cl.x + cr.x) / 2;
	const at = (x: number, y: number) => (Math.round(y) * W + Math.round(x)) | 0;
	const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
	const isHair = (x: number, y: number) => inside(x, y) && hair[at(x, y)] > 0;
	const lab = (x: number, y: number) => {
		const i = at(x, y) * 4;
		return rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
	};
	/** median L*a*b* of the pixels in a box that pass `keep` */
	const patch = (x0: number, y0: number, x1: number, y1: number, keep: (x: number, y: number) => boolean) => {
		const ls: number[] = [],
			as: number[] = [],
			bs: number[] = [];
		const step = Math.max(1, Math.round(Math.min(x1 - x0, y1 - y0) / 24));
		for (let y = Math.max(0, y0); y < Math.min(H, y1); y += step)
			for (let x = Math.max(0, x0); x < Math.min(W, x1); x += step) {
				if (!keep(x, y)) continue;
				const c = lab(x, y);
				ls.push(c[0]);
				as.push(c[1]);
				bs.push(c[2]);
			}
		return { lab: [median(ls), median(as), median(bs)] as [number, number, number], n: ls.length };
	};

	// face shape
	const faceRatio = fw / fl;
	const jawRatio = dist(P(L.jawL), P(L.jawR)) / fw;

	// skin: both cheeks and the forehead, never hair. Indoor light usually comes from one side,
	// and the shaded cheek can read 30 L* darker than the lit one, so the skin colour is the
	// brightest of the three patches: the side that faces the light shows the real tone.
	const r = fw * 0.06;
	const [skinL, skinR, skinF] = [P(L.cheekPatchL), P(L.cheekPatchR), P(L.forehead)].map((p) => patch(p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => !isHair(x, y)));
	const skinLab = [skinL, skinR, skinF].filter((q) => q.n > 0).reduce((a, b) => (b.lab[0] > a[0] ? b.lab : a), [0, 0, 0] as [number, number, number]);
	// the skin next to a point: the cheek on its side (one side of the face is often in shadow)
	const sideL = P(L.cheekPatchL).x < cx;
	const skinAt = (x: number) => ((x < cx) === sideL ? skinL : skinR).lab;

	// exposure: the brightest the face gets. A dim photo has no bright spots at all.
	const faceLs: number[] = [];
	{
		const fcy = (top.y + chin.y) / 2,
			rx = (fw / 2) * 0.9,
			ry = (fl / 2) * 0.9,
			st = Math.max(1, Math.round(fw / 100));
		for (let y = fcy - ry; y < fcy + ry; y += st)
			for (let x = cx - rx; x < cx + rx; x += st)
				if (inside(x, y) && ((x - cx) / rx) ** 2 + ((y - fcy) / ry) ** 2 <= 1 && !isHair(x, y)) faceLs.push(lab(x, y)[0]);
	}
	faceLs.sort((a, b) => a - b);
	const faceBright = faceLs.length ? faceLs[Math.floor(faceLs.length * 0.99)] : 0;

	// teeth: when the lips are apart, the pale pixels between them. Teeth are near-white in any
	// skin tone, so skin / teeth says how light the skin is even when the whole photo is dark.
	const it = P(L.innerTop),
		ib = P(L.innerBottom),
		ml = P(L.mouthL),
		mr = P(L.mouthR);
	let teethL: number | null = null;
	if (ib.y - it.y > fw * 0.04) {
		const tl: number[] = [];
		const x0 = Math.min(ml.x, mr.x),
			x1 = Math.max(ml.x, mr.x);
		for (let y = it.y + 1; y < ib.y - 1; y++)
			for (let x = x0 + (x1 - x0) * 0.2; x < x1 - (x1 - x0) * 0.2; x++) {
				if (!inside(x, y)) continue;
				const c = lab(x, y);
				if (Math.hypot(c[1], c[2]) < 30) tl.push(c[0]);
			}
		tl.sort((a, b) => a - b);
		// enough pale pixels to be teeth, not the dark inside of the mouth
		if (tl.length >= 20) teethL = tl[Math.floor(tl.length * 0.9)];
	}

	// hair mask, in face units
	let hairN = 0,
		minY = H;
	const hl: number[] = [],
		ha: number[] = [],
		hb: number[] = [];
	const step = Math.max(1, Math.round(fw / 120));
	for (let y = 0; y < H; y += step)
		for (let x = 0; x < W; x += step) {
			if (!hair[at(x, y)]) continue;
			hairN++;
			if (y < minY) minY = y;
			// colour from the inside of the mask only: its edges blend into skin and background
			const e = step * 3;
			if (hairN % 3 === 0 && isHair(x - e, y) && isHair(x + e, y) && isHair(x, y - e) && isHair(x, y + e)) {
				const c = lab(x, y);
				hl.push(c[0]);
				ha.push(c[1]);
				hb.push(c[2]);
			}
		}
	const hairArea = (hairN * step * step) / (fw * fl);
	// how far the side hair hangs: follow it down from the eyes and stop at the first gap, so a
	// dark shirt, chair or wall the segmenter calls hair doesn't count as long hair
	const eyeY = (P(L.eyeLT).y + P(L.eyeRT).y) / 2;
	let lowSide = -1;
	for (let y = eyeY; y < H; y += step) {
		let found = false;
		for (let x = cx - fw * 0.85; x <= cx + fw * 0.85 && !found; x += step) if (Math.abs(x - cx) > fw * 0.35 && isHair(x, y)) found = true;
		if (found) lowSide = y;
		else if (y - Math.max(lowSide, eyeY) > fl * 0.05) break;
	}
	const hairBelowChin = lowSide > chin.y ? (lowSide - chin.y) / fl : 0;
	const hairLab: [number, number, number] = [median(hl), median(ha), median(hb)];

	// fringe: hair over the forehead (between the brows and the top of the face)
	const browY = (P(L.browLPeak).y + P(L.browRPeak).y) / 2;
	let fr = 0,
		fn = 0;
	for (let y = top.y; y < browY; y += step)
		for (let x = cx - fw * 0.3; x < cx + fw * 0.3; x += step) {
			fn++;
			if (isHair(x, y)) fr++;
		}
	const hairFringe = fn ? fr / fn : 0;

	// a bun: hair well above the crown, narrower than the head
	const crownGap = (top.y - minY) / fl;
	let topWidth = 0;
	if (hairN) {
		const y = minY + fl * 0.08;
		let x0 = W,
			x1 = -1;
		for (let x = 0; x < W; x += step) if (isHair(x, y)) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x));
		topWidth = x1 > x0 ? (x1 - x0) / fw : 0;
	}
	const hairTop = crownGap > 0.42 && topWidth < 0.55;

	// outline roughness: how much the hair's left and right edges jump row to row
	// Only near the head (not stray patches elsewhere in the photo), below the round top of the
	// head (where the outline widens fast on any haircut), and the median row (one messy tuft is
	// not curls).
	const jumps: number[] = [];
	let prevL = -1,
		prevR = -1;
	for (let y = minY + fl * 0.12; y < Math.min(H, chin.y); y += step) {
		let x0 = -1,
			x1 = -1;
		for (let x = Math.max(0, cx - fw * 0.85); x < Math.min(W, cx + fw * 0.85); x += step)
			if (hair[at(x, y)]) {
				if (x0 < 0) x0 = x;
				x1 = x;
			}
		if (x0 < 0) continue;
		if (prevL >= 0) jumps.push(Math.abs(x0 - prevL) + Math.abs(x1 - prevR));
		prevL = x0;
		prevR = x1;
	}
	const hairRough = jumps.length ? clamp01((median(jumps) / step - 1) / 4) : 0;

	// covered: no hair at the forehead edge, and what is there is neither skin nor background
	const above = patch(cx - fw * 0.2, top.y - fl * 0.22, cx + fw * 0.2, top.y - fl * 0.08, () => true);
	const corner = patch(0, 0, W * 0.08, H * 0.08, () => true);
	const hairCovered = hairArea < 0.08 && above.n > 0 && deltaE(above.lab, skinLab) > 25 && deltaE(above.lab, corner.lab) > 20;

	// eyes, mouth, brows
	const eye = (t: number, b: number, o: number, i: number) => dist(P(t), P(b)) / dist(P(o), P(i));
	const eyeOpen = (eye(L.eyeLT, L.eyeLB, L.eyeLO, L.eyeLI) + eye(L.eyeRT, L.eyeRB, L.eyeRO, L.eyeRI)) / 2;

	const bs = (n: string) => s.blend[n] ?? 0;
	const smile = (bs('mouthSmileLeft') + bs('mouthSmileRight')) / 2;
	const jawOpen = bs('jawOpen');
	const arch = (o: number, p: number, i: number) => ((P(o).y + P(i).y) / 2 - P(p).y) / dist(P(o), P(i));
	const browArch = clamp01((arch(L.browLOut, L.browLPeak, L.browLIn) + arch(L.browROut, L.browRPeak, L.browRIn)) / 2 / 0.25);

	// glasses: strong edges across the nose bridge and under the eyes, compared with the cheeks
	const edge = (p: Pt, w: number, h: number) => {
		let sum = 0,
			n = 0;
		for (let y = p.y - h; y < p.y + h; y++)
			for (let x = p.x - w; x < p.x + w; x++) {
				if (!inside(x, y + 1)) continue;
				sum += Math.abs(lab(x, y + 1)[0] - lab(x, y)[0]);
				n++;
			}
		return n ? sum / n : 0;
	};
	const bridge = edge(P(L.bridge), fw * 0.05, fw * 0.03);
	const cheekEdge = (edge(P(L.cheekPatchL), fw * 0.04, fw * 0.04) + edge(P(L.cheekPatchR), fw * 0.04, fw * 0.04)) / 2;
	const thick = clamp01((bridge / Math.max(0.5, cheekEdge) - 1.5) / 3);
	// thin wire frames: a dark line a few pixels wide on both sides of the nose (the rims) and
	// across it (the bridge). Skin there is smooth, so thin dark lines mean frames.
	const k = Math.max(2, Math.round(fw * 0.012));
	const Lx = (x: number, y: number) => (inside(x, y) ? lab(x, y)[0] : 100);
	const ridgeH = (x: number, y: number) => !isHair(x, y) && Lx(x, y) < Math.min(Lx(x - k, y), Lx(x + k, y)) - 5;
	const ridgeV = (x: number, y: number) => !isHair(x, y) && Lx(x, y) < Math.min(Lx(x, y - k), Lx(x, y + k)) - 5;
	const li = P(L.eyeLI),
		ri = P(L.eyeRI);
	const lidTop = Math.min(P(L.eyeLT).y, P(L.eyeRT).y),
		lidBot = Math.max(P(L.eyeLB).y, P(L.eyeRB).y);
	let rimRows = 0,
		rimHits = 0;
	for (let y = lidTop - fw * 0.05; y < lidBot + fw * 0.12; y++) {
		rimRows++;
		let l = false,
			rr = false;
		for (let x = Math.min(li.x, ri.x) + fw * 0.02; x < cx - fw * 0.03 && !l; x++) l = ridgeH(x, y);
		for (let x = cx + fw * 0.03; x < Math.max(li.x, ri.x) - fw * 0.02 && !rr; x++) rr = ridgeH(x, y);
		if (l && rr) rimHits++;
	}
	const browIn = Math.max(P(L.browLIn).y, P(L.browRIn).y);
	let brCols = 0,
		brHits = 0;
	for (let x = cx - fw * 0.06; x < cx + fw * 0.06; x++) {
		brCols++;
		let hit = false;
		for (let y = browIn + fw * 0.03; y < P(L.bridge).y + fw * 0.04 && !hit; y++) hit = ridgeV(x, y);
		if (hit) brHits++;
	}
	const rims = rimRows ? rimHits / rimRows : 0,
		bridgeLine = brCols ? brHits / brCols : 0;
	const thin = (clamp01((rims - 0.15) / 0.35) + clamp01((bridgeLine - 0.2) / 0.5)) / 2;
	const glasses = Math.max(thick, thin);

	// beard: hair-dark pixels in the jaw band, above the lip and on the chin, against the cheeks
	const dark = (x0: number, y0: number, x1: number, y1: number) => {
		let d = 0,
			n = 0;
		const st = Math.max(1, Math.round((x1 - x0) / 30));
		for (let y = Math.max(0, y0); y < Math.min(H, y1); y += st)
			for (let x = Math.max(0, x0); x < Math.min(W, x1); x += st) {
				n++;
				const c = lab(x, y);
				if (!isHair(x, y) && c[0] < skinAt(x)[0] - 22 && deltaE(c, skinAt(x)) > 24) d++;
			}
		return n ? d / n : 0;
	};
	const nb = P(L.noseBottom),
		ul = P(L.upperLip),
		ll = P(L.lowerLip);
	const beardLip = dark(cx - fw * 0.15, nb.y + (ul.y - nb.y) * 0.25, cx + fw * 0.15, ul.y - (ul.y - nb.y) * 0.1);
	const beardChin = dark(cx - fw * 0.14, ll.y + (chin.y - ll.y) * 0.2, cx + fw * 0.14, chin.y - (chin.y - ll.y) * 0.1);
	const jl = P(L.jawL),
		jr = P(L.jawR);
	// the cheek below the mouth corners, inside the face outline (not the neck or the shadow under the jaw)
	const jy0 = ul.y,
		jy1 = (Math.max(jl.y, jr.y) + chin.y) / 2;
	const beardJaw = (dark(jl.x + fw * 0.06, jy0, jl.x + fw * 0.2, jy1) + dark(jr.x - fw * 0.2, jy0, jr.x - fw * 0.06, jy1)) / 2;

	return { faceRatio, jawRatio, skinLab, faceBright, teethL, hairArea, hairBelowChin, hairFringe, hairTop, hairRough, hairLab, hairCovered, eyeOpen, smile, jawOpen, browArch, glasses, beardJaw, beardLip, beardChin };
}
