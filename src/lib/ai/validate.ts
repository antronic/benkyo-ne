/**
 * Validators for AI requests and model output (docs/AI-PLAN.md §3: "model
 * output is data"). Pure and dependency-free: shared by the Worker and the
 * browser (local models).
 *
 * Model output is never trusted: unknown fields are dropped, strings are
 * trimmed and length-capped, fields the request didn't allow are nulled, and
 * items that can't be repaired are dropped. If nothing usable is left the
 * result is an error.
 */
import type {
	Bi,
	CardKind,
	FillRequest,
	FillResponse,
	FilledItem,
	ProposeRequest,
	ProposeResponse,
	ProposedItem
} from './contract.ts';
import { knownKanaChars } from './prompts.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Trimmed string with control characters (except \n) removed, or null. */
function cleanStr(v: unknown, max: number): string | null {
	if (typeof v !== 'string') return null;
	// eslint-disable-next-line no-control-regex
	const s = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
	if (!s) return null;
	return s.length > max ? s.slice(0, max).trimEnd() : s;
}

// ------------------------------------------------------------- kana utils ----

const KANA_RE = /^[ぁ-ゖゝゞァ-ヺー-ヾ　 、。・！？!?「」『』（）()〜~ー\n]+$/;
/** True when the string is only hiragana/katakana (+ ー, spaces, Japanese punctuation). */
export function isKanaReading(s: string): boolean {
	return KANA_RE.test(s) && /[ぁ-ゖァ-ヺ]/.test(s);
}

const isKanaChar = (ch: string) => /[ぁ-ゖァ-ヺ]/.test(ch);
const isKanji = (ch: string) => /[㐀-䶿一-鿿豈-﫿々]/.test(ch);
const ALWAYS_OK = new Set([...' 　\n、。・！？!?「」『』（）()〜~ー…']);

/**
 * True when every kana in `jp` is known and every kanji is part of the item
 * text (the only kanji an example may use). Latin letters are rejected.
 */
export function usesOnlyKnownKana(jp: string, known: Set<string>, allowedKanji: Set<string>): boolean {
	for (const ch of jp) {
		if (ALWAYS_OK.has(ch)) continue;
		if (isKanaChar(ch)) {
			if (!known.has(ch)) return false;
		} else if (isKanji(ch)) {
			if (!allowedKanji.has(ch)) return false;
		} else return false;
	}
	return true;
}

// -------------------------------------------------------------- requests ----

const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
function parseLang(v: unknown): Result<string | null> {
	if (v === null || v === undefined || v === '') return ok(null);
	if (typeof v === 'string' && LANG_RE.test(v) && !/^en(-|$)/i.test(v)) return ok(v);
	if (typeof v === 'string' && /^en(-|$)/i.test(v)) return ok(null); // English is always included
	return fail('secondLang must be a BCP-47 code or null');
}

const MEDIA = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** ~5 MB decoded (Anthropic's per-image limit). */
export const MAX_IMAGE_B64 = Math.ceil((5 * 1024 * 1024 * 4) / 3);

export function parseProposeRequest(body: unknown): Result<ProposeRequest> {
	if (!isRec(body)) return fail('body must be an object');
	const mode = body.mode;
	if (mode !== 'english' && mode !== 'scenario' && mode !== 'screenshot') return fail('bad mode');
	const lang = parseLang(body.secondLang);
	if (!lang.ok) return lang;
	const input = typeof body.input === 'string' ? body.input.trim() : '';
	if (input.length > 500) return fail('input too long');
	const req: ProposeRequest = { mode, input, secondLang: lang.value };

	if (mode === 'english') {
		if (!input) return fail('input required');
		if (!Array.isArray(body.candidates) || body.candidates.length === 0) return fail('candidates required');
		if (body.candidates.length > 30) return fail('too many candidates');
		const cands: NonNullable<ProposeRequest['candidates']> = [];
		for (const c of body.candidates) {
			if (!isRec(c)) return fail('bad candidate');
			const text = cleanStr(c.text, 100);
			const reading = cleanStr(c.reading, 100);
			const gloss = cleanStr(c.gloss, 300);
			if (!text || !reading || !gloss) return fail('bad candidate');
			cands.push({ text, reading, gloss });
		}
		req.candidates = cands;
	} else if (mode === 'scenario') {
		if (!input) return fail('input required');
	} else {
		const img = body.image;
		if (!isRec(img)) return fail('image required');
		if (!MEDIA.includes(img.mediaType as (typeof MEDIA)[number])) return fail('bad image type');
		if (typeof img.base64 !== 'string' || !img.base64) return fail('bad image');
		const b64 = img.base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
		if (b64.length > MAX_IMAGE_B64) return fail('image too large');
		if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return fail('image must be base64');
		req.image = { mediaType: img.mediaType as (typeof MEDIA)[number], base64: b64 };
	}
	return ok(req);
}

export const MAX_FILL_ITEMS = 20;

export function parseFillRequest(body: unknown): Result<FillRequest> {
	if (!isRec(body)) return fail('body must be an object');
	const lang = parseLang(body.secondLang);
	if (!lang.ok) return lang;
	if (!Array.isArray(body.items) || body.items.length === 0) return fail('items required');
	if (body.items.length > MAX_FILL_ITEMS) return fail(`at most ${MAX_FILL_ITEMS} items`);
	const items: FillRequest['items'] = [];
	const keys = new Set<string>();
	for (const i of body.items) {
		if (!isRec(i)) return fail('bad item');
		const key = typeof i.key === 'string' ? i.key : '';
		if (!key || key.length > 128 || keys.has(key)) return fail('item keys must be unique, non-empty strings');
		keys.add(key);
		const text = cleanStr(i.text, 100);
		const reading = cleanStr(i.reading, 100);
		const gloss = cleanStr(i.gloss, 300);
		if (!text || !reading || !gloss) return fail('bad item');
		if (i.kind !== 'word' && i.kind !== 'phrase') return fail('bad item kind');
		items.push({ key, text, reading, kind: i.kind, gloss });
	}
	const knownKana = Array.isArray(body.knownKana)
		? body.knownKana.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 4).slice(0, 300)
		: [];
	return ok({
		items,
		knownKana,
		allowExamples: body.allowExamples === true,
		secondLang: lang.value,
		theme: body.theme === true
	});
}

// --------------------------------------------------------------- outputs ----

/** Parse model text into JSON, tolerating code fences or leading prose. */
export function parseModelJson(text: string): unknown {
	const t = text.trim();
	try {
		return JSON.parse(t);
	} catch {
		const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
		if (fenced) {
			try {
				return JSON.parse(fenced[1]);
			} catch {
				/* fall through */
			}
		}
		const a = t.indexOf('{');
		const b = t.lastIndexOf('}');
		if (a >= 0 && b > a) {
			try {
				return JSON.parse(t.slice(a, b + 1));
			} catch {
				/* fall through */
			}
		}
		return undefined;
	}
}

/** Bilingual text; plain strings are accepted as English-only. */
function cleanBi(v: unknown, secondLang: string | null, max: number): Bi | null {
	if (typeof v === 'string') {
		const en = cleanStr(v, max);
		return en ? { en, second: null } : null;
	}
	if (!isRec(v)) return null;
	const en = cleanStr(v.en, max);
	if (!en) return null;
	return { en, second: secondLang ? cleanStr(v.second, max) : null };
}

const MAX_PROPOSE: Record<ProposeRequest['mode'], number> = { english: 30, scenario: 10, screenshot: 30 };

export function validateProposeOutput(raw: unknown, req: ProposeRequest): Result<ProposeResponse> {
	if (!isRec(raw) || !Array.isArray(raw.items)) return fail('output must be {items: [...]}');
	const cands = new Map((req.candidates ?? []).map((c) => [`${c.text}\u0000${c.reading}`, c]));
	const seen = new Set<string>();
	const items: ProposedItem[] = [];
	for (const r of raw.items) {
		if (!isRec(r)) continue;
		const text = cleanStr(r.text, 100);
		const reading = cleanStr(r.reading, 100);
		if (!text || !reading || !isKanaReading(reading)) continue;
		const id = `${text}\u0000${reading}`;
		if (seen.has(id)) continue;
		const cand = cands.get(id);
		// english mode: rank only, never invent candidates
		if (req.mode === 'english' && !cand) continue;
		const gloss = cleanStr(r.gloss, 200) ?? cand?.gloss ?? null;
		if (!gloss) continue;
		const kind: CardKind = r.kind === 'phrase' ? 'phrase' : 'word';
		seen.add(id);
		items.push({ text, reading, kind, gloss, note: cleanBi(r.note, req.secondLang, 300) });
		if (items.length >= MAX_PROPOSE[req.mode]) break;
	}
	if (items.length === 0 && raw.items.length > 0) return fail('no valid items in output');
	if (items.length === 0 && req.mode !== 'screenshot') return fail('no items in output');
	return ok({ items });
}

export function validateFillOutput(raw: unknown, req: FillRequest): Result<FillResponse> {
	if (!isRec(raw) || !Array.isArray(raw.items)) return fail('output must be {theme, items: [...]}');
	const wanted = new Map(req.items.map((i) => [i.key, i]));
	const known = new Set(knownKanaChars(req.knownKana));
	const out = new Map<string, FilledItem>();
	for (const r of raw.items) {
		if (!isRec(r) || typeof r.key !== 'string') continue;
		const item = wanted.get(r.key);
		if (!item || out.has(r.key)) continue;
		const hook = cleanBi(r.hook, req.secondLang, 300);
		if (!hook) continue;
		const usage = item.kind === 'phrase' ? cleanBi(r.usage, req.secondLang, 300) : null;
		let example: FilledItem['example'] = null;
		if (req.allowExamples && isRec(r.example)) {
			const jp = cleanStr(r.example.jp, 200);
			const reading = cleanStr(r.example.reading, 300);
			const en = cleanStr(r.example.en, 300);
			const allowedKanji = new Set([...item.text].filter(isKanji));
			if (
				jp &&
				reading &&
				en &&
				isKanaReading(reading) &&
				usesOnlyKnownKana(jp, known, allowedKanji) &&
				(jp.match(/\n/g)?.length ?? 0) <= 1
			) {
				example = { jp, reading, en, second: req.secondLang ? cleanStr(r.example.second, 300) : null };
			}
		}
		out.set(r.key, {
			key: r.key,
			gloss2: req.secondLang ? cleanStr(r.gloss2, 200) : null,
			hook,
			usage,
			example
		});
	}
	if (out.size === 0) return fail('no valid items in output');
	// keep request order
	const items = req.items.map((i) => out.get(i.key)).filter((x): x is FilledItem => !!x);
	const theme = req.theme ? cleanBi(raw.theme, req.secondLang, 80) : null;
	return ok({ theme, items });
}
