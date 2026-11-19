/**
 * The selfie reader, on the phone (docs/AVATAR.md).
 *
 * MediaPipe Face Landmarker and the hair segmenter run in WebAssembly in this tab. The photo is
 * drawn to a canvas, read, and dropped: it is never uploaded and never stored. The files (~19 MB:
 * the WebAssembly in /avatar/vendor/mediapipe, the models in /avatar/models) download the first
 * time, with progress, and are kept by the service worker's runtime cache after that.
 */
import { measure, type Measurements } from './measure.ts';

const WASM_DIR = '/avatar/vendor/mediapipe';
const FILES = {
	wasm: `${WASM_DIR}/vision_wasm_internal.wasm`,
	face: '/avatar/models/face_landmarker.task',
	hair: '/avatar/models/hair_segmenter.tflite'
};

export type ReadResult = { ok: true; m: Measurements } | { ok: false; reason: 'no_face' | 'many_faces' };

interface Reader {
	read(img: HTMLCanvasElement): ReadResult;
	close(): void;
}

/** Fetch a file and report bytes as they arrive. */
async function fetchWithProgress(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
	const parts: Uint8Array[] = [];
	const rd = res.body.getReader();
	for (;;) {
		const { done, value } = await rd.read();
		if (done) break;
		parts.push(value);
		onBytes(value.length);
	}
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) out.set(p, o), (o += p.length);
	return out;
}

/** Approximate total download, for the progress bar (bytes). */
export const READER_BYTES = 14_200_000 + 3_758_596 + 781_618;

let loading: Promise<Reader> | null = null;
/**
 * Load the reader once per page. `onProgress` gets 0..1. Rejects offline before the first
 * download, or when the browser can't run WebAssembly.
 */
export function loadReader(onProgress: (p: number) => void = () => {}): Promise<Reader> {
	if (loading) return loading;
	loading = (async () => {
		let got = 0;
		const tick = (n: number) => onProgress(Math.min(0.99, (got += n) / READER_BYTES));
		// The WebAssembly is fetched here first so the bar moves; MediaPipe's own fetch then
		// comes from the browser or service-worker cache.
		const [vision, , face, hair] = await Promise.all([
			import('@mediapipe/tasks-vision'),
			fetchWithProgress(FILES.wasm, tick),
			fetchWithProgress(FILES.face, tick),
			fetchWithProgress(FILES.hair, tick)
		]);
		const files = await vision.FilesetResolver.forVisionTasks(WASM_DIR);
		const landmarker = await vision.FaceLandmarker.createFromOptions(files, {
			baseOptions: { modelAssetBuffer: face },
			runningMode: 'IMAGE',
			numFaces: 2,
			outputFaceBlendshapes: true
		});
		const segmenter = await vision.ImageSegmenter.createFromOptions(files, {
			baseOptions: { modelAssetBuffer: hair },
			runningMode: 'IMAGE',
			outputCategoryMask: true,
			outputConfidenceMasks: false
		});
		onProgress(1);
		return {
			read(img: HTMLCanvasElement): ReadResult {
				const f = landmarker.detect(img);
				if (!f.faceLandmarks.length) return { ok: false, reason: 'no_face' };
				if (f.faceLandmarks.length > 1) return { ok: false, reason: 'many_faces' };
				const blend: Record<string, number> = {};
				for (const c of f.faceBlendshapes[0]?.categories ?? []) blend[c.categoryName] = c.score;
				const seg = segmenter.segment(img);
				const mask = seg.categoryMask!;
				const hair = new Uint8Array(mask.getAsUint8Array());
				seg.close();
				const ctx = img.getContext('2d', { willReadFrequently: true })!;
				const px = ctx.getImageData(0, 0, img.width, img.height);
				const m = measure({ landmarks: f.faceLandmarks[0], blend, rgba: px.data, width: img.width, height: img.height, hair });
				return { ok: true, m };
			},
			close() {
				landmarker.close();
				segmenter.close();
				loading = null;
			}
		};
	})();
	loading.catch(() => (loading = null));
	return loading;
}

/** A photo (camera frame or picked file) on a canvas no larger than `max` px, the right way up. */
export async function toCanvas(src: Blob | HTMLVideoElement, max = 720, mirror = false): Promise<HTMLCanvasElement> {
	const img: CanvasImageSource & { width: number; height: number } =
		src instanceof Blob ? await createImageBitmap(src) : Object.assign(src, { width: src.videoWidth, height: src.videoHeight });
	const k = Math.min(1, max / Math.max(img.width, img.height));
	const c = document.createElement('canvas');
	c.width = Math.round(img.width * k);
	c.height = Math.round(img.height * k);
	const g = c.getContext('2d', { willReadFrequently: true })!;
	if (mirror) g.setTransform(-1, 0, 0, 1, c.width, 0);
	g.drawImage(img, 0, 0, c.width, c.height);
	if (img instanceof ImageBitmap) img.close();
	return c;
}

/** Forget a photo: blank the canvas and let it go. */
export function wipe(c: HTMLCanvasElement | null | undefined) {
	if (!c) return;
	c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
	c.width = c.height = 0;
}
