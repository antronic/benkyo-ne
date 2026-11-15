// @ts-nocheck -- hand-tuned procedural geometry and a tiny WebGL1 renderer; typed at the edge in kuri.svelte.ts
/*
 * Kuri: Benkyo's low-poly Shiba companion.
 * Procedural geometry + a small WebGL1 renderer, no dependencies (~9 KB gzipped).
 * Loaded with a dynamic import, so nothing is downloaded while Kuri is turned off.
 *
 *   const k = create(canvas, { variant: 'bandana' | 'neckerchief', detail: 'full' | 'low', theme, reducedMotion, fps });
 *   k.setPose('idle' | 'happy' | 'thinking' | 'encourage' | 'sleep' | 'wave' | 'walk' | 'held');
 *   k.setFacing(radians); k.setTheme('light' | 'dark'); k.setReducedMotion(bool); k.setPaused(bool); k.destroy();
 *
 * Performance: one interleaved vertex buffer (20 bytes a vertex), no per-frame
 * matrix allocations, parts scaled to zero are skipped, rendering stops while the
 * tab is hidden or the instance is paused, and destroy() frees the GL context.
 */


/* ------------------------------------------------------------ math -- */
function mul(a, b, o) {
	o = o || new Float32Array(16);
	var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
	for (var c = 0; c < 4; c++) {
		var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
		o[c * 4] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3;
		o[c * 4 + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
		o[c * 4 + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3;
		o[c * 4 + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
	}
	return o;
}
function trs(t, r, s, o) {
	// T * Ry * Rx * Rz * S
	var cx = Math.cos(r[0]), sx = Math.sin(r[0]);
	var cy = Math.cos(r[1]), sy = Math.sin(r[1]);
	var cz = Math.cos(r[2]), sz = Math.sin(r[2]);
	// R = Ry*Rx*Rz
	var m00 = cy * cz + sy * sx * sz, m01 = -cy * sz + sy * sx * cz, m02 = sy * cx;
	var m10 = cx * sz, m11 = cx * cz, m12 = -sx;
	var m20 = -sy * cz + cy * sx * sz, m21 = sy * sz + cy * sx * cz, m22 = cy * cx;
	o = o || new Float32Array(16);
	o[0] = m00 * s[0]; o[1] = m10 * s[0]; o[2] = m20 * s[0]; o[3] = 0;
	o[4] = m01 * s[1]; o[5] = m11 * s[1]; o[6] = m21 * s[1]; o[7] = 0;
	o[8] = m02 * s[2]; o[9] = m12 * s[2]; o[10] = m22 * s[2]; o[11] = 0;
	o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
	return o;
}
function persp(fov, asp, n, f) {
	var t = 1 / Math.tan(fov / 2);
	return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
}
function lookAt(e, c) {
	var z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
	return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scl(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function hash(a) { var s = Math.sin(a[0] * 127.1 + a[1] * 311.7 + a[2] * 74.7) * 43758.5453; return s - Math.floor(s); }

/* --------------------------------------------------------- palette -- */
// Coat and markings are Kuri's own; accents come from the Benkyo tokens.
var C = {
	coat: hex('#e07f3c'),
	coatTop: hex('#c9682d'),
	coatLight: hex('#eda463'),
	cream: hex('#f8eedf'),
	creamShade: hex('#efdcc4'),
	ink: hex('#1d1d24'), // --p-sumi-850
	earIn: hex('#f2c6a6'),
	blush: hex('#ff7a5c'), // --p-shu-300
	tongue: hex('#ff8b8f'),
	mouth: hex('#5b2230'),
	scarf: hex('#e8432e'), // --p-shu-500
	scarfDark: hex('#b8264f'), // --p-shu-700
	ai: hex('#7b93ff'), // --p-ai-400
	ai2: hex('#a78bfa'), // --p-sumire-400
	white: hex('#ffffff'),
	gold: hex('#ffc53d'), // --p-yamabuki-400
	matcha: hex('#5fd17a'), // --p-matcha-400
	band: hex('#b8352b'), // deep vermilion, a shade under --p-shu-500
	bandLight: hex('#c8402f'),
	bandDark: hex('#86221e')
};

/* -------------------------------------------------------- geometry -- */
var LOW = false; // set by build(); 'low' detail drops subdivision and sides
function Mesh() { this.p = []; this.n = []; this.c = []; }
Mesh.prototype.tri = function (a, b, c, col, inside) {
	var n = norm(cross(sub(b, a), sub(c, a)));
	var ctr = scl(add(add(a, b), c), 1 / 3);
	if (inside && dot(n, sub(ctr, inside)) < 0) { n = scl(n, -1); var t = b; b = c; c = t; }
	var k = 0.96 + hash([Math.abs(ctr[0]), ctr[1], ctr[2]]) * 0.08; // faint per-facet variation sells the faceting
	var cc = typeof col === 'function' ? col(ctr, n) : col;
	cc = [cc[0] * k, cc[1] * k, cc[2] * k];
	[a, b, c].forEach(function (v) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(cc[0], cc[1], cc[2]); }, this);
	return this;
};

var ICO = (function () {
	var t = (1 + Math.sqrt(5)) / 2;
	var v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
	var f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
	return { v: v, f: f };
})();
function icosphere(sub1) {
	var v = ICO.v.slice(), f = ICO.f;
	if (sub1) {
		var cache = {}, nf = [];
		var mid = function (a, b) {
			var k = a < b ? a + '_' + b : b + '_' + a;
			if (cache[k] == null) { v.push(norm(scl(add(v[a], v[b]), 0.5))); cache[k] = v.length - 1; }
			return cache[k];
		};
		f.forEach(function (t) {
			var a = mid(t[0], t[1]), b = mid(t[1], t[2]), c = mid(t[2], t[0]);
			nf.push([t[0], a, c], [t[1], b, a], [t[2], c, b], [a, b, c]);
		});
		f = nf;
	}
	return { v: v, f: f };
}
// Faceted ellipsoid. col(u, n) gets the face centre in unit-sphere space.
// Low-detail sphere: rings of 2*lat... laid out mirror-symmetric about x.
function uvsphere(lat, lon) {
	var v = [[0, 1, 0]], f = [];
	for (var i = 1; i < lat; i++) {
		var ph = (i / lat) * Math.PI;
		for (var k = 0; k < lon; k++) { var th = ((k + 0.5) / lon) * Math.PI * 2; v.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]); }
	}
	v.push([0, -1, 0]);
	var bot = v.length - 1, at = function (i, k) { return 1 + (i - 1) * lon + ((k + lon) % lon); };
	for (k = 0; k < lon; k++) {
		f.push([0, at(1, k + 1), at(1, k)]);
		f.push([bot, at(lat - 1, k), at(lat - 1, k + 1)]);
		for (i = 1; i < lat - 1; i++) f.push([at(i, k), at(i, k + 1), at(i + 1, k + 1)], [at(i, k), at(i + 1, k + 1), at(i + 1, k)]);
	}
	return { v: v, f: f };
}
function blob(m, ctr, r, col, o) {
	o = o || {};
	if (LOW && !o.keep && o.sub !== 0) { r = o.big ? [r[0] * 0.92, r[1] * 0.95, r[2] * 0.92] : r; }
	var s = LOW && !o.keep && o.sub !== 0 ? uvsphere(o.big ? 4 : 3, o.big ? 8 : 6) : icosphere(o.sub !== 0), j = LOW && !o.keep ? 0.02 : o.jitter == null ? 0.06 : o.jitter, seed = o.seed || 1;
	var vs = s.v.map(function (v) {
		var k = 1 + (hash(scl([Math.abs(v[0]), v[1], v[2]], seed * 3.1)) - 0.5) * j; // mirrored, so left and right match
		var w = [v[0] * k, v[1] * k, v[2] * k];
		if (o.taper) w[0] *= 1 + o.taper * w[1]; // wider at the bottom when taper < 0
		return w;
	});
	s.f.forEach(function (f) {
		var a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
		var u = norm(scl(add(add(a, b), c), 1 / 3));
		var cc = typeof col === 'function' ? col(u) : col;
		var P = function (v) { return [ctr[0] + v[0] * r[0], ctr[1] + v[1] * r[1], ctr[2] + v[2] * r[2]]; };
		m.tri(P(a), P(b), P(c), cc, ctr);
	});
	return m;
}
// Tapered prism hanging down from the origin (legs).
function prism(m, r0, r1, h, sides, col, off) {
	if (LOW && sides > 5) sides = sides > 8 ? 7 : 5;
	off = off || [0, 0, 0];
	var ring = function (r, y) {
		var out = [];
		for (var i = 0; i < sides; i++) {
			var a = (i / sides) * Math.PI * 2 + 0.3;
			out.push([off[0] + Math.cos(a) * r, off[1] + y, off[2] + Math.sin(a) * r * 1.05]);
		}
		return out;
	};
	var A = ring(r0, 0), B = ring(r1, -h);
	for (var i = 0; i < sides; i++) {
		var k = (i + 1) % sides, ctr = [off[0], off[1] - h / 2, off[2]];
		var cy = function (p) { return typeof col === 'function' ? col(p) : col; };
		m.tri(A[i], B[i], B[k], cy, ctr).tri(A[i], B[k], A[k], cy, ctr);
	}
	return m;
}
function box(m, ctr, s, col) {
	var x = s[0] / 2, y = s[1] / 2, z = s[2] / 2, c = ctr;
	var v = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]].map(function (p) { return add(p, c); });
	[[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]].forEach(function (q) {
		m.tri(v[q[0]], v[q[1]], v[q[2]], col, c).tri(v[q[0]], v[q[2]], v[q[3]], col, c);
	});
	return m;
}
function octa(m, ctr, r, col) {
	var v = [[r[0], 0, 0], [-r[0], 0, 0], [0, r[1], 0], [0, -r[1], 0], [0, 0, r[2]], [0, 0, -r[2]]].map(function (p) { return add(p, ctr); });
	[[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]].forEach(function (f) {
		m.tri(v[f[0]], v[f[1]], v[f[2]], typeof col === 'function' ? col(f) : col, ctr);
	});
	return m;
}
// Ear: a four-sided pyramid, apex up, slightly cupped forward.
function ear(m, w, d, h, col, front) {
	var b = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2]];
	var apex = [0.02, h, front], ctr = [0, h * 0.3, 0];
	for (var i = 0; i < 4; i++) m.tri(b[i], b[(i + 1) % 4], apex, col, ctr);
	return m;
}
// Curled tail: a hexagonal tube along a rising spiral.
function tail(m) {
	var r = 0.21, A = Math.PI * 1.55, N = LOW ? 6 : 9, S = LOW ? 4 : 6, rings = [], pts = [];
	for (var i = 0; i <= N; i++) {
		var a = (i / N) * A;
		pts.push([0.05 * a, r - r * Math.cos(a), -r * Math.sin(a) * 1.1]);
	}
	var ctr = [0.12, r, 0];
	for (i = 0; i <= N; i++) {
		var p = pts[i], T = norm(sub(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)]));
		var X = norm(sub([1, 0, 0], scl(T, dot([1, 0, 0], T)))), B = cross(T, X);
		var rad = 0.13 - 0.075 * (i / N) + (i === 1 ? 0.015 : 0);
		var ring = [];
		for (var s = 0; s < S; s++) {
			var th = (s / S) * Math.PI * 2;
			ring.push(add(p, add(scl(X, Math.cos(th) * rad), scl(B, Math.sin(th) * rad))));
		}
		rings.push(ring);
	}
	var col = function (c, n) {
		var toC = norm(sub(ctr, c));
		return dot(n, toC) > 0.25 ? C.cream : C.coat;
	};
	for (i = 0; i < N; i++)
		for (s = 0; s < S; s++) {
			var k = (s + 1) % S, mid = pts[i];
			m.tri(rings[i][s], rings[i + 1][s], rings[i + 1][k], col, mid).tri(rings[i][s], rings[i + 1][k], rings[i][k], col, mid);
		}
	var last = rings[N], tip = add(pts[N], scl(norm(sub(pts[N], pts[N - 1])), 0.09));
	for (s = 0; s < S; s++) m.tri(last[s], last[(s + 1) % S], tip, C.cream, pts[N]);
	return m;
}

/* ----------------------------------------------------------- model -- */
function N(name, t, r, mesh) { return { name: name, t: t || [0, 0, 0], r: r || [0, 0, 0], s: [1, 1, 1], mesh: mesh || null, kids: [], emit: 0 }; }
function kid(p, c) { p.kids.push(c); return c; }

function build(variant, detail) {
	LOW = detail === 'low';
	var apron = variant === 'bandana';
	var nodes = {};
	var reg = function (n) { nodes[n.name] = n; return n; };
	var root = reg(N('root'));

	// shadow is drawn separately; everything else hangs off root
	var torso = reg(kid(root, N('torso', [0, 0.42, -0.05], [0.3, 0, 0])));
	var torsoMesh = blob(new Mesh(), [0, 0.44, 0.02], [0.5, 0.58, 0.47], function (u) {
		if (u[2] > 0.42 && u[1] < 0.7 && Math.abs(u[0]) < 0.75) return C.cream; // urajiro chest
		if (u[1] < -0.55) return C.creamShade;
		if (u[2] < -0.3 && u[1] > 0.2) return C.coatTop;
		return C.coat;
	}, { seed: 2, taper: -0.15, big: true });
	reg(kid(torso, N('torsoMesh', [0, 0, 0], [0, 0, 0], torsoMesh)));

	// haunches and hind feet sit on the ground, so they belong to root
	[-1, 1].forEach(function (sd) {
		var h = reg(kid(root, N('haunch' + (sd < 0 ? 'L' : 'R'), [0.3 * sd, 0.29, -0.13], [0.15, 0.18 * sd, 0])));
		h.mesh = blob(new Mesh(), [0, 0, 0], [0.22, 0.29, 0.36], function (u) { return u[1] < -0.45 || (u[2] > 0.6 && u[1] < 0) ? C.cream : C.coat; }, { seed: 4 + sd, big: true });
		var f = kid(h, N('hfoot', [0.04 * sd, -0.22, 0.3], [-0.15, 0, 0]));
		f.mesh = blob(new Mesh(), [0, 0, 0], [0.12, 0.075, 0.18], C.cream, { seed: 7 + sd });
		reg(f); f.name = 'hfoot' + (sd < 0 ? 'L' : 'R'); nodes[f.name] = f;
		var hl = reg(kid(h, N('hleg' + (sd < 0 ? 'L' : 'R'), [0.02 * sd, -0.12, -0.02])));
		hl.mesh = prism(new Mesh(), 0.13, 0.1, 0.5, 6, function (p) { return p[1] < -0.3 ? C.cream : C.coat; });
		kid(hl, N('hpaw', [0, -0.5, 0.05], [0, 0, 0], blob(new Mesh(), [0, 0, 0], [0.12, 0.075, 0.15], C.cream, { seed: 13 + sd })));
	});

	// front legs: shoulder -> elbow -> paw
	[-1, 1].forEach(function (sd) {
		var id = sd < 0 ? 'L' : 'R';
		var sh = reg(kid(torso, N('sh' + id, [0.21 * sd, 0.62, 0.22], [-0.3, 0, 0])));
		sh.mesh = prism(new Mesh(), 0.14, 0.115, 0.42, 6, function (p) { return p[2] > 0.08 && p[1] < -0.15 ? C.cream : C.coat; });
		var el = reg(kid(sh, N('el' + id, [0, -0.4, 0])));
		el.mesh = prism(new Mesh(), 0.115, 0.1, 0.36, 6, function (p) { return p[1] < -0.2 || p[2] > 0.03 ? C.cream : C.coat; });
		var paw = kid(el, N('paw', [0, -0.37, 0.05]));
		paw.mesh = blob(new Mesh(), [0, 0, 0], [0.13, 0.08, 0.16], C.cream, { seed: 9 + sd });
	});

	// neckerchief in Benkyo vermilion with the AI gem as its knot
	var gemHost;
	if (apron) {
		// big tied bandana: neck band, a folded triangle over the chest, knot at the back
		var bd = reg(kid(torso, N('bandana', [0, 0.9, 0.08], [-0.15, 0, 0])));
		var bm = prism(new Mesh(), 0.34, 0.41, 0.13, 9, function (p) { return p[1] < -0.09 ? C.bandDark : C.band; });
		var Lt = [-0.33, -0.05, 0.3], Rt = [0.33, -0.05, 0.3], Mt = [0, -0.07, 0.43];
		var Lm = [-0.24, -0.32, 0.42], Rm = [0.24, -0.32, 0.42], tip = [0, -0.66, 0.5], bctr = [0, -0.3, 0.1];
		var off = function (p) { return [p[0], p[1], p[2] - 0.035]; };
		[[Lt, Mt, Lm], [Mt, tip, Lm], [Mt, Rt, Rm], [Mt, Rm, tip]].forEach(function (f, n) {
			bm.tri(f[0], f[1], f[2], n % 2 ? C.band : C.bandLight, bctr);
			bm.tri(off(f[0]), off(f[2]), off(f[1]), C.bandDark, [0, -0.3, 0.9]);
		});
		// edges so the cloth has a little thickness
		[[Lt, Lm], [Lm, tip], [tip, Rm], [Rm, Rt]].forEach(function (e) {
			bm.tri(e[0], e[1], off(e[1]), C.bandDark, bctr).tri(e[0], off(e[1]), off(e[0]), C.bandDark, bctr);
		});
		octa(bm, [0.25, 0.0, -0.24], [0.075, 0.07, 0.07], C.band);
		var K = [0.25, 0.02, -0.24];
		bm.tri(K, [0.43, 0.26, -0.3], [0.33, 0.06, -0.36], C.band, [0.3, 0, 0]).tri(K, [0.33, 0.06, -0.36], [0.43, 0.26, -0.3], C.bandDark, [0.3, 0, -0.6]);
		bm.tri(K, [0.4, -0.06, -0.44], [0.3, -0.12, -0.3], C.band, [0.3, 0, 0]).tri(K, [0.3, -0.12, -0.3], [0.4, -0.06, -0.44], C.bandDark, [0.3, 0, -0.6]);
		bd.mesh = bm;
		gemHost = kid(bd, N('pin', [0, -0.13, 0.44]));
	} else {
	var scarf = reg(kid(torso, N('scarf', [0, 0.9, 0.08], [-0.15, 0, 0])));
	var sm = prism(new Mesh(), 0.33, 0.4, 0.13, 9, function (p) { return p[1] < -0.09 ? C.scarfDark : C.scarf; });
	// front flap
	var fl = [[-0.22, -0.06, 0.38], [0.22, -0.06, 0.38], [0, -0.36, 0.42]], flb = [[-0.22, -0.06, 0.31], [0.22, -0.06, 0.31], [0, -0.34, 0.35]];
	sm.tri(fl[0], fl[2], fl[1], C.scarf, [0, -0.15, 0.2]).tri(flb[0], flb[1], flb[2], C.scarfDark, [0, -0.15, 0.6]);
	for (var i = 0; i < 3; i++) { var j = (i + 1) % 3; sm.tri(fl[i], flb[i], flb[j], C.scarfDark, [0, -0.15, 0.36]).tri(fl[i], flb[j], fl[j], C.scarfDark, [0, -0.15, 0.36]); }
	scarf.mesh = sm;
	gemHost = kid(scarf, N('pin', [0, -0.09, 0.43]));
	}
	var gem = reg(kid(gemHost, N('gem')));
	gem.mesh = octa(new Mesh(), [0, 0, 0], [0.075, 0.095, 0.05], function (f) { return f[0] === 2 || f[1] === 2 || f[2] === 2 ? C.ai : C.ai2; });

	// head
	var head = reg(kid(torso, N('head', [0, 1.0, 0.12], [-0.3, 0, 0])));
	var HC = [0, 0.3, 0.05]; head.s = [1.1, 1.1, 1.1];
	head.mesh = blob(new Mesh(), HC, [0.56, 0.47, 0.49], function (u) {
		if (u[1] < -0.15 && u[2] > 0.3) return C.cream; // cheeks + chin mask
		if (u[1] < -0.55) return C.cream;
		if (u[1] < 0.12 && u[2] > 0.55 && Math.abs(u[0]) > 0.35) return C.cream; // mask up the cheeks
		if (u[1] > 0.6) return C.coatTop;
		return C.coat;
	}, { seed: 3, jitter: 0.05, taper: -0.12, keep: true });
	var muz = kid(head, N('muzzle', [0, 0.16, 0.47]));
	muz.mesh = blob(new Mesh(), [0, 0, 0], [0.22, 0.155, 0.25], function (u) { return u[1] > 0.6 && u[2] < 0.5 ? C.coatLight : C.cream; }, { seed: 5 });
	kid(muz, N('nose', [0, 0.1, 0.24], [0, 0, 0], octa(new Mesh(), [0, 0, 0], [0.075, 0.05, 0.05], C.ink)));
	kid(muz, N('mouthIn', [0, -0.07, 0.12], [0, 0, 0], blob(new Mesh(), [0, 0, 0], [0.12, 0.06, 0.12], C.mouth, { sub: 0, jitter: 0 })));
	var jaw = reg(kid(muz, N('jaw', [0, -0.06, -0.02])));
	jaw.mesh = blob(new Mesh(), [0, -0.035, 0.12], [0.135, 0.055, 0.13], C.cream, { sub: 0, jitter: 0.04, seed: 11 });
	var tongue = reg(kid(jaw, N('tongue', [0, -0.005, 0.15])));
	tongue.mesh = blob(new Mesh(), [0, 0, 0.02], [0.075, 0.025, 0.1], C.tongue, { sub: 0, jitter: 0 });

	[-1, 1].forEach(function (sd) {
		var id = sd < 0 ? 'L' : 'R';
		var eye = reg(kid(head, N('eye' + id, [0.2 * sd, 0.37, 0.47], [0, 0.35 * sd, 0])));
		if (apron) {
			// narrow, almond eyes with the outer corner lifted
			eye.r = [0, 0.35 * sd, -0.22 * sd];
			eye.mesh = blob(new Mesh(), [0, 0, 0], [0.09, 0.036, 0.03], C.ink, { sub: 0, jitter: 0 });
			kid(eye, N('shine', [0.03 * sd, 0.012, 0.028], [0, 0, 0], octa(new Mesh(), [0, 0, 0], [0.013, 0.01, 0.008], C.white)));
		} else {
			eye.mesh = blob(new Mesh(), [0, 0, 0], [0.06, 0.075, 0.035], C.ink, { sub: 0, jitter: 0 });
			kid(eye, N('shine', [0.018, 0.028, 0.032], [0, 0, 0], octa(new Mesh(), [0, 0, 0], [0.018, 0.018, 0.01], C.white)));
		}
		// closed eye: two strokes, angle set per pose (^ happy, - sleep)
		var lid = reg(kid(head, N('lid' + id, [0.2 * sd, 0.35, 0.475], [0, 0.35 * sd, 0])));
		var a = reg(kid(lid, N('lidA' + id, [-0.03, 0, 0])));
		a.mesh = box(new Mesh(), [-0.03, 0, 0], [0.07, 0.018, 0.03], C.ink);
		var b = reg(kid(lid, N('lidB' + id, [0.03, 0, 0])));
		b.mesh = box(new Mesh(), [0.03, 0, 0], [0.07, 0.018, 0.03], C.ink);
		// cream brow dots (a shiba marking that doubles as eyebrows)
		var br = reg(kid(head, N('brow' + id, [0.17 * sd, 0.51, 0.44], [-0.2, 0.3 * sd, 0])));
		br.mesh = blob(new Mesh(), [0, 0, 0], [0.055, 0.028, 0.03], C.cream, { sub: 0, jitter: 0 });
		var bl = reg(kid(head, N('blush' + id, [0.33 * sd, 0.2, 0.4], [0, 0.65 * sd, 0])));
		bl.mesh = blob(new Mesh(), [0, 0, 0], [0.075, 0.04, 0.02], C.blush, { sub: 0, jitter: 0 });
		// ears
		var e = reg(kid(head, N('ear' + id, [0.29 * sd, 0.63, 0.0], [0, 0, -0.28 * sd])));
		e.mesh = ear(new Mesh(), 0.3, 0.16, 0.4, C.coat, 0.04);
		kid(e, N('earIn', [0.0, 0.03, 0.045], [0, 0, 0], ear(new Mesh(), 0.18, 0.06, 0.29, C.earIn, 0.03)));
	});

	// tail rises off the rump and curls over the back
	var tl = reg(kid(root, N('tail', [0.04, 0.48, -0.42], [0, 0, 0])));
	tl.mesh = tail(new Mesh());

	// AI thinking orbs
	for (i = 0; i < 3; i++) {
		var o = reg(kid(root, N('orb' + i, [0.55 + i * 0.22, 2.28 + i * 0.05, 0.2])));
		o.mesh = octa(new Mesh(), [0, 0, 0], [0.065, 0.08, 0.065], i === 1 ? mix(C.ai, C.ai2, 0.5) : i ? C.ai2 : C.ai);
	}
	// sleeping Zs
	for (i = 0; i < 3; i++) {
		var z = reg(kid(root, N('z' + i, [0.5, 2, 0.3])));
		var zm = new Mesh(), zc = mix(C.ai, C.ai2, 0.4);
		box(zm, [0, 0.07, 0], [0.16, 0.035, 0.03], zc); box(zm, [0, -0.07, 0], [0.16, 0.035, 0.03], zc);
		var dm = new Mesh(); box(dm, [0, 0, 0], [0.19, 0.035, 0.03], zc);
		z.mesh = zm; kid(z, N('zd', [0, 0, 0], [0, 0, 0.72], dm));
	}
	return { root: root, nodes: nodes };
}

/* ----------------------------------------------------------- poses -- */
var BASE = {
	rootY: 0, turn: 0, lean: 0.3, torsoZ: 0, lie: 0,
	hx: -0.3, hy: 0, hz: 0, // head pitch, yaw, roll
	earL: 0, earR: 0, earOut: 0,
	tailLift: 0, wag: 0.25, wagHz: 1.1,
	shLx: -0.3, shLz: 0, elL: 0, shRx: -0.3, shRz: 0, elR: 0,
	eyeOpen: 1, lidAngle: 0.45, browY: 0, browTilt: 0,
	jaw: 0.05, tongue: 0.4, blush: 1,
	stand: 0, stride: 0, walkHz: 2.2, bounce: 0, waveAmp: 0, orbs: 0, zzz: 0, gemGlow: 0.15, breatheHz: 0.33, sway: 1
};
function P(o) { var r = {}; for (var k in BASE) r[k] = BASE[k]; for (k in o) r[k] = o[k]; return r; }
var POSES = {
	idle: P({}),
	happy: P({
		bounce: 0.16, hx: -0.42, hz: 0.06, earL: -0.15, earR: -0.15, wag: 0.7, wagHz: 3.2, tailLift: 0.1,
		shLx: -2.3, shLz: -0.45, elL: -0.5, shRx: -2.3, shRz: 0.45, elR: -0.5,
		eyeOpen: 0, lidAngle: 0.55, jaw: 0.55, tongue: 1, blush: 1.35, browY: 0.03, gemGlow: 0.4, sway: 0.4
	}),
	thinking: P({
		hx: -0.5, hy: 0.25, hz: 0.24, earL: 0.1, earR: -0.12, wag: 0.12, wagHz: 0.7,
		shRx: -1.95, shRz: -0.35, elR: -1.25, eyeOpen: 0.85, browY: 0.035, browTilt: 0.2,
		jaw: 0, tongue: 0, orbs: 1, gemGlow: 1, sway: 0.6
	}),
	encourage: P({
		hx: -0.22, hy: -0.12, hz: -0.2, earL: 0.55, earR: 0.55, earOut: 0.25, wag: 0.18, wagHz: 0.9, tailLift: -0.15,
		shLx: -1.6, shLz: -0.2, elL: -0.55, eyeOpen: 0.7, browY: 0.015, browTilt: -0.35,
		jaw: 0.12, tongue: 0, blush: 1.2, gemGlow: 0.3
	}),
	sleep: P({
		lean: 1.3, lie: 1, hx: -0.12, hy: 0.25, hz: 0.18, earL: 0.6, earR: 0.6, earOut: 0.3,
		wag: 0, tailLift: -0.2, shLx: -1.78, elL: 0.05, shRx: -1.78, elR: 0.05, shLz: 0.08, shRz: -0.08,
		eyeOpen: 0, lidAngle: -0.2, browY: -0.01, jaw: 0, tongue: 0, blush: 0.8, zzz: 1, gemGlow: 0, breatheHz: 0.2, sway: 0
	}),
	walk: P({
		stand: 1, lean: 1.2, stride: 0.5, walkHz: 2.4, hx: -0.42, earL: -0.05, earR: -0.05, wag: 0.45, wagHz: 2.6, tailLift: 0.1,
		shLx: -0.3, shRx: -0.3, jaw: 0.3, tongue: 0.9, sway: 0.3, gemGlow: 0.2
	}),
	held: P({
		rootY: 0.15, hx: -0.45, earL: 0.35, earR: 0.35, earOut: 0.2, wag: 0.9, wagHz: 3.6,
		shLx: -0.55, shLz: -0.25, elL: -0.3, shRx: -0.55, shRz: 0.25, elR: -0.3,
		eyeOpen: 1, browY: 0.035, browTilt: 0.15, jaw: 0.45, tongue: 0.6, blush: 1.4, sway: 0.2
	}),
	wave: P({
		hx: -0.35, hz: 0.14, hy: 0.1, earL: -0.05, earR: -0.1, wag: 0.5, wagHz: 2.2,
		shRx: -2.2, shRz: 0.65, elR: -0.7, waveAmp: 0.35, eyeOpen: 1, jaw: 0.35, tongue: 0.8, blush: 1.15, gemGlow: 0.3
	})
};

/* -------------------------------------------------------- renderer -- */
var VS = 'attribute vec3 p,n,c;uniform mat4 uVP,uM;varying vec3 vN,vC,vW;void main(){vec4 w=uM*vec4(p,1.);vW=w.xyz;vN=mat3(uM)*n;vC=c;gl_Position=uVP*w;}';
var FS = 'precision mediump float;varying vec3 vN,vC,vW;uniform vec3 uEye,uKey,uSky,uGnd,uRim;uniform float uEmit,uA,uShadow;' +
	'void main(){if(uShadow>.5){float d=length(vW.xz*vec2(1.,1.25));float a=smoothstep(1.,.15,d)*uA;gl_FragColor=vec4(0.,0.,0.,a);return;}' +
	'vec3 N=normalize(vN);vec3 V=normalize(uEye-vW);vec3 L=normalize(vec3(.55,.9,.7));' +
	'float d=max(dot(N,L),0.);vec3 h=mix(uGnd,uSky,N.y*.5+.5);float r=pow(1.-max(dot(N,V),0.),3.);' +
	'vec3 col=vC*(h*.74+uKey*d*.42)+uRim*r*.45;col=mix(col,vC*1.25,uEmit);gl_FragColor=vec4(col*uA,uA);}';

function create(canvas, opts) {
	opts = opts || {};
	var gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
	if (!gl) throw new Error('WebGL unavailable');
	var sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
	var prog = gl.createProgram();
	gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
	gl.useProgram(prog);
	var loc = {}; ['p', 'n', 'c'].forEach(function (a) { loc[a] = gl.getAttribLocation(prog, a); });
	['uVP', 'uM', 'uEye', 'uKey', 'uSky', 'uGnd', 'uRim', 'uEmit', 'uA', 'uShadow'].forEach(function (u) { loc[u] = gl.getUniformLocation(prog, u); });
	gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

	var model = build(opts.variant, opts.detail), tris = 0;
	// Everything goes into ONE interleaved vertex buffer (16 bytes per vertex) and is drawn
	// as ranges, so there is one bind per frame and the CPU-side arrays are dropped after upload.
	var pending = [], verts = 0;
	var upload = function (m) { var g = { first: verts, count: m.p.length / 3, m: m }; verts += g.count; pending.push(g); return g; };
	(function walk(n) { if (n.mesh) { n.gpu = upload(n.mesh); tris += n.gpu.count / 3; n.mesh = null; } n.W = new Float32Array(16); n.L = new Float32Array(16); n.kids.forEach(walk); })(model.root);
	var shadow = new Mesh(); for (var i = 0; i < 24; i++) { var a0 = i / 24 * 6.283, a1 = (i + 1) / 24 * 6.283; shadow.tri([0, 0.002, 0], [Math.cos(a1) * 1.1, 0.002, Math.sin(a1) * 1.1], [Math.cos(a0) * 1.1, 0.002, Math.sin(a0) * 1.1], [0, 0, 0]); }
	var shadowGpu = upload(shadow);
	var confettiGpu = [C.scarf, C.gold, C.ai, C.matcha, C.ai2].map(function (c) {
		return upload(new Mesh().tri([-0.05, -0.035, 0], [0.05, -0.035, 0], [0, 0.05, 0], c, [0, 0, -1]));
	});
	var STRIDE = 20; // xyz float32 (12) + normal int8 x3 (+1 pad) + colour uint8 x3 (+1 pad)
	var ab = new ArrayBuffer(verts * STRIDE), F = new Float32Array(ab), I8 = new Int8Array(ab), U8 = new Uint8Array(ab);
	pending.forEach(function (g) {
		var m = g.m;
		for (var v = 0; v < g.count; v++) {
			var b = (g.first + v) * STRIDE, o = b / 4;
			F[o] = m.p[v * 3]; F[o + 1] = m.p[v * 3 + 1]; F[o + 2] = m.p[v * 3 + 2];
			for (var q = 0; q < 3; q++) {
				I8[b + 12 + q] = Math.round(m.n[v * 3 + q] * 127);
				U8[b + 16 + q] = Math.round(Math.max(0, Math.min(1, m.c[v * 3 + q])) * 255);
			}
		}
		g.m = null;
	});
	pending = null;
	var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
	var gpuBytes = ab.byteLength; ab = F = I8 = U8 = null;
	gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, STRIDE, 0);
	gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.BYTE, true, STRIDE, 12);
	gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 3, gl.UNSIGNED_BYTE, true, STRIDE, 16);

	var facing = 0, nd = model.nodes, cur = {}, vel = {}, target = POSES.idle, poseName = 'idle';
	for (var k in BASE) { cur[k] = BASE[k]; vel[k] = 0; }
	var theme = opts.theme || 'light', reduced = !!opts.reducedMotion;
	var yaw = opts.yaw == null ? 0.42 : opts.yaw, pitch = opts.pitch == null ? 0.12 : opts.pitch, confetti = [], t0 = performance.now(), last = t0, raf = 0, poseT = 0;

	var LIGHT = { key: [1.0, 0.95, 0.88], sky: [1.0, 0.97, 0.94], gnd: [0.86, 0.79, 0.77], rim: [1, 0.93, 0.85], shadow: 0.16 };
	var DARK = { key: [0.98, 0.9, 0.85], sky: [0.82, 0.84, 1.0], gnd: [0.55, 0.52, 0.66], rim: [0.48, 0.58, 1.0], shadow: 0.42 };

	function setPose(name) {
		if (!POSES[name]) return;
		poseName = name; target = POSES[name]; poseT = 0;
		if (name === 'happy' && !reduced) burst();
		if (reduced) for (var k in target) { cur[k] = target[k]; vel[k] = 0; } if (reduced) cur.turn = facing;
		if (reduced) frame(performance.now());
	}
	function burst() {
		confetti = [];
		for (var i = 0; i < 34; i++) {
			var a = Math.random() * 6.283, s = 1.4 + Math.random() * 1.6;
			confetti.push({ p: [0, 2.0, 0.2], v: [Math.cos(a) * s * 0.7, 2.4 + Math.random() * 2.2, Math.sin(a) * s * 0.5 + 0.4], r: [Math.random() * 6, Math.random() * 6, 0], w: [6 * Math.random() - 3, 8 * Math.random() - 4, 0], c: i % 5, life: 0 });
		}
	}
	function step(dt) {
		var kk = 140, cc = 2 * Math.sqrt(kk) * 0.72;
		for (var k in target) {
			var x = cur[k], tg = k === 'turn' ? facing : target[k];
			if (k === 'wagHz' || k === 'breatheHz') { cur[k] = tg; continue; }
			vel[k] += (kk * (tg - x) - cc * vel[k]) * dt;
			cur[k] = x + vel[k] * dt;
		}
	}
	var walkPhase = 0, tailPhase = 0, breathPhase = 0, blinkAt = 2.5;
	function pose(t, dt) {
		var p = cur, R = reduced ? 0 : 1;
		tailPhase += dt * p.wagHz * 6.283; breathPhase += dt * p.breatheHz * 6.283;
		var breathe = Math.sin(breathPhase) * R;
		var bounce = p.bounce * Math.abs(Math.sin(t * 5.2)) * R;
		walkPhase += dt * p.walkHz * 6.283 * R;
		var st = Math.max(0, Math.min(1, p.stand)), sw1 = Math.sin(walkPhase) * p.stride * R, step = Math.abs(Math.cos(walkPhase)) * 0.05 * st * R;
		nd.root.t = [0, p.rootY + bounce + step, 0]; nd.root.r = [0, p.turn, 0];
		nd.torso.r = [p.lean, 0, p.torsoZ];
		nd.torso.t = [0, 0.42 - 0.17 * p.lie + 0.4 * st, -0.05 - 0.4 * p.lie - 0.3 * st];
		nd.torsoMesh.s = [1 + 0.012 * breathe, 1 + 0.018 * breathe, 1 + 0.012 * breathe];
		var sw = p.sway * R;
		nd.head.r = [p.hx - (p.lean - 0.3) + Math.sin(t * 0.8) * 0.03 * sw, p.hy + Math.sin(t * 0.5) * 0.06 * sw, p.hz + Math.sin(t * 0.65) * 0.04 * sw];
		nd.head.t = [0, 1.0 - 0.12 * p.lie, 0.12 + 0.02 * p.lie]; nd.head.s = [1.1, 1.1, 1.1];
		var twitch = R && poseName === 'idle' && (t % 7.3) < 0.18 ? 0.25 : 0;
		nd.earL.r = [-p.earL, 0, 0.28 + p.earOut + twitch]; nd.earR.r = [-p.earR, 0, -0.28 - p.earOut];
		nd.tail.r = [-p.tailLift, Math.sin(tailPhase) * p.wag * R, -0.3];
		nd.tail.t = [0.04, 0.48 - 0.2 * p.lie + 0.36 * st, -0.42 - 0.25 * p.lie - 0.35 * st];
		nd.haunchL.r = [0.15, -0.18, 0]; nd.haunchR.r = [0.15, 0.18, 0];
		nd.haunchL.t = [-0.27, 0.29 - 0.06 * p.lie + 0.42 * st, -0.13 - 0.35 * p.lie - 0.3 * st]; nd.haunchR.t = [0.27, 0.29 - 0.06 * p.lie + 0.42 * st, -0.13 - 0.35 * p.lie - 0.3 * st];
		var hs = st > 0.05 ? Math.min(1, st * 1.4) : 0.001;
		nd.hlegL.s = [hs, hs, hs]; nd.hlegR.s = [hs, hs, hs];
		nd.hlegL.r = [-0.15 - sw1, 0.18, 0]; nd.hlegR.r = [-0.15 + sw1, -0.18, 0];
		var fs = Math.max(0.001, 1 - st * 1.5); nd.hfootL.s = [fs, fs, fs]; nd.hfootR.s = [fs, fs, fs];
		var wave = p.waveAmp * Math.sin(t * 8) * R;
		nd.shL.r = [p.shLx - (p.lean - 0.3) + sw1, 0, p.shLz]; nd.elL.r = [p.elL, 0, 0];
		nd.shR.r = [p.shRx - (p.lean - 0.3) - sw1, 0, p.shRz + wave]; nd.elR.r = [p.elR, 0, wave * 0.6];
		// blink only when the eyes are fully open
		var blink = 1;
		if (R && p.eyeOpen > 0.8) { if (t > blinkAt) { blinkAt = t + 2.6 + Math.random() * 3; } if (blinkAt - t > 2.48 && blinkAt - t < 2.6) blink = 0.1; }
		var open = Math.max(0, Math.min(1, p.eyeOpen)) * blink, shut = 1 - Math.max(0, Math.min(1, p.eyeOpen));
		['L', 'R'].forEach(function (id, i) {
			var sd = i ? 1 : -1;
			nd['eye' + id].s = [1, Math.max(0.02, open), 1];
			nd['lid' + id].s = [shut, shut, shut];
			nd['lidA' + id].r = [0, 0, p.lidAngle]; nd['lidB' + id].r = [0, 0, -p.lidAngle];
			nd['brow' + id].t = [0.17 * sd, 0.51 + p.browY, 0.44];
			nd['brow' + id].r = [-0.2, 0.3 * sd, p.browTilt * -sd];
			var bb = Math.max(0, p.blush); nd['blush' + id].s = [bb, bb, bb];
		});
		nd.jaw.r = [Math.max(0, p.jaw) * 0.9, 0, 0];
		var tg = Math.max(0, Math.min(1, p.tongue)); nd.tongue.s = [tg, tg, tg];
		var glow = p.gemGlow + (R ? 0.2 * Math.sin(t * 4) * Math.min(1, p.orbs) : 0);
		nd.gem.emit = Math.max(0, glow); nd.gem.r = [0, t * 0.8 * R, 0];
		for (var i = 0; i < 3; i++) {
			var o = nd['orb' + i], ob = Math.max(0, p.orbs);
			var hop = R ? Math.max(0, Math.sin(t * 5 - i * 0.9)) * 0.1 : 0;
			o.t = [0.52 + i * 0.21, 2.22 + i * 0.07 + hop, 0.25];
			o.s = [ob, ob, ob]; o.r = [0, t * 1.5 * R + i, 0]; o.emit = 0.55;
			var z = nd['z' + i], ph = R ? ((t * 0.35 + i / 3) % 1) : 0.25 + i * 0.25, zz = Math.max(0, p.zzz);
			z.t = [0.45 + ph * 0.5, 1.25 + ph * 0.9, 0.55]; z.r = [0, yaw - p.turn, Math.sin(ph * 6) * 0.15];
			var zs = zz * Math.sin(Math.PI * Math.min(1, ph * 1.2)) * (0.7 + ph * 0.5); z.s = [zs, zs, zs]; z.emit = 0.45;
		}
	}

	function resize() {
		var dpr = Math.min(2, window.devicePixelRatio || 1);
		var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
		if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
		gl.viewport(0, 0, w, h);
		return w / Math.max(1, h);
	}
	var drawCalls = 0;
	function draw(g, M, emit, alpha) {
		drawCalls++; gl.uniformMatrix4fv(loc.uM, false, M); gl.uniform1f(loc.uEmit, emit || 0); gl.uniform1f(loc.uA, alpha == null ? 1 : alpha);
		gl.drawArrays(gl.TRIANGLES, g.first, g.count);
	}
	var P_ = new Float32Array(16), V_ = new Float32Array(16), VP = new Float32Array(16), S_ = new Float32Array(16), ID = trs([0, 0, 0], [0, 0, 0], [1, 1, 1]);
	var minGap = opts.fps ? 1000 / opts.fps - 2 : 0, lastDraw = 0, frameMs = 0;
	function frame(now) {
		if (minGap && now - lastDraw < minGap && !reduced) { raf = requestAnimationFrame(frame); return; }
		lastDraw = now; var c0 = performance.now(); drawCalls = 0;
		var dt = Math.min(0.05, (now - last) / 1000); last = now;
		var t = (now - t0) / 1000; poseT += dt;
		if (!reduced) { var n = 3; for (var i = 0; i < n; i++) step(dt / n); }
		pose(t, dt);
		var asp = resize(), L = theme === 'dark' ? DARK : LIGHT;
		var dist = opts.distance || 6.4, tgt = opts.target || [0, 1.08, 0];
		var eye = [tgt[0] + Math.sin(yaw) * Math.cos(pitch) * dist, tgt[1] + Math.sin(pitch) * dist, tgt[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
		mul(persp(opts.fov || 0.5, asp, 0.1, 50), lookAt(eye, tgt), VP);
		gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(loc.uVP, false, VP); gl.uniform3fv(loc.uEye, eye);
		gl.uniform3fv(loc.uKey, L.key); gl.uniform3fv(loc.uSky, L.sky); gl.uniform3fv(loc.uGnd, L.gnd); gl.uniform3fv(loc.uRim, L.rim);
		// shadow first, without depth writes
		gl.depthMask(false); gl.uniform1f(loc.uShadow, 1);
		var sb = 1 - Math.min(0.35, cur.bounce * Math.abs(Math.sin(t * 5.2)) * (reduced ? 0 : 1) * 2);
		draw(shadowGpu, trs([0, 0, 0.05 + 0.25 * cur.lie], [0, 0, 0], [0.95 * sb + 0.1 * cur.lie, 1, 0.95 * sb + 0.25 * cur.lie], S_), 0, L.shadow);
		gl.depthMask(true); gl.uniform1f(loc.uShadow, 0);
		(function walk(n, M) {
			// a part scaled to nothing is skipped along with everything under it
			if (n.s[0] < 0.01 || n.s[1] < 0.01) return;
			var W = mul(M, trs(n.t, n.r, n.s, n.L), n.W);
			if (n.gpu) draw(n.gpu, W, n.emit);
			for (var i = 0; i < n.kids.length; i++) walk(n.kids[i], W);
		})(model.root, ID);
		// confetti
		confetti = confetti.filter(function (c) {
			c.life += dt; if (c.life > 2.2) return false;
			c.v[1] -= 6.5 * dt; c.v = scl(c.v, 1 - 1.2 * dt); c.p = add(c.p, scl(c.v, dt)); c.r = add(c.r, scl(c.w, dt));
			var s = Math.min(1, (2.2 - c.life) * 2);
			draw(confettiGpu[c.c], trs(c.p, c.r, [s, s, s], S_), 0.25);
			return c.p[1] > -0.2;
		});
		frameMs = frameMs * 0.9 + (performance.now() - c0) * 0.1;
		if ((!reduced || confetti.length) && !paused && !hidden) raf = requestAnimationFrame(frame); else raf = 0;
	}
	function kick() { if (!raf && !paused && !hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
	kick();

	// drag to turn
	var paused = false, hidden = document.hidden;
	// stop drawing while the tab is in the background
	var onVis = function () { hidden = document.hidden; if (!hidden) kick(); };
	document.addEventListener('visibilitychange', onVis);
	var drag = null;
	if (opts.orbit !== false) canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch }; canvas.setPointerCapture(e.pointerId); });
	canvas.addEventListener('pointermove', function (e) {
		if (!drag) return;
		yaw = drag.yaw - (e.clientX - drag.x) * 0.01;
		pitch = Math.max(-0.1, Math.min(0.7, drag.pitch + (e.clientY - drag.y) * 0.006));
		if (reduced) frame(performance.now());
	});
	var end = function () { drag = null; };
	canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

	return {
		setPose: setPose,
		setFacing: function (a) { facing = a; if (reduced) { cur.turn = a; frame(performance.now()); } },
		get pose() { return poseName; },
		setTheme: function (t) { theme = t; if (reduced) frame(performance.now()); },
		setReducedMotion: function (r) { reduced = r; if (r) { for (var k in target) { cur[k] = target[k]; vel[k] = 0; } cur.turn = facing; frame(performance.now()); } else kick(); },
		setPaused: function (b) { paused = b; if (!b) kick(); },
		setView: function (y, p) { yaw = y; if (p != null) pitch = p; if (reduced) frame(performance.now()); },
		destroy: function () { cancelAnimationFrame(raf); raf = 0; paused = true; document.removeEventListener('visibilitychange', onVis); gl.deleteBuffer(vbo); gl.deleteProgram(prog); var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); },
		stats: { triangles: tris, gpuBytes: gpuBytes, get drawCalls() { return drawCalls; }, get frameMs() { return frameMs; } }
	};
}

export const poses = Object.keys(POSES);
export { create };
