/**
 * Kuri's sounds. Everything is synthesized with Web Audio, so there are no
 * audio files to download (the module is about 3 KB gzipped).
 *
 *   play('yip' | 'bark' | 'tap' | 'happy' | 'wave' | 'held' | 'thinking' | 'encourage' | 'sleep' | 'intro' | 'dizzy')
 *   hello()   // Kuri's synthesized "はじめまして！" for the first meeting
 *
 * The voice is built from scratch (a buzzing tone through vowel filters, one
 * syllable at a time), so it copies no recording and no real voice.
 *
 * Silent mode: Safari 16.4+ can mark page audio as "ambient", which follows the
 * iPhone's silent switch. We do that on iPhone and iPad only: on the Mac an
 * ambient page stayed silent. Other browsers play at the page volume. Sound is on
 * by default; nothing plays until the first tap unlocks audio.
 */

export type KuriSoundName = 'yip' | 'bark' | 'tap' | 'happy' | 'wave' | 'held' | 'thinking' | 'encourage' | 'sleep' | 'intro' | 'dizzy';

type Pt = [number, number];
type Formant = [number | Pt[], number];

const VOL = 0.7;
let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;

/**
 * Set when the page goes to the background. iPhone Safari moves a context to
 * "interrupted" there (or after a call or another app's audio), and an
 * interrupted context can stay silent even after resume(), so Kuri went quiet
 * until the app was closed. The next tap builds a fresh context instead.
 */
let stale = false;
if (typeof document !== 'undefined')
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') stale = true;
	});

/** iPhone, iPod or iPad (iPadOS reports a Mac, but one with a touch screen). */
export function isIOS(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean {
	return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

/** Inside a tap or key press, where a browser lets a new context start. */
function inGesture(): boolean {
	const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
	return ua ? ua.isActive : true;
}

/** Create or resume the audio context. Call it from a tap so browsers allow sound. */
export function unlock(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (ctx && (ctx.state === 'closed' || (stale && ctx.state !== 'running')) && inGesture()) {
		// a context the browser closed or left interrupted: drop it and start again
		void ctx.close().catch(() => {});
		ctx = null;
	}
	if (ctx && stale && inGesture()) stale = false; // running again after the background: keep it
	if (!ctx) {
		stale = false;
		try {
			// Only on iPhone and iPad, where "ambient" follows the silent switch. Safari on
			// the Mac has no silent switch, and an ambient page there played nothing at all.
			const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
			if (s && isIOS()) s.type = 'ambient';
		} catch {
			/* older Safari */
		}
		const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!A) return null;
		ctx = new A();
		master = ctx.createGain();
		master.gain.value = VOL;
		// a gentle limiter so stacked sounds never clip
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -12;
		comp.ratio.value = 6;
		master.connect(comp);
		comp.connect(ctx.destination);
		noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
		const d = noiseBuf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	}
	// 'suspended' before the first tap, 'interrupted' on iPhone after a call or the background
	if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
	return ctx;
}

function env(g: GainNode, t: number, a: number, peak: number, hold: number, rel: number) {
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(peak, t + a);
	g.gain.setValueAtTime(peak, t + a + hold);
	g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
}
function curve(p: AudioParam, t: number, pts: Pt[]) {
	p.setValueAtTime(pts[0][1], t + pts[0][0]);
	for (let i = 1; i < pts.length; i++) p.exponentialRampToValueAtTime(pts[i][1], t + pts[i][0]);
}
function setFreq(p: AudioParam, t: number, f: number | Pt[]) {
	if (Array.isArray(f)) curve(p, t, f);
	else p.value = f;
}

/** Voiced sound: a sawtooth through formant filters, a tiny vocal tract. */
function voiced(c: AudioContext, t: number, f0: Pt[], dur: number, formants: Formant[], peak: number) {
	const o = c.createOscillator();
	o.type = 'sawtooth';
	curve(o.frequency, t, f0);
	const g = c.createGain();
	env(g, t, 0.012, peak, Math.max(0, dur - 0.07), 0.06);
	for (const [f, level] of formants) {
		const bp = c.createBiquadFilter();
		bp.type = 'bandpass';
		bp.Q.value = 7;
		setFreq(bp.frequency, t, f);
		const fg = c.createGain();
		fg.gain.value = level * 4; // narrow formants pass little energy, so lift them back up
		o.connect(bp);
		bp.connect(fg);
		fg.connect(g);
	}
	g.connect(master);
	o.start(t);
	o.stop(t + dur + 0.05);
}
function noise(c: AudioContext, t: number, dur: number, freq: number | Pt[], q: number, peak: number, type: BiquadFilterType = 'bandpass') {
	const s = c.createBufferSource();
	s.buffer = noiseBuf;
	const f = c.createBiquadFilter();
	f.type = type;
	setFreq(f.frequency, t, freq);
	f.Q.value = q;
	const g = c.createGain();
	env(g, t, 0.005, peak, Math.max(0, dur - 0.03), 0.03);
	s.connect(f);
	f.connect(g);
	g.connect(master);
	s.start(t);
	s.stop(t + dur + 0.05);
}
function tone(c: AudioContext, t: number, freq: number | Pt[], dur: number, peak: number, type: OscillatorType = 'sine') {
	const o = c.createOscillator();
	o.type = type;
	setFreq(o.frequency, t, freq);
	const g = c.createGain();
	env(g, t, 0.006, peak, 0, dur);
	o.connect(g);
	g.connect(master);
	o.start(t);
	o.stop(t + dur + 0.05);
}

// A breathier, more natural voice for the sleep yawn. The other sounds keep the formant buzz above.

/** [frequency or curve, boost in dB, Q] for one peaking formant. */
type Formant2 = [number | Pt[], number, number];

/** A small room for one sound: dry to master plus a short, dark convolution tail. */
function room(c: AudioContext, wet = 0.13): GainNode {
	const input = c.createGain();
	const n = Math.floor(c.sampleRate * 0.35);
	const ir = c.createBuffer(1, n, c.sampleRate);
	const d = ir.getChannelData(0);
	const k = Math.exp((-2 * Math.PI * 2500) / c.sampleRate); // one-pole low-pass, a soft room
	let lp = 0;
	for (let i = 0; i < n; i++) {
		lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
		d[i] = lp * Math.exp(-i / (c.sampleRate * 0.07)) * Math.min(1, i / (c.sampleRate * 0.004));
	}
	const conv = c.createConvolver();
	conv.buffer = ir;
	const wg = c.createGain();
	wg.gain.value = wet;
	input.connect(master);
	input.connect(conv);
	conv.connect(wg);
	wg.connect(master);
	return input;
}

/** Slow random wander from the noise buffer, scaled to `depth` units RMS (cents on detune, or gain). */
function wander(c: AudioContext, t: number, dur: number, rate: number, depth: number, target: AudioParam) {
	const s = c.createBufferSource();
	s.buffer = noiseBuf;
	s.loop = true;
	const lp = c.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = rate;
	const g = c.createGain();
	// white noise of +-1 has RMS 0.577; a 2-pole low-pass keeps about rate * 1.57 Hz of 24 kHz of it
	g.gain.value = depth / (0.577 * Math.sqrt((rate * 1.57) / (c.sampleRate / 2)));
	s.connect(lp);
	lp.connect(g);
	g.connect(target);
	s.start(t, Math.random() * 1.1);
	s.stop(t + dur + 0.05);
}

/**
 * A breathy small-dog voice: glottal pulse with jitter and shimmer, plus aspiration, through a
 * cascade of peaking formants. `air` is the aspiration level against the voice; `airTail` lets the
 * breath carry on (in seconds) after the voice has stopped.
 */
function voice2(
	c: AudioContext, out: AudioNode, t: number, f0: Pt[], dur: number, formants: Formant2[], peak: number,
	a: number, rel: number, air = 0.25, airTail = 0, vibrato = 0
) {
	const N = 48,
		re = new Float32Array(N),
		im = new Float32Array(N);
	for (let h = 1; h < N; h++) im[h] = 1 / (h * h);
	const o = c.createOscillator();
	o.setPeriodicWave(c.createPeriodicWave(re, im));
	curve(o.frequency, t, f0);
	wander(c, t, dur, 9, 10, o.detune); // jitter, cents
	if (vibrato) {
		const v = c.createOscillator();
		v.frequency.value = 5.2;
		const vg = c.createGain();
		vg.gain.setValueAtTime(0, t);
		vg.gain.linearRampToValueAtTime(vibrato, t + dur);
		v.connect(vg);
		vg.connect(o.detune);
		v.start(t);
		v.stop(t + dur + 0.05);
	}
	const vox = c.createGain();
	env(vox, t, a, peak, Math.max(0, dur - a - rel), rel);
	const shimmer = c.createGain();
	shimmer.gain.value = 1;
	wander(c, t, dur, 18, 0.12, shimmer.gain);
	o.connect(shimmer);
	shimmer.connect(vox);
	const n = c.createBufferSource();
	n.buffer = noiseBuf;
	n.loop = true;
	const nh = c.createBiquadFilter();
	nh.type = 'highpass';
	nh.frequency.value = 600;
	const asp = c.createGain();
	env(asp, t, a, peak * air, Math.max(0, dur - a - rel), rel + airTail);
	n.connect(nh);
	nh.connect(asp);
	// vocal tract: overall tilt, then the formants in series
	const tilt = c.createBiquadFilter();
	tilt.type = 'lowpass';
	tilt.frequency.value = 3200;
	tilt.Q.value = 0.5;
	const hp = c.createBiquadFilter();
	hp.type = 'highpass';
	hp.frequency.value = 280;
	vox.connect(tilt);
	asp.connect(tilt);
	tilt.connect(hp);
	let node: AudioNode = hp;
	for (const [f, gain, q] of formants) {
		const pk = c.createBiquadFilter();
		pk.type = 'peaking';
		setFreq(pk.frequency, t, f);
		pk.gain.value = gain;
		pk.Q.value = q;
		node.connect(pk);
		node = pk;
	}
	node.connect(out);
	o.start(t);
	o.stop(t + dur + 0.05);
	n.start(t, Math.random() * 1.1);
	n.stop(t + dur + airTail + 0.05);
}

/** Breath through the nose or mouth: noise with a slow swell, one resonance, and a little random flutter. */
function breath2(c: AudioContext, out: AudioNode, t: number, dur: number, freq: number | Pt[], q: number, peak: number, a: number, rel: number, flutter = 0.15) {
	const s = c.createBufferSource();
	s.buffer = noiseBuf;
	s.loop = true;
	const f = c.createBiquadFilter();
	f.type = 'bandpass';
	setFreq(f.frequency, t, freq);
	f.Q.value = q;
	const hp = c.createBiquadFilter();
	hp.type = 'highpass';
	hp.frequency.value = 350;
	const lp = c.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 2200;
	const fl = c.createGain();
	fl.gain.value = 1;
	wander(c, t, dur, 14, flutter, fl.gain);
	const g = c.createGain();
	env(g, t, a, peak, Math.max(0, dur - a - rel), rel);
	s.connect(f);
	f.connect(hp);
	hp.connect(lp);
	lp.connect(fl);
	fl.connect(g);
	g.connect(out);
	s.start(t, Math.random() * 1.1);
	s.stop(t + dur + 0.05);
}

const yip = (c: AudioContext, t: number, base: number, dur = 0.13) =>
	voiced(c, t, [[0, base * 0.85], [0.03, base * 1.45], [dur, base * 1.05]], dur, [[1100, 1], [2300, 0.45]], 0.32);
function bark(c: AudioContext, t: number, base: number) {
	noise(c, t, 0.035, 1600, 1.2, 0.18);
	voiced(c, t + 0.01, [[0, base * 1.2], [0.05, base * 1.5], [0.17, base * 0.9]], 0.17, [[[[0, 900], [0.17, 650]], 1], [1500, 0.5]], 0.34);
}
function sparkle(c: AudioContext, t: number, notes: number[], gap: number, peak = 0.09) {
	notes.forEach((n, i) => {
		tone(c, t + i * gap, n, 0.28, peak);
		tone(c, t + i * gap, n * 2, 0.14, peak * 0.3);
	});
}

const SOUNDS: Record<KuriSoundName, (c: AudioContext, t: number) => void> = {
	yip: (c, t) => yip(c, t, 760),
	bark: (c, t) => bark(c, t, 430),
	tap: (c, t) => yip(c, t, 950, 0.09),
	happy: (c, t) => {
		yip(c, t, 820);
		yip(c, t + 0.14, 980);
		sparkle(c, t + 0.26, [1568, 1976, 2349, 3136], 0.06);
	},
	wave: (c, t) => {
		bark(c, t, 470);
		yip(c, t + 0.2, 820, 0.11);
	},
	held: (c, t) => voiced(c, t, [[0, 480], [0.26, 1150]], 0.28, [[[[0, 700], [0.26, 1400]], 1], [2400, 0.4]], 0.26),
	thinking: (c, t) => {
		// a soft closed-mouth "hmm" with a little vibrato, then three ticks like a typing indicator
		const o = c.createOscillator();
		o.type = 'triangle';
		o.frequency.setValueAtTime(300, t);
		o.frequency.linearRampToValueAtTime(340, t + 0.7);
		const lfo = c.createOscillator();
		lfo.frequency.value = 5.5;
		const lg = c.createGain();
		lg.gain.value = 6;
		lfo.connect(lg);
		lg.connect(o.frequency);
		const lp = c.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 700;
		const g = c.createGain();
		env(g, t, 0.12, 0.2, 0.45, 0.25);
		o.connect(lp);
		lp.connect(g);
		g.connect(master);
		o.start(t);
		lfo.start(t);
		o.stop(t + 0.9);
		lfo.stop(t + 0.9);
		[1175, 1319, 1480].forEach((f, i) => tone(c, t + 0.95 + i * 0.17, f, 0.08, 0.06));
	},
	encourage: (c, t) => {
		// a gentle "awoo": rises a little, then settles, kind rather than sad
		voiced(c, t, [[0, 520], [0.12, 640], [0.45, 470]], 0.48, [[[[0, 650], [0.2, 900], [0.45, 600]], 1], [1100, 0.4]], 0.22);
		tone(c, t + 0.42, 784, 0.35, 0.05);
		tone(c, t + 0.5, 988, 0.35, 0.05);
	},
	// a real dog yawn: the jaw opens on a thin, breathy
	// squeal that climbs to ~1.1 kHz, sinks as the mouth closes, the jaw shuts with a soft "mm",
	// and a contented sigh goes out through the nose.
	sleep: (c, t) => {
		const r = room(c);
		voice2(c, r, t, [[0, 620], [0.35, 1150], [0.6, 1000], [0.95, 520]], 0.95,
			[[[[0, 650], [0.4, 1050], [0.95, 600]], 14, 5], [[[0, 1550], [0.4, 1850], [0.95, 1400]], 10, 6], [2700, 4, 6], [3600, 2, 6]],
			0.065, 0.25, 0.3, 0.35, 0.25, 15);
		voice2(c, r, t + 0.9, [[0, 470], [0.3, 400]], 0.3, [[430, 12, 4], [1150, -8, 4], [2300, 2, 6]], 0.035, 0.05, 0.2, 0.15);
		breath2(c, r, t + 1.05, 1.1, [[0, 1250], [1.1, 800]], 1.3, 0.32, 0.15, 0.8);
	},
	dizzy: (c, t) => {
		// a woozy "awawawa" that wobbles and sinks, then little stars twinkling round the head
		const pts: Pt[] = [];
		for (let k = 0; k <= 10; k++) pts.push([k * 0.062, 640 * (1 - k * 0.04) * (k % 2 ? 1.13 : 0.9)]);
		voiced(c, t, pts, 0.66, [[[[0, 820], [0.66, 520]], 1], [1350, 0.4]], 0.26);
		[2093, 2637, 2349, 2794, 2489].forEach((f, i) => tone(c, t + 0.2 + i * 0.11, f, 0.13, 0.045, 'triangle'));
	},
	intro: (c, t) => {
		// the AI orb: a rising shimmer, then a soft pop as Kuri appears
		sparkle(c, t, [784, 988, 1175, 1568, 1976, 2349], 0.07, 0.07);
		noise(c, t + 0.62, 0.06, 900, 0.8, 0.22);
		tone(c, t + 0.62, [[0, 240], [0.18, 80]], 0.2, 0.3);
	}
};

// は・じ・め・ま・し・て！ as formant speech: consonant noise plus vowel formants at a cute high pitch
const V: Record<'a' | 'i' | 'e', Formant[]> = {
	a: [[850, 1], [1250, 0.6]],
	i: [[320, 1], [2600, 0.5]],
	e: [[480, 1], [2100, 0.5]]
};
function mora(c: AudioContext, t: number, cons: 'h' | 'j' | 'm' | 'sh' | 't', v: keyof typeof V, f0a: number, f0b: number, dur: number, devoiced = false) {
	if (cons === 'h') noise(c, t, 0.05, 1300, 1.2, 0.08);
	if (cons === 'j') noise(c, t, 0.05, 3200, 1.5, 0.07);
	if (cons === 'sh') noise(c, t, devoiced ? dur : 0.07, 3600, 1.4, 0.1);
	if (cons === 't') noise(c, t, 0.02, 4200, 1, 0.14);
	if (cons === 'm') voiced(c, t, [[0, f0a], [0.05, f0a]], 0.06, [[280, 1], [1200, 0.15]], 0.16);
	if (devoiced) return;
	const lead = cons === 'm' ? 0.05 : cons === 'h' || cons === 'j' ? 0.035 : cons === 'sh' ? 0.06 : 0.02;
	voiced(c, t + lead, [[0, f0a], [dur - lead, f0b]], dur - lead, V[v], 0.3);
}

/**
 * True when a sound may start now: audio is already running, or we are inside a
 * tap. Sound is on by default, so a timer sound (falling asleep) can come before
 * the first touch; skip it instead of queueing it on a locked context, which
 * would warn in the console and then play late on the first tap.
 */
function allowed(): boolean {
	if (typeof navigator === 'undefined') return false;
	if (ctx && ctx.state === 'running') return true;
	return inGesture(); // browsers without userActivation: old behaviour
}

/** Play one of Kuri's sounds now. Does nothing where Web Audio is missing. */
export function play(name: KuriSoundName) {
	if (!allowed()) return;
	const c = unlock();
	if (c) SOUNDS[name](c, c.currentTime + 0.01);
}

/** Kuri says "はじめまして！" (about one second). */
export function hello() {
	if (!allowed()) return;
	const c = unlock();
	if (!c) return;
	// pitch: low on は, high and level after (Tokyo accent), with a bright rise on the final て
	const t = c.currentTime + 0.02,
		b = 560,
		h = 690,
		s = 0.115;
	mora(c, t, 'h', 'a', b, b * 1.05, s);
	mora(c, t + s, 'j', 'i', h, h, s);
	mora(c, t + s * 2, 'm', 'e', h, h * 0.98, s);
	mora(c, t + s * 3, 'm', 'a', h, h, s);
	mora(c, t + s * 4, 'sh', 'i', h, h, s * 0.7, true);
	mora(c, t + s * 4.7, 't', 'e', h, h * 1.32, s * 1.9);
	sparkle(c, t + s * 6.8, [1568, 2093], 0.07, 0.05);
}

export const SOUND_NAMES = Object.keys(SOUNDS) as KuriSoundName[];
