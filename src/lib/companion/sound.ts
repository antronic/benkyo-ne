/**
 * Kuri's sounds. Everything is synthesized with Web Audio, so there are no
 * audio files to download (the module is under 2 KB gzipped).
 *
 *   play('yip' | 'bark' | 'tap' | 'happy' | 'wave' | 'held' | 'thinking' | 'encourage' | 'sleep' | 'intro')
 *   hello()   // Kuri's synthesized "はじめまして！" for the first meeting
 *
 * The voice is built from scratch (a buzzing tone through vowel filters, one
 * syllable at a time), so it copies no recording and no real voice.
 *
 * Silent mode: Safari 16.4+ can mark page audio as "ambient", which follows the
 * iPhone's silent switch. Other browsers play at the page volume, which is why
 * the Sound setting is off by default.
 */

export type KuriSoundName = 'yip' | 'bark' | 'tap' | 'happy' | 'wave' | 'held' | 'thinking' | 'encourage' | 'sleep' | 'intro';

type Pt = [number, number];
type Formant = [number | Pt[], number];

const VOL = 0.7;
let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;

/** Create or resume the audio context. Call it from a tap so browsers allow sound. */
export function unlock(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		try {
			const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
			if (s) s.type = 'ambient';
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
	if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
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
	sleep: (c, t) => {
		noise(c, t, 1.0, [[0, 1400], [1.0, 280]], 0.7, 0.12, 'lowpass');
		const o = c.createOscillator();
		o.type = 'sine';
		curve(o.frequency, t, [[0, 190], [1.0, 130]]);
		const g = c.createGain();
		env(g, t, 0.15, 0.1, 0.5, 0.4);
		o.connect(g);
		g.connect(master);
		o.start(t);
		o.stop(t + 1.1);
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

/** Play one of Kuri's sounds now. Does nothing where Web Audio is missing. */
export function play(name: KuriSoundName) {
	const c = unlock();
	if (c) SOUNDS[name](c, c.currentTime + 0.01);
}

/** Kuri says "はじめまして！" (about one second). */
export function hello() {
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
