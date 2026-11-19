// @ts-nocheck: hand-drawn SVG art ported from the Coreva Friendly style (loose numbers and paths).
// The typed surface is ../person.ts and ../render.ts; pack.test.ts draws every part.
/**
 * Benkyo's avatar style pack for @antronic/coreva-render 0.6 (style id 'benkyo-v1').
 *
 * Coreva's 96 x 96 Friendly layout, with Benkyo's palette (shu, ai, sumire, matcha), ten skin
 * tones, blonde and red hair, sixteen hairstyles, beards, three head shapes, and hats and head
 * coverings that each say which hair they hide. svg() is the still image and the no-GPU fallback;
 * layers() are the same drawing split for the 2.5D engine; rig() puts the face (blinks,
 * expressions) and the waving arm on Coreva's joints, the way Coreva's own style does.
 *
 * Bump the id when the art changes: it is part of every cached wave's key. docs/AVATAR.md.
 */
import { defineStyle } from '@antronic/coreva-render/style';
import { SKIN, HAIRC, CLOTH, COLLAR, HEADC, FRAMEC, HATS, OPTIONS, DEFAULTS as PERSON_DEFAULTS, FIXED } from '../person.ts';

export const DEFAULTS = { ...PERSON_DEFAULTS, ...FIXED };

/* ---------- colour helpers (as Coreva's) ---------- */
function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function th(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function mix(a, b, t) { var A = hx(a), B = hx(b); return th([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * t; })); }
function dk(c, t) { return mix(c, '#000000', t == null ? .22 : t); }
function lt(c, t) { return mix(c, '#ffffff', t == null ? .7 : t); }
// an unknown id falls back to the default part instead of drawing nothing
function pick(map, k, d) { return map[k] || map[d]; }
function norm(st) {
	var o = Object.assign({}, DEFAULTS, st);
	['hair', 'headShape', 'beard', 'eyes', 'brows', 'mouth', 'glasses', 'outfit'].forEach(function (k) { if (OPTIONS[k].indexOf(o[k]) < 0) o[k] = DEFAULTS[k]; });
	if (!HATS[o.head]) o.head = 'none';
	return o;
}
function browColor(st) { var h = pick(HAIRC, st.hairColor, 'brown'); return st.head === 'hijab' || st.head === 'turban' ? '#3a2a26' : (['grey', 'ash', 'platinum', 'blonde'].indexOf(st.hairColor) >= 0 ? dk(h, .35) : h); }

/* ---------- parts ---------- */
var HEADS = {
	round: 'M28 36a20 20 0 0 1 40 0v9c0 11-9 18-20 18s-20-7-20-18Z',
	oval: 'M29 34a19 19 0 0 1 38 0v11c0 12-8 20-19 20s-19-8-19-20Z',
	square: 'M28 36a20 20 0 0 1 40 0v11c0 8-6 14-12 15.5-5 1-11 1-16 0C34 61 28 55 28 47Z'
};
var BANGS = 'M28 37c2-11 10-17 20-17s18 6 20 17c-7-3-15-5-21-10-3 5-11 9-19 10Z';
var DOME = 'M27.5 40C26 22 37 14 48 14s22 8 20.5 26c-5-8-12-12-20.5-12S32.5 32 27.5 40Z';
var CAPBACK = 'M26 42C25 21 36 13 48 13s23 8 22 29Z';
// each hairstyle: back (behind the head), top (bun, tie), front (fringe, over the forehead)
var HAIR = {
	short: { front: 'M27.5 40C26 23 36 14 48 14s22 9 20.5 26c-4-7-10-10-14-10-6 3-14 4-22 3-2 2-4 4-5 7Z' },
	swept: { front: 'M27 42C24 24 34 13 48 13c5-3 11-3 14 0-1 1-1 2-1 3 7 4 10 13 8 26-2-6-5-10-8-12-9 4-21 5-30 3-2 3-3 6-4 9Z' },
	undercut: { back: '<path d="M28.2 44a20 20 0 0 1 2-16l2 15ZM67.8 44a20 20 0 0 0-2-16l-2 15Z" fill-opacity=".55"/>', front: 'M29 33C29 18 39 11 50 11c10 0 19 6 19 17-4 6-15 9-28 8-5 0-9-1-12-3Z' },
	buzz: { front: 'M28.2 34a20 20 0 0 1 39.6 0c-6-4-13-5.5-19.8-5.5S34.2 30 28.2 34Z' },
	sides: { front: 'M27.5 44c-1-9 1-15 5-17 0 6 0 11-1 16ZM68.5 44c1-9-1-15-5-17 0 6 0 11 1 16Z' },
	mohawk: { back: '<path d="M28.2 40a20 20 0 0 1 6-14c-1 5-1 9 0 12ZM67.8 40a20 20 0 0 0-6-14c1 5 1 9 0 12Z" fill-opacity=".45"/>', front: 'M42.5 33c-1.5-9 .5-19 5.5-27 5 8 7 18 5.5 27-3.6-.8-7.4-.8-11 0Z' },
	bob: { back: '<path d="M25 42C24 20 36 13 48 13s24 7 23 29v16c0 3-4 4-6 2V44H31v16c-2 2-6 1-6-2Z"/>', front: BANGS },
	long: { back: '<path d="M25 42C24 20 36 13 48 13s24 7 23 29v32c0 3-4 4-6 2V44H31v30c-2 2-6 1-6-2Z"/>', front: BANGS },
	wavy: { back: '<path d="M25 42C24 20 36 13 48 13s24 7 23 29c2 6-2 10 0 16s-2 10 0 14c-2 3-5 3-6 1V44H31v28c-1 2-4 2-6-1 2-4-2-8 0-14s-2-10 0-15Z"/>', front: 'M28 38c2-12 10-18 20-18s18 6 20 18c-4-4-8-6-12-5-3-4-8-4-11 0-4-2-10 0-17 5Z' },
	bun: { top: '<circle cx="48" cy="12" r="7"/>', front: DOME },
	ponytail: { back: '<path d="M62 20c11 1 16 11 14 25-1 8-4 13-9 16 2-9 2-17-1-26Z"/>', top: '<circle cx="64" cy="21" r="3.2"/>', front: DOME },
	pigtails: { back: '<circle cx="23" cy="36" r="6.5"/><circle cx="73" cy="36" r="6.5"/>', front: 'M27.5 39C27 22 37 15 48 15s21 7 20.5 24c-3-4-7-7-10-7l-2 4-3-5c-6 0-12 2-20 8Z' },
	braids: { back: '<path d="' + CAPBACK + '"/>' + [26, 70].map(function (x) { var s = ''; for (var y = 46; y <= 78; y += 6.5) s += '<ellipse cx="' + x + '" cy="' + y + '" rx="3.6" ry="4"/>'; return s; }).join(''), front: 'M28 38c1-12 9-19 20-19s19 7 20 19c-6-6-12-9-19-9l-1-3-1 3c-7 0-13 3-19 9Z' },
	curly: { back: '<circle cx="27" cy="38" r="6"/><circle cx="69" cy="38" r="6"/>', front: 'M27 38a7 7 0 0 1 3-11 8 8 0 0 1 9-10 9 9 0 0 1 18 0 8 8 0 0 1 9 10 7 7 0 0 1 3 11c-6-5-13-7-21-7s-15 2-21 7Z' },
	afro: { back: [[48, 30, 22], [48, 13, 12], [32, 18, 11], [64, 18, 11], [24, 32, 10], [72, 32, 10], [25, 46, 8], [71, 46, 8]].map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '"/>'; }).join(''), front: 'M28 38c-1-12 7-20 20-20s21 8 20 20c-5-5-12-7-20-7s-15 2-20 7Z' },
	locs: { back: '<path d="' + CAPBACK + '"/>' + [24, 29.5, 35, 61, 66.5, 72].map(function (x) { return '<rect x="' + (x - 2.4) + '" y="30" width="4.8" height="' + (x < 30 || x > 70 ? 42 : 48) + '" rx="2.4"/>'; }).join(''), front: 'M28 37c2-11 10-17 20-17s18 6 20 17c-6-4-13-6-20-6s-14 2-20 6Z' }
};
var BEARDS = {
	full: 'M28.5 47c1 11 9 18 19.5 18s18.5-7 19.5-18c-2 4-4.5 6.5-7.5 7.5-3-3-7-4-12-4s-9 1-12 4c-3-1-5.5-3.5-7.5-7.5Z',
	moustache: 'M40.5 51.5c2-3 5-3.5 7.5-1.5 2.5-2 5.5-1.5 7.5 1.5-2.5-.6-5-.4-7.5.5-2.5-.9-5-1.1-7.5-.5Z',
	goatee: 'M42 58.5c2 1 4 1.5 6 1.5s4-.5 6-1.5c0 4-2 6.5-6 6.5s-6-2.5-6-6.5Z'
};

/* ---------- the SVG (still image, fallback, and the source of the layers) ---------- */
var uid = 0;
function render(st0, size) {
	var st = norm(st0), id = 'b' + (uid++);
	var sk = pick(SKIN, st.skin, 's4'), hair = pick(HAIRC, st.hairColor, 'brown'), cloth = pick(CLOTH, st.cloth, 'ai'), collar = pick(COLLAR, st.collar, 'navy'), hc = pick(HEADC, st.headColor, 'ai'), fc = pick(FRAMEC, st.frameColor, 'shu');
	var FR = st.shape === 'circle' ? 48 : 28, shade = st.shade === 'on', glass = st.frame === 'glass';
	var hat = st.head, hides = HATS[hat].hides, hijab = hat === 'hijab', ey = 45.5;
	var oy = st.headShape === 'oval' ? 1.5 : 0;   // the oval face sits a little lower at the chin
	function shp(tag, attrs, fill) { return '<' + tag + ' ' + attrs + ' fill="' + fill + '"/>' + (shade ? '<' + tag + ' ' + attrs + ' fill="url(#sh' + id + ')"/>' : ''); }
	function hairG(inner) { return '<g fill="' + hair + '">' + inner + '</g>' + (shade ? '<g fill="url(#sh' + id + ')">' + inner + '</g>' : ''); }
	var defs = '<defs>' +
		'<radialGradient id="sh' + id + '" cx=".32" cy=".22" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>' +
		'<linearGradient id="gl' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient>' +
		'<radialGradient id="gw' + id + '" cx=".5" cy="1.15" r=".75"><stop offset="0" stop-color="' + fc + '" stop-opacity=".75"/><stop offset="1" stop-color="' + fc + '" stop-opacity="0"/></radialGradient>' +
		'<clipPath id="cl' + id + '"><rect x="0" y="0" width="96" height="96" rx="' + FR + '"/></clipPath></defs>';
	var g = '';
	if (st.frame === 'solid') g += '<rect x="0" y="0" width="96" height="96" rx="' + FR + '" fill="' + lt(fc, .72) + '"/>' + (shade ? '<rect x="0" y="0" width="96" height="96" rx="' + FR + '" fill="url(#gl' + id + ')" opacity=".6"/>' : '');
	if (glass) g += '<rect x="0" y="0" width="96" height="96" rx="' + FR + '" fill="#ffffff" fill-opacity=".16"/><rect x="0" y="0" width="96" height="96" rx="' + FR + '" fill="url(#gw' + id + ')"/>';
	var p = '';
	// body
	var bodyD = 'M8 98C10 80 25 72 48 72s38 8 40 26Z', shadowD = 'M8 98C10 80 25 72 41 72.3 30 78 25 88 25 98Z';
	var bodyFill = st.outfit === 'coat' ? CLOTH.white : cloth;
	p += '<path d="' + bodyD + '" fill="' + bodyFill + '"' + (glass ? ' fill-opacity=".62"' : '') + '/>';
	if (shade) p += '<path d="' + bodyD + '" fill="url(#sh' + id + ')"/>';
	p += '<path d="' + shadowD + '" fill="' + dk(bodyFill, .28) + '"' + (glass ? ' fill-opacity=".5"' : '') + '/>';
	if (hides.indexOf('neck') < 0) { p += '<rect x="40" y="56" width="16" height="18" rx="3" fill="' + sk + '"/><path d="M40 58h16v4c-7 1-12 5-16 11Z" fill="' + dk(sk, .2) + '"/>'; }
	if (st.outfit === 'crew' && !hijab) p += '<path d="M37 72.6A11 7.5 0 0 0 59 72.6Z" fill="' + sk + '"/><path d="M37 72.6A11 7.5 0 0 0 59 72.6" fill="none" stroke="' + collar + '" stroke-width="4" stroke-linecap="round"/>';
	if (st.outfit === 'scrubs') { if (!hijab) p += '<path d="M39 72.4l9 11 9-11" fill="' + sk + '"/><path d="M39 72.4l9 11 9-11" fill="none" stroke="' + dk(cloth, .3) + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'; p += '<path d="M60 86h9" stroke="' + dk(cloth, .3) + '" stroke-width="2" stroke-linecap="round"/>'; }
	if (st.outfit === 'coat') p += '<path d="M40 72.4l8 12 8-12Z" fill="' + collar + '"/><path d="M37 73l11 15 11-15M48 88v10" fill="none" stroke="' + dk(CLOTH.white, .25) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
	if (st.outfit === 'polo') p += '<path d="M38 72.4l10 7 10-7" fill="none" stroke="' + collar + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M48 79v8" stroke="' + dk(cloth, .3) + '" stroke-width="2" stroke-linecap="round"/><circle cx="48" cy="83" r="1" fill="' + dk(cloth, .4) + '"/>';
	// head: back hair, ears, face skin, beard (all in the 'head' layer)
	p += '<g class="hd">';
	var H = HAIR[st.hair];
	if (!hijab) {
		var back = (hides.indexOf('back') < 0 ? H.back || '' : '') + (hides.indexOf('top') < 0 ? H.top || '' : '');
		if (back) p += hairG(back);
		if (hat === 'headscarf') p += '<path d="M66 33l11 4-2 5-9-3ZM66 35l7 10-4 2-5-9Z" fill="' + dk(hc, .12) + '"/>';
		p += shp('ellipse', 'cx="27" cy="46" rx="5" ry="6"', sk) + shp('ellipse', 'cx="69" cy="46" rx="5" ry="6"', sk);
		p += '<ellipse cx="27.5" cy="46.5" rx="2" ry="2.8" fill="' + dk(sk, .15) + '"/><ellipse cx="68.5" cy="46.5" rx="2" ry="2.8" fill="' + dk(sk, .15) + '"/>';
		if (st.earrings === 'on') p += '<circle cx="27" cy="53.5" r="1.8" fill="#e0b44a"/><circle cx="69" cy="53.5" r="1.8" fill="#e0b44a"/>';
		p += shp('path', 'd="' + HEADS[st.headShape] + '"', sk);
		if (shade) p += '<ellipse cx="41" cy="27" rx="6" ry="3" fill="#fff" fill-opacity=".22"/>';
	} else {
		var hjD = 'M48 13c-13 0-22 11-22 29 0 9-3 17-8 24-3 5-5 10-5 16 9 5 21 8 35 8s26-3 35-8c0-6-2-11-5-16-5-7-8-15-8-24 0-18-9-29-22-29Z';
		p += shp('path', 'd="' + hjD + '"', hc);
		p += '<path d="M31 68q17 9 34 0M26 75q22 11 44 0M30 82q18 8 36 0" fill="none" stroke="' + dk(hc, .28) + '" stroke-width="1.3" stroke-linecap="round" stroke-opacity=".75"/>';
		p += '<path d="M35 55c2 10 7 15 13 15s11-5 13-15c-3 6-7 9-13 9s-10-3-13-9Z" fill="' + dk(hc, .25) + '"/>';
		p += shp('ellipse', 'cx="48" cy="45" rx="14.5" ry="17"', sk);
		p += '<path d="M33.6 40c1.5-10 7-15.5 14.4-15.5S60.9 30 62.4 40c-4-5-8.5-7.5-14.4-7.5S37.6 35 33.6 40Z" fill="#f4f1ee"/>';
	}
	if (st.beard !== 'none') {
		var bd = st.beard === 'stubble' ? BEARDS.full : BEARDS[st.beard], bo = st.beard === 'stubble' ? ' fill-opacity=".26"' : '';
		p += '<path d="' + bd + '" fill="' + hair + '"' + bo + (oy ? ' transform="translate(0 ' + oy + ')"' : '') + '/>';
		if (st.beard === 'full') p += '<path d="' + BEARDS.moustache + '" fill="' + hair + '"/>';
	}
	// face: drawn here for the still; the 2.5D rig draws it as blend shapes instead
	var bc = browColor(st);
	p += '<g class="fc">';
	if (st.face === 'on') {
		if (st.blush === 'on') p += '<ellipse cx="36" cy="' + (ey + 6) + '" rx="3.4" ry="2.2" fill="#f08aa0" fill-opacity=".45"/><ellipse cx="60" cy="' + (ey + 6) + '" rx="3.4" ry="2.2" fill="#f08aa0" fill-opacity=".45"/>';
		var E = '#4f5266';
		if (st.eyes === 'oval') p += '<ellipse cx="41" cy="' + ey + '" rx="2.3" ry="3.1" fill="' + E + '"/><ellipse cx="55" cy="' + ey + '" rx="2.3" ry="3.1" fill="' + E + '"/>';
		if (st.eyes === 'dot') p += '<circle cx="41" cy="' + ey + '" r="2" fill="' + E + '"/><circle cx="55" cy="' + ey + '" r="2" fill="' + E + '"/>';
		if (st.eyes === 'happy') p += '<path d="M38.5 ' + (ey + 1) + 'q2.5-3.2 5 0M52.5 ' + (ey + 1) + 'q2.5-3.2 5 0" fill="none" stroke="' + E + '" stroke-width="2.2" stroke-linecap="round"/>';
		if (st.brows === 'bar') p += '<path d="M36.8 ' + (ey - 6.5) + 'l7.6-.9M51.6 ' + (ey - 7.4) + 'l7.6.9" stroke="' + bc + '" stroke-width="2.6"/>';
		if (st.brows === 'thick') p += '<path d="M36.6 ' + (ey - 6.3) + 'l8-1M51.4 ' + (ey - 7.3) + 'l8 1" stroke="' + bc + '" stroke-width="3.6" stroke-linecap="round"/>';
		if (st.brows === 'arch') p += '<path d="M37 ' + (ey - 5.8) + 'q3.8-2.6 7.6-.6M51.4 ' + (ey - 6.4) + 'q3.8-2 7.6.6" fill="none" stroke="' + bc + '" stroke-width="2" stroke-linecap="round"/>';
		var m = ey + 5.5;
		if (st.mouth === 'grin') p += '<path d="M41.5 ' + m + 'h13a6.5 6 0 0 1-13 0Z" fill="#ffffff"/>';
		if (st.mouth === 'smile') p += '<path d="M43 ' + (m + .5) + 'q5 4.2 10 0" fill="none" stroke="#6b3530" stroke-width="2" stroke-linecap="round"/>';
		if (st.mouth === 'calm') p += '<path d="M44.5 ' + (m + 1.5) + 'h7" fill="none" stroke="#6b3530" stroke-width="2" stroke-linecap="round"/>';
		if (st.mouth === 'wow') p += '<ellipse cx="48" cy="' + (m + 2) + '" rx="2.3" ry="2.9" fill="#6b3530"/>';
		if (st.mouth === 'concern') p += '<path d="M43.5 ' + (m + 3) + 'q4.5-3 9 0" fill="none" stroke="#6b3530" stroke-width="2" stroke-linecap="round"/>';
	}
	// head top: front hair, hats, glasses, hearing aid (the 'headTop' layer)
	p += '</g><g class="ht">';
	if (!hijab && hides.indexOf('front') < 0 && H.front) p += '<path d="' + H.front + '" fill="' + hair + '"/>' + (shade ? '<path d="' + H.front + '" fill="url(#sh' + id + ')"/>' : '');
	if (hat === 'cap') { p += shp('path', 'd="M26 38C26 19 37 12 48 12s22 7 22 26c-6-3-13-5-22-5s-16 2-22 5Z"', hc); p += '<path d="M30 31q18-5 36 0" fill="none" stroke="' + dk(hc, .3) + '" stroke-width="1.4" stroke-opacity=".6"/>'; }
	if (hat === 'beanie') { p += shp('path', 'd="M26 37C25 20 36 11 48 11s23 9 22 26Z"', hc); p += '<rect x="25" y="30" width="46" height="8.5" rx="4.2" fill="' + dk(hc, .14) + '"/><path d="M31 31v6M36 30.5v7M41 30.2v7.4M46 30v7.6M51 30v7.6M56 30.2v7.4M61 30.5v7M66 31v6" stroke="' + dk(hc, .3) + '" stroke-width="1" stroke-opacity=".45"/><circle cx="48" cy="10" r="4.6" fill="' + lt(hc, .35) + '"/>'; }
	if (hat === 'turban') { p += shp('path', 'd="M25 40C22 22 34 10 48 10s26 12 23 30c-6-6-14-9-23-9s-17 3-23 9Z"', hc); p += '<path d="M29 33q19-15 38 0M33 24q15-9 30 0M44 31q4-9 9-17" fill="none" stroke="' + dk(hc, .28) + '" stroke-width="1.4" stroke-linecap="round" stroke-opacity=".7"/>'; }
	if (hat === 'headscarf') { p += shp('path', 'd="M27 36C27 21 37 13 48 13s21 8 21 23c-6-3-13-4.5-21-4.5S33 33 27 36Z"', hc); p += '<path d="M31 30q17-6 34 0" fill="none" stroke="' + dk(hc, .3) + '" stroke-width="1.2" stroke-opacity=".5"/>'; }
	if (hat === 'bucket') { p += shp('path', 'd="M31 31c0-12 7-19 17-19s17 7 17 19Z"', hc); p += shp('path', 'd="M19 35c4-5 15-7.5 29-7.5s25 2.5 29 7.5c-6 1.2-16 1.8-29 1.8S25 36.2 19 35Z"', dk(hc, .1)); }
	if (st.glasses !== 'none') {
		var gc = '#2f2b2a';
		if (st.glasses === 'round') p += '<g fill="none" stroke="' + gc + '" stroke-width="1.8"><circle cx="41" cy="' + ey + '" r="5.4"/><circle cx="55" cy="' + ey + '" r="5.4"/><path d="M46.4 ' + ey + 'h3.2"/></g>';
		else p += '<g fill="none" stroke="' + gc + '" stroke-width="1.8" stroke-linejoin="round"><rect x="35" y="' + (ey - 4.2) + '" width="11.5" height="8.6" rx="2.4"/><rect x="49.5" y="' + (ey - 4.2) + '" width="11.5" height="8.6" rx="2.4"/><path d="M46.5 ' + ey + 'h3"/></g>';
		p += '<path d="M36 ' + (ey - 3) + 'l2 -1.2M50.5 ' + (ey - 3) + 'l2 -1.2" stroke="#fff" stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round"/>';
	}
	if (st.aid === 'on' && !hijab) p += '<path d="M71 42q4.2 2.5 1.6 8.2" fill="none" stroke="' + fc + '" stroke-width="2.6" stroke-linecap="round"/>';
	p += '</g></g>';
	if (st.badge === 'on' && !hijab) p += '<rect x="58" y="80" width="13" height="9" rx="2" fill="#ffffff"/><rect x="58" y="80" width="13" height="3" rx="1.5" fill="' + fc + '"/>';
	p = '<g class="ps">' + p + '</g>';
	g += (st.frame === 'none' ? p : '<g clip-path="url(#cl' + id + ')">' + p + '</g>');
	if (st.frame !== 'none' && glass) g += '<g class="ov"><rect x="0" y="0" width="96" height="96" rx="' + FR + '" fill="url(#gl' + id + ')" opacity=".55"/><rect x=".5" y=".5" width="95" height="95" rx="' + (FR - .5) + '" fill="none" stroke="#fff" stroke-opacity=".55"/></g>';
	return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"' + (size ? ' width="' + size + '" height="' + size + '"' : '') + ' role="img" aria-label="Avatar">' + defs + g + '</svg>';
}

/* ---------- layers: the same SVG split for the engine (as Coreva's layerArt) ---------- */
function layers(st) {
	var svg = new DOMParser().parseFromString(render(st, 96), 'image/svg+xml').documentElement;
	function only(keep) {
		var c = svg.cloneNode(true);
		Array.prototype.slice.call(c.children).forEach(function (n) {
			if (n.tagName === 'defs') return;
			var hasPs = n.classList.contains('ps') || !!n.querySelector('.ps'), isOv = n.classList.contains('ov');
			if (keep === 'frame') { if (hasPs || isOv) c.removeChild(n); return; }
			if (keep === 'over') { if (!isOv) c.removeChild(n); return; }
			if (!hasPs) c.removeChild(n);
		});
		var ps = c.querySelector('.ps');
		if (ps && ps.parentNode && ps.parentNode.getAttribute && ps.parentNode.getAttribute('clip-path')) ps.parentNode.removeAttribute('clip-path');
		if (ps && keep !== 'frame' && keep !== 'over') {
			var hd = ps.querySelector('.hd');
			if (keep === 'body') { if (hd) hd.parentNode.removeChild(hd); }
			else {
				Array.prototype.slice.call(ps.children).forEach(function (n) { if (n !== hd) ps.removeChild(n); });
				if (hd) {
					var f = hd.querySelector('.fc'), t = hd.querySelector('.ht');
					if (f) f.parentNode.removeChild(f);
					if (keep === 'head') { if (t) t.parentNode.removeChild(t); }
					else Array.prototype.slice.call(hd.children).forEach(function (n) { if (n !== t) hd.removeChild(n); });
				}
			}
		}
		return new XMLSerializer().serializeToString(c);
	}
	var fm = norm(st).frame !== 'none' ? 'frame' : null;
	return [
		{ name: 'frame', art: only('frame'), depth: -.4, receive: true, crop: false },
		{ name: 'body', art: only('body'), depth: 0, cast: true, receive: true, mask: fm },
		{ name: 'head', art: only('head'), depth: .12, cast: true, mask: fm },
		{ name: 'headTop', art: only('headTop'), depth: .125, mask: fm },
		{ name: 'over', art: only('over'), depth: .3, lit: false }
	];
}

/* ---------- rig: Coreva's joints, face blend shapes and waving arm ----------
 * Copied from coreva-avatar.js 0.6.1 (rigDef, buildFace, buildArm, flatMat, buildFlatRig), with Benkyo's
 * palettes. Remove this block when the engine exports it (docs/AVATAR.md, "Asks for Coreva Render"). */
function qpts(x0, y0, cx, cy, x1, y1, n) { var p = []; n = n || 12; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; p.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); } return p; }
var RIGJ = (function () {
	var j = { hips: [48, 150, 0], spine: [48, 118, 0], chest: [48, 86, 0], neck: [48, 68, 0], head: [48, 60, 0], eyes: [48, 45.5, 0], jaw: [48, 56, 0] };
	[['L', 1], ['R', -1]].forEach(function (q) {
		var s = q[0], k = q[1], X = function (x) { return 48 + k * (x - 48); };
		j['shoulder' + s] = [X(60), 76, 0]; j['upperArm' + s] = [X(70), 84, 0]; j['lowerArm' + s] = [X(75), 107, 0]; j['hand' + s] = [X(77), 130, 0];
		var HS = 1.55, H = function (x, y) { return [77 + (x - 79) * HS, 130 + (y - 130) * HS]; };
		var F = { index: [82.5, 138, 7], middle: [79.8, 138.4, 7.8], ring: [77.1, 138, 7.2], little: [74.6, 137.2, 5.8] };
		Object.keys(F).forEach(function (f) { var b = H(F[f][0], F[f][1]), x = b[0], y = b[1], L = F[f][2] * HS; j[f + '1' + s] = [X(x), y, 0]; j[f + '2' + s] = [X(x), y + L * .42, 0]; j[f + '3' + s] = [X(x), y + L * .74, 0]; j[f + 'Tip' + s] = [X(x), y + L, 0]; });
		var tb = H(83.5, 132.5), tx = tb[0], ty = tb[1], d = [.74 * HS, .67 * HS];
		j['thumb1' + s] = [X(tx), ty, 0]; j['thumb2' + s] = [X(tx + d[0] * 2.6), ty + d[1] * 2.6, 0]; j['thumb3' + s] = [X(tx + d[0] * 4.7), ty + d[1] * 4.7, 0]; j['thumbTip' + s] = [X(tx + d[0] * 6.4), ty + d[1] * 6.4, 0];
		j['upperLeg' + s] = [X(56), 150, 0]; j['lowerLeg' + s] = [X(57), 200, 0]; j['foot' + s] = [X(57), 246, 0]; j['toes' + s] = [X(57), 252, 7];
	});
	return j;
})();
var EXPR = { calm: {}, smile: { smile: 1, cheek: .3 }, grin: { grin: 1, cheek: .4, browUp: .15 }, wow: { wow: 1, browUp: 1, wide: 1 }, concern: { concern: 1, browInner: 1 } };
function rigDef(mode, clips) {
	var joints = {}, k; for (k in RIGJ) if (k.indexOf('Tip') < 0) joints[k] = RIGJ[k];
	return {
		joints: joints, map: function (x, y, z) { return [x - 48, 48 - y, z || 0]; }, mode: mode,
		channels: ['smile', 'grin', 'wow', 'concern', 'open', 'blinkL', 'blinkR', 'squint', 'wide', 'browUp', 'browInner', 'cheek'],
		expressions: EXPR, flatShift: { spine: [24, 0], neck: [3.6, 5.5], head: [3.6, 5.5] },
		look: { eyes: 'eyes', chain: [['neck', .4], ['head', .6]], yaw: .5, pitch: .2, roll: .06, eyeShift: [1.6, 1.2], eyeLead: [.6, .4] },
		blink: { channels: ['blinkL', 'blinkR'], every: [2600, 5000], length: 160 }, clips: Object.assign({}, clips)
	};
}
var FN = 17;
function band(pts, w, round) {
	if (pts.length === 2) pts = qpts(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, pts[1][0], pts[1][1], 12);
	var L = [0], i; for (i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	var tot = L[L.length - 1], r = round ? w / 2 : 0, u = [], l = [];
	for (i = 0; i < FN; i++) {
		var s = -r + (tot + 2 * r) * i / (FN - 1), h = w / 2, sc = Math.max(0, Math.min(tot, s)), k = 1; while (k < L.length - 1 && L[k] < sc) k++;
		var a = pts[k - 1], b = pts[k], f = (sc - L[k - 1]) / Math.max(1e-6, L[k] - L[k - 1]), tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
		var cx = a[0] + (b[0] - a[0]) * f + tx * (s - sc), cy = a[1] + (b[1] - a[1]) * f + ty * (s - sc), dd = s < 0 ? -s : s > tot ? s - tot : 0;
		if (r > 0 && dd > 0) h = Math.sqrt(Math.max(0, r * r - dd * dd));
		u.push([cx + ty * h, cy - tx * h]); l.push([cx - ty * h, cy + tx * h]);
	}
	return { u: u, l: l };
}
function ell(cx, cy, rx, ry) { var u = [], l = []; for (var i = 0; i < FN; i++) { var a = Math.PI * i / (FN - 1), x = cx - rx * Math.cos(a), h = ry * Math.sin(a); u.push([x, cy - h]); l.push([x, cy + h]); } return { u: u, l: l }; }
function dshape(x0, x1, top, depth) { var cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, u = [], l = []; for (var i = 0; i < FN; i++) { var a = Math.PI * i / (FN - 1), x = cx - rx * Math.cos(a); u.push([x, top]); l.push([x, top + depth * Math.sin(a)]); } return { u: u, l: l }; }
function shiftE(e, dx, dy, fn) { function m(p, i) { var w = fn ? fn(i / (FN - 1)) : 1; return [p[0] + dx * w, p[1] + dy * w]; } return { u: e.u.map(m), l: e.l.map(m) }; }
function lerpE(e, f) { return { u: e.u, l: e.u.map(function (p, i) { return [p[0] + (e.l[i][0] - p[0]) * f, p[1] + (e.l[i][1] - p[1]) * f]; }) }; }
function midE(e) { var m = e.u.map(function (p, i) { return [(p[0] + e.l[i][0]) / 2, (p[1] + e.l[i][1]) / 2]; }); return { u: m, l: m }; }
function buildFace(rig, st, o) {
	if (st.face !== 'on') return;
	var ey = 45.5, mY = ey + 5.5, E = '#4f5266', lip = '#6b3530', z = o.z || 0, P = function () { return z; };
	function part(name, bone, base, targets, color, ord, opt) {
		opt = opt || {};
		return rig.shape({ name: name, bone: bone, base: base, targets: targets, rows: 1, lift: ord * .01, dome: 0, project: P, material: o.mat(color, opt), renderOrder: o.order + ord, opacityChannel: opt.ch, opacity: opt.op });
	}
	[36, 60].forEach(function (x) { part('blush', 'head', ell(x, ey + 6, 3.4, 2.2), {}, '#f08aa0', .1, { ch: 'cheek', op: st.blush === 'on' ? [.45, .62] : [0, .4], transparent: true }); });
	var calm = band([[44.5, mY + 1.5], [51.5, mY + 1.5]], 2, true), open = dshape(44.2, 51.8, mY + .6, 3.6);
	part('mouth', 'head', calm, { smile: band(qpts(43, mY + .5, 48, mY + 4.7, 53, mY + .5, 12), 2, true), concern: band(qpts(43.5, mY + 3, 48, mY, 52.5, mY + 3, 12), 2, true), grin: dshape(42.4, 53.6, mY + .4, 5.2), wow: ell(48, mY + 2, 2.3, 2.9), open: open }, lip, .2);
	part('teeth', 'head', midE(calm), { grin: dshape(41.5, 54.5, mY, 6), open: lerpE(open, .32) }, '#ffffff', .3);
	[[41, 'blinkR'], [55, 'blinkL']].forEach(function (q) {
		var x = q[0], happy = st.eyes === 'happy';
		var base = happy ? band(qpts(x - 2.5, ey + 1, x, ey - 2.2, x + 2.5, ey + 1, 12), 2.2, true) : st.eyes === 'dot' ? ell(x, ey, 2, 2) : ell(x, ey, 2.3, 3.1), tg = {};
		tg[q[1]] = band(qpts(x - 2.4, ey + .5, x, ey + 1.5, x + 2.4, ey + .5, 12), .9, true);
		tg.squint = happy ? base : band(qpts(x - 2.5, ey + 1, x, ey - 2, x + 2.5, ey + 1, 12), 2.4, true);
		tg.wide = happy ? shiftE(base, 0, -.6) : st.eyes === 'dot' ? ell(x, ey, 2.5, 2.5) : ell(x, ey, 2.6, 3.6);
		part('eye', 'eyes', base, tg, E, .4);
	});
	var bc = browColor(st);
	[0, 1].forEach(function (side) {
		var pts, w, rnd;
		if (st.brows === 'bar') { pts = side ? [[51.6, ey - 7.4], [59.2, ey - 6.5]] : [[36.8, ey - 6.5], [44.4, ey - 7.4]]; w = 2.6; rnd = false; }
		else if (st.brows === 'thick') { pts = side ? [[51.4, ey - 7.3], [59.4, ey - 6.3]] : [[36.6, ey - 6.3], [44.6, ey - 7.3]]; w = 3.6; rnd = true; }
		else { pts = side ? qpts(51.4, ey - 6.4, 55.2, ey - 8.4, 59, ey - 5.8, 12) : qpts(37, ey - 5.8, 40.8, ey - 8.4, 44.6, ey - 6.4, 12); w = 2; rnd = true; }
		var base = band(pts, w, rnd);
		part('brow', 'head', base, { browUp: shiftE(base, 0, -2.2), browInner: shiftE(base, 0, -2.6, function (t) { var k = side ? 1 - t : t; return k - (1 - k) * .15; }) }, bc, .5);
	});
}
function buildArm(T, rig, st, o) {
	var s = 'L', J = function (n) { return RIGJ[n + s]; }, sk = pick(SKIN, st.skin, 's4'), cloth = st.outfit === 'coat' ? CLOTH.white : pick(CLOTH, st.cloth, 'ai');
	var long = st.outfit === 'coat' || st.head === 'hijab', seg = 10;
	var ua = J('upperArm'), la = J('lowerArm'), wr = J('hand');
	var arm = new T.Mesh(rig.tube([ua, la, wr], function (t) { return 5.2 - t * 1.0; }, seg), o.mat(sk));
	arm.renderOrder = o.order; rig.skin(arm, rig.along(['upperArm' + s, 'lowerArm' + s, 'hand' + s], 3));
	var sp = long ? [ua, la, [la[0] + (wr[0] - la[0]) * .86, la[1] + (wr[1] - la[1]) * .86, 0]] : [ua, [ua[0] + (la[0] - ua[0]) * .6, ua[1] + (la[1] - ua[1]) * .6, 0]];
	var sl = new T.Mesh(rig.tube(sp, function (t) { return long ? 6.2 - t * .7 : 6.5; }, seg), o.mat(cloth));
	sl.renderOrder = o.order + .01; rig.skin(sl, rig.along(['upperArm' + s, 'lowerArm' + s, 'hand' + s], 3));
	var parts = [], palm = new T.SphereGeometry(1, 12, 8); palm.scale(7.6, 7, 3.3); palm.translate(wr[0] - 48, 48 - (wr[1] + 8.4), 0); parts.push({ geometry: palm, bone: 'hand' + s });
	['thumb', 'index', 'middle', 'ring', 'little'].forEach(function (f) {
		var r = f === 'thumb' ? 2.25 : f === 'little' ? 1.8 : 2.05;
		[1, 2, 3].forEach(function (k) { parts.push({ geometry: rig.tube([J(f + k), k < 3 ? J(f + (k + 1)) : J(f + 'Tip')], function () { return r * (1 - (k - 1) * .08); }, 8), bone: f + k + s }); });
	});
	var hand = rig.skinParts(parts, o.mat(sk)); hand.renderOrder = o.order + .02;
}
function flatMat(T, hex, o) {
	o = o || {};
	var m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide });
	m.toneMapped = false; m.color = new T.Color(hex);
	var c = T.materialColor; if (o.shade) c = c.mul(T.normalView.z.mul(.28).add(.72)); m.colorNode = c;
	var a = T.materialOpacity; if (o.mask) a = a.mul(o.eng.maskAlpha(o.mask)); m.opacityNode = a;
	return m;
}
function rig(ctx) {
	var e = ctx.engine, T = ctx.THREE, h = ctx.handles, st = norm(ctx.params), is25 = ctx.view !== '2d';
	var root = h.frame.parent, fc = new T.Group(); fc.scale.setScalar(1 / 48); root.add(fc);
	var r = e.createRig(rigDef(is25 ? '2.5d' : '2d', e.HUMANOID_CLIPS)); r.mount(fc);
	function hold(g) { var w = new T.Group(); w.scale.setScalar(48); w.add(g); return w; }
	r.attach('chest', hold(h.body)); r.attach('head', hold(h.head)); if (h.headTop) r.attach('head', hold(h.headTop));
	var mask = st.frame !== 'none' ? h.frame.userData.map : null;
	buildFace(r, st, { z: (is25 ? .12 : .003) * 48 + .1, order: 2, mat: function (hex) { return flatMat(T, hex); } });
	buildArm(T, r, st, { order: .5, mat: function (hex) { return flatMat(T, hex, { shade: is25, mask: mask, eng: e }); } });
	r.expression(st.mouth, { instant: true });
	return r;
}

/* ---------- the style ---------- */
export const BENKYO_STYLE = defineStyle({
	id: 'benkyo-v1',
	defaults: DEFAULTS,
	svg: function (p, size) { return render(p, size); },
	layers: function (p) { return layers(p); },
	rig: rig
});
