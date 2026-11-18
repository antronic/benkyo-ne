/**
 * Japanese text-to-speech tuned for very short items (single kana).
 *
 * Why short sounds got clipped:
 *  - iOS Safari truncates an utterance that starts right after cancel();
 *    we wait a beat after cancelling.
 *  - The engine's first utterance after idle can lose its onset; a silent
 *    warm-up utterance primes it.
 *  - A lone kana spoken at normal speed lasts ~150 ms; we slow it down and
 *    end it with "。" so the vowel is pronounced fully.
 *  - A bare vowel (あ, い, う, え, お) or ん has no consonant to carry it, so
 *    "あ。" is read as the tiny interjection "a." and still sounds cut off.
 *    We hold it with "ー" ("あー。"), the way a teacher says the sound.
 */
let voice: SpeechSynthesisVoice | null = null;
let warmed = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Prefer natural Japanese voices (enhanced/premium iOS voices first). */
function pickVoice(): SpeechSynthesisVoice | null {
	const ja = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('ja'));
	if (!ja.length) return null;
	const score = (v: SpeechSynthesisVoice) =>
		(/premium/i.test(v.name) ? 4 : 0) +
		(/enhanced/i.test(v.name) ? 3 : 0) +
		(/kyoko|o-ren|otoya|hattori/i.test(v.name) ? 2 : 0) +
		(v.localService ? 1 : 0);
	return ja.sort((a, b) => score(b) - score(a))[0];
}

if (typeof speechSynthesis !== 'undefined') {
	voice = pickVoice();
	speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()));
}

/** Kana with no consonant onset: spoken alone they are too short to hear. */
const BARE = /^[あいうえおんアイウエオン]$/;

/** Text and rate for how the item should be spoken. */
export function prepare(text: string): { text: string; rate: number } {
	const t = text.trim();
	const chars = [...t.replace(/[。、！？!?.,\s]/g, '')];
	if (chars.length <= 1 && BARE.test(chars[0] ?? '')) return { text: `${chars[0]}ー。`, rate: 0.55 }; // bare vowel: hold it
	if (chars.length <= 1) return { text: `${t}。`, rate: 0.55 }; // single kana: slower, full vowel
	if (chars.length <= 3) return { text: /[。！？]$/.test(t) ? t : `${t}。`, rate: 0.7 };
	return { text: t, rate: 0.85 };
}

export function speak(text: string) {
	if (typeof speechSynthesis === 'undefined' || !text.trim()) return;
	clearTimeout(timer);
	const wasBusy = speechSynthesis.speaking || speechSynthesis.pending;
	if (wasBusy) speechSynthesis.cancel();

	const { text: say, rate } = prepare(text);
	const go = () => {
		if (!warmed) {
			// silent warm-up so the first real utterance isn't clipped
			const w = new SpeechSynthesisUtterance(' ');
			w.volume = 0;
			w.lang = 'ja-JP';
			speechSynthesis.speak(w);
			warmed = true;
		}
		const u = new SpeechSynthesisUtterance(say);
		u.lang = 'ja-JP';
		u.rate = rate;
		u.pitch = 1;
		u.volume = 1;
		voice ??= pickVoice();
		if (voice) u.voice = voice;
		speechSynthesis.speak(u);
	};
	// iOS clips an utterance queued in the same tick as cancel()
	if (wasBusy) timer = setTimeout(go, 120);
	else go();
}
