// Downloads KanjiVG stroke data for every kana and kanji the app teaches and
// writes src/lib/content/strokes.json (kana) and kanji-strokes.json (kanji).
//
// KanjiVG © Ulrich Apel — CC BY-SA 3.0 — https://kanjivg.tagaini.net
// The generated file is a derivative work and keeps that licence.
//
// For each character we store:
//   d      — the original SVG path data per stroke (for drawing/animation)
//   n      — stroke-number label positions
//   p      — each stroke resampled to SAMPLES points in a 0..1 box
//            (templates for the handwriting matcher)
//   g      — kanji only: the top-level components KanjiVG marks inside the
//            character, as [element, original|null, firstStroke, lastStroke]
//            (e.g. 休 → 亻 (from 人) strokes 0–1, 木 strokes 2–5)

import { writeFile } from 'node:fs/promises';

const SAMPLES = 24;
const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';

const HIRAGANA =
	'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
	'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const KATAKANA =
	'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
	'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ';

// Keep in sync with src/lib/content/kanji.ts (a test checks every kanji has data).
const KANJI = '日月山川木火' + '水雨田土石' + '口目耳手足' + '人女子大力' + '一二三上下中本' + '休林森明男好';

const kanaChars = [...HIRAGANA, ...KATAKANA];
const kanjiChars = [...KANJI];

/** Tokenise and flatten an SVG path into polylines (one per subpath). */
function flatten(d) {
	const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
	let i = 0;
	let cmd = '';
	let x = 0,
		y = 0,
		sx = 0,
		sy = 0,
		lcx = 0,
		lcy = 0; // last control point (for S/s)
	const pts = [];
	const num = () => parseFloat(tokens[i++]);
	const cubic = (x1, y1, x2, y2, x3, y3) => {
		const steps = 16;
		for (let k = 1; k <= steps; k++) {
			const t = k / steps,
				u = 1 - t;
			pts.push([
				u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
				u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
			]);
		}
		lcx = x2;
		lcy = y2;
		x = x3;
		y = y3;
	};
	while (i < tokens.length) {
		if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
		const rel = cmd === cmd.toLowerCase();
		const ox = rel ? x : 0,
			oy = rel ? y : 0;
		switch (cmd.toUpperCase()) {
			case 'M':
				x = ox + num();
				y = oy + num();
				sx = x;
				sy = y;
				pts.push([x, y]);
				cmd = rel ? 'l' : 'L';
				lcx = x;
				lcy = y;
				break;
			case 'L':
				x = ox + num();
				y = oy + num();
				pts.push([x, y]);
				lcx = x;
				lcy = y;
				break;
			case 'H':
				x = (rel ? x : 0) + num();
				pts.push([x, y]);
				break;
			case 'V':
				y = (rel ? y : 0) + num();
				pts.push([x, y]);
				break;
			case 'C': {
				const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
				cubic(...a);
				break;
			}
			case 'S': {
				const x1 = 2 * x - lcx,
					y1 = 2 * y - lcy;
				const a = [ox + num(), oy + num(), ox + num(), oy + num()];
				cubic(x1, y1, ...a);
				break;
			}
			case 'Z':
				x = sx;
				y = sy;
				pts.push([x, y]);
				break;
			default:
				throw new Error(`Unsupported path command ${cmd} in ${d}`);
		}
	}
	return pts;
}

/** Resample a polyline to n evenly spaced points. */
function resample(pts, n) {
	const lens = [0];
	for (let k = 1; k < pts.length; k++) {
		lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
	}
	const total = lens[lens.length - 1] || 1;
	const out = [];
	let j = 0;
	for (let k = 0; k < n; k++) {
		const target = (k / (n - 1)) * total;
		while (j < lens.length - 2 && lens[j + 1] < target) j++;
		const seg = lens[j + 1] - lens[j] || 1;
		const t = Math.min(1, Math.max(0, (target - lens[j]) / seg));
		const a = pts[j],
			b = pts[Math.min(j + 1, pts.length - 1)];
		out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
	}
	return out;
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Top-level components of the character, with the strokes each one holds. */
function components(svg, code) {
	const tags = svg.matchAll(/<g\b([^>]*)>|<\/g>|<path\b([^>]*?)\/?>/g);
	const stack = [];
	let charDepth = -1;
	let stroke = 0;
	const groups = [];
	for (const t of tags) {
		if (t[0].startsWith('</g')) {
			stack.pop();
			continue;
		}
		if (t[0].startsWith('<g')) {
			const attrs = t[1];
			const id = attrs.match(/id="([^"]+)"/)?.[1] ?? '';
			stack.push({
				id,
				el: attrs.match(/kvg:element="([^"]+)"/)?.[1] ?? null,
				orig: attrs.match(/kvg:original="([^"]+)"/)?.[1] ?? null
			});
			if (id === `kvg:${code}`) charDepth = stack.length - 1;
			continue;
		}
		if (!/id="kvg:[0-9a-f]+-s\d+"/.test(t[2] ?? '')) continue;
		const top = charDepth >= 0 ? stack[charDepth + 1] : undefined;
		if (top?.el) {
			const last = groups[groups.length - 1];
			if (last && last.id === top.id) last.to = stroke;
			else groups.push({ id: top.id, el: top.el, orig: top.orig, from: stroke, to: stroke });
		}
		stroke++;
	}
	return groups.map((g) => [g.el, g.orig, g.from, g.to]);
}

async function build(chars, file, withGroups) {
	const out = {};
	for (const ch of chars) {
		const code = ch.codePointAt(0).toString(16).padStart(5, '0');
		const res = await fetch(`${BASE}${code}.svg`);
		if (!res.ok) throw new Error(`KanjiVG ${ch} (${code}): HTTP ${res.status}`);
		const svg = await res.text();

		const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*?\sd="([^"]+)"/g)]
			.map((m) => ({ i: Number(m[1]), d: m[2] }))
			.sort((a, b) => a.i - b.i);
		const nums = [...svg.matchAll(/matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)</g)]
			.sort((a, b) => Number(a[3]) - Number(b[3]))
			.map((m) => [round(Number(m[1])), round(Number(m[2]))]);

		out[ch] = {
			d: strokes.map((s) => s.d),
			n: nums,
			// KanjiVG uses a 109×109 box; normalise to 0..1.
			p: strokes.map((s) =>
				resample(flatten(s.d), SAMPLES)
					.flat()
					.map((v) => round(v / 109))
			)
		};
		if (withGroups) {
			const g = components(svg, code);
			// a single component covering every stroke is just the kanji itself
			if (g.length > 1 || (g.length === 1 && g[0][3] - g[0][2] + 1 < strokes.length)) out[ch].g = g;
		}
		process.stdout.write(ch);
	}
	await writeFile(new URL(`../src/lib/content/${file}`, import.meta.url), JSON.stringify(out) + '\n');
	console.log(`\nWrote ${Object.keys(out).length} characters to ${file}.`);
}

await build(kanaChars, 'strokes.json', false);
await build(kanjiChars, 'kanji-strokes.json', true);
