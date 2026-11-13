/**
 * On-device dictionary (docs/AI-PLAN.md D9, D16–D18, D20). Thin async wrappers over
 * @johnmorrisdotca/jisho (JMdict, safe mode). Nothing here throws on a missing data piece:
 *
 * - The common-words table (~26k words, one chunk) is precached and always available.
 * - The full dictionary is ~1,700 small chunks fetched on first use. Offline (not yet cached)
 *   or in the embedded deploy (not shipped) a piece fails to load; lookups then fall back to the
 *   common words and report `available: false` where the answer could be incomplete, so the UI
 *   can show "not available offline / unverified" (D18).
 */
import type { InflectedWord, Word, Words } from '@johnmorrisdotca/jisho/words';
import type { CardKind } from '#lib/ai/contract.ts';
import { isKanaText } from '#lib/dict/readable.ts';

export interface DictHit {
	/** JMdict id (ent_seq) */
	id: number;
	/** written form (commonest, or the form looked up), or the reading for kana-only words */
	text: string;
	/** reading in kana (katakana for loanwords) */
	reading: string;
	/** all written forms (kanji etc.), commonest first; empty for kana-only entries */
	written: string[];
	/** short English meaning */
	gloss: string;
	kind: CardKind;
	common: boolean;
	/** lower = commoner; null when JMdict doesn't rank it */
	rank: number | null;
	/** how the input was inflected from this base form, e.g. "negative, past" */
	inflection?: string;
}

export interface VerifyToken {
	surface: string;
	/** dictionary form, when it differs from the surface (食べなかった → 食べる) */
	base?: string;
	/** reading in hiragana */
	reading?: string;
	/** found in the dictionary (always true for punctuation/Latin/digits, see `kind`) */
	known: boolean;
	wordId?: number;
	kind: 'word' | 'unknown' | 'other';
	gloss?: string;
	inflection?: string;
}

export interface VerifyTextResult {
	/** every Japanese stretch is a dictionary word (and the reading matched, when one was given) */
	ok: boolean;
	/** false when a dictionary piece couldn't load and something stayed unverified */
	available: boolean;
	tokens: VerifyToken[];
	/** Japanese stretches not found */
	unknown: string[];
	/** null when no reading was given */
	readingMatches: boolean | null;
}

export interface VerifyItemResult {
	verified: boolean;
	hit: DictHit | null;
	/** false when the needed dictionary piece couldn't load (offline / not deployed): "unverified", not "wrong" */
	available: boolean;
	kind: CardKind;
	/** for phrases verified token by token (no single JMdict entry) */
	parts?: VerifyToken[];
}

type Jisho = typeof import('@johnmorrisdotca/jisho/words');

let jishoP: Promise<Jisho> | null = null;
/** The package's lookup code (small); its data chunks are imported on demand by the package. */
export function jisho(): Promise<Jisho> {
	return (jishoP ??= import('@johnmorrisdotca/jisho/words').catch((e) => {
		jishoP = null;
		throw e;
	}));
}

let commonP: Promise<Words> | null = null;
/** The common words as one table (precached). */
export function commonWords(): Promise<Words> {
	return (commonP ??= jisho()
		.then((j) => j.loadCommonWords())
		.catch((e) => {
			commonP = null;
			throw e;
		}));
}

interface Meta {
	release: string;
	phrase: Set<number>;
	grammar: Set<number>;
	/** id → folded readings that aren't the entry's main reading */
	secondary: Map<number, Set<string>>;
}
let metaP: Promise<Meta> | null = null;
export function meta(): Promise<Meta> {
	return (metaP ??= import('#lib/dict/meta.data.ts').then((m) => {
		const ids = (s: string) => new Set(s ? s.split(' ').map((x) => parseInt(x, 36)) : []);
		const secondary = new Map<number, Set<string>>();
		for (const part of m.SECONDARY_READINGS.split(' ')) {
			if (!part) continue;
			const [id, readings] = part.split(':');
			secondary.set(parseInt(id, 36), new Set(readings.split(',').map(fold)));
		}
		return { release: m.META_RELEASE, phrase: ids(m.PHRASE_IDS), grammar: ids(m.GRAMMAR_IDS), secondary };
	}));
}

/** katakana → hiragana (ー kept) */
export function fold(s: string): string {
	return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const JAPANESE = /[぀-ヿ㐀-鿿豈-﫿々〆ヶ]/u;
const KANA_ONLY = (s: string) => s.replace(/[^぀-ヿ]/gu, '');

function rankOf(w: Word): number | null {
	return w.rank >= 100000 ? null : w.rank;
}

function toHit(w: Word & { id: number }, m: Meta | null, inflection?: readonly string[]): DictHit {
	const hit: DictHit = {
		id: w.id,
		text: w.written,
		reading: w.reading,
		written: [...w.forms],
		gloss: w.meaning,
		kind: m?.phrase.has(w.id) ? 'phrase' : 'word',
		common: w.common,
		rank: rankOf(w)
	};
	if (inflection && inflection.length) hit.inflection = inflection.join(', ');
	return hit;
}

const hasId = (w: Word): w is Word & { id: number } => typeof w.id === 'number';

async function metaOrNull(): Promise<Meta | null> {
	try {
		return await meta();
	} catch {
		return null;
	}
}

function dedupe(found: { word: Word; path: readonly string[] }[], m: Meta | null, limit: number): DictHit[] {
	const seen = new Set<string>();
	const out: DictHit[] = [];
	for (const f of found) {
		if (!hasId(f.word)) continue;
		const k = `${f.word.id}:${fold(f.word.reading)}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(toHit(f.word, m, f.path));
		if (out.length >= limit) break;
	}
	return out;
}

/** Common-words-only stand-in for findInflected (offline / embedded). */
async function inflectedFromCommon(text: string): Promise<InflectedWord[]> {
	const j = await jisho();
	const c = await commonWords();
	const out: InflectedWord[] = j.wordsOf(c, text).map((word) => ({ word, form: text, path: [] }));
	for (const d of j.deinflect(text)) {
		for (const word of j.wordsOf(c, d.base)) {
			if (word.kinds.includes(d.kind)) out.push({ word, form: d.base, path: d.path });
		}
	}
	return out;
}

export interface LookupResult {
	hits: DictHit[];
	/** false when the full dictionary couldn't be consulted (only common words were searched) */
	available: boolean;
}

/** lookupJapanese, plus whether the full dictionary was available. */
export async function lookupJapaneseResult(text: string, limit = 10): Promise<LookupResult> {
	const q = text.trim();
	if (!q) return { hits: [], available: true };
	const m = await metaOrNull();
	try {
		const j = await jisho();
		return { hits: dedupe(await j.findInflected(q), m, limit), available: true };
	} catch {
		try {
			return { hits: dedupe(await inflectedFromCommon(q), m, limit), available: false };
		} catch {
			return { hits: [], available: false };
		}
	}
}

/**
 * Japanese input (kana or kanji, conjugated or not): exact matches by reading/written form
 * first, then the dictionary forms it was inflected from (食べなかった → 食べる, "negative, past").
 */
export async function lookupJapanese(text: string, limit = 10): Promise<DictHit[]> {
	return (await lookupJapaneseResult(text, limit)).hits;
}

/** Romaji (Hepburn/Kunrei, macrons ok) → kana on the device, then lookupJapanese. */
export async function lookupRomaji(text: string, limit = 10): Promise<DictHit[]> {
	const kana = await romajiCandidates(text);
	const out: DictHit[] = [];
	const seen = new Set<string>();
	for (const k of kana) {
		for (const h of await lookupJapanese(k, limit)) {
			const key = `${h.id}:${h.reading}`;
			if (!seen.has(key) && out.length < limit) {
				seen.add(key);
				out.push(h);
			}
		}
	}
	return out;
}

/** The kana a romaji text could be (`ike` → いけ, `kōhī` → こうひい/こーひー…). */
export async function romajiCandidates(text: string): Promise<string[]> {
	const j = await jisho();
	const t = text.trim();
	if (!t) return [];
	const list = j.kanaFromRomaji(t);
	if (list.length) return list;
	const one = j.romajiToKana(t);
	return one ? [one] : [];
}

/** English meaning → words, commonest first (at most 20). */
export async function lookupEnglish(text: string, limit = 10): Promise<DictHit[]> {
	const q = text.trim();
	if (!q) return [];
	const m = await metaOrNull();
	const lim = Math.max(1, Math.min(20, limit));
	let words: Word[];
	try {
		const j = await jisho();
		words = await j.findByMeaning(q, { limit: lim });
	} catch {
		try {
			const j = await jisho();
			words = j.searchMeanings(await commonWords(), q);
		} catch {
			return [];
		}
	}
	return dedupe(
		[...words].sort((a, b) => a.rank - b.rank).map((word) => ({ word, path: [] })),
		m,
		lim
	);
}

/**
 * Glosses for a JMdict id in a language. The package ships English glosses only: JMdict's
 * other-language glosses aren't under CC BY-SA, so @johnmorrisdotca/jisho leaves them out.
 * Returns the English glosses (all senses, flattened) for `en`, null for any other language
 * (the caller then has the AI translate the English gloss, D22), and null if the id is unknown.
 */
export async function getGlosses(id: number, lang: string): Promise<string[] | null> {
	if (!/^en\b/i.test(lang.trim())) return null;
	try {
		const c = await commonWords();
		const w = (await commonIndex(c)).get(id);
		if (w) return w.senses.flatMap((s) => [...s.glosses]);
	} catch {
		/* fall through */
	}
	try {
		const { loadEntry } = await import('@johnmorrisdotca/jisho/entries');
		const e = await loadEntry(id);
		return e ? e.senses.flatMap((s) => s.glosses.map((g) => g.text)) : null;
	} catch {
		return null;
	}
}

let commonIndexP: Promise<Map<number, Word>> | null = null;
function commonIndex(c: Words): Promise<Map<number, Word>> {
	return (commonIndexP ??= jisho().then((j) => {
		const map = new Map<number, Word>();
		for (const w of j.allWords(c)) if (hasId(w) && !map.has(w.id)) map.set(w.id, w);
		return map;
	}));
}

// ------------------------------------------------------------ verifyText ----

interface RawToken {
	text: string;
	kind: 'word' | 'unknown' | 'other';
	word: Word | null;
	form: string;
	path: readonly string[];
	reading: string;
	/** other readings the surface could have (unconjugated alternatives) */
	alt: string[];
}

/**
 * Segmentation over the common words (offline fallback for readText, and a second opinion when
 * readText's greedy longest match leaves a gap, e.g. いけがあります → い|けが|あります).
 * Dynamic programming: fewest unknown characters, then the cheapest tokens (a word costs 1, a
 * lone kana particle 0.7, any other lone kana 1.5).
 */
async function segmentCommon(text: string): Promise<RawToken[]> {
	const j = await jisho();
	const c = await commonWords();
	const m = await metaOrNull();
	const chars = [...text.normalize('NFKC')];
	const n = chars.length;
	type Step = { cost: number; from: number; tok: RawToken | null; kind: 'word' | 'unknown' | 'other' };
	const best: (Step | null)[] = new Array(n + 1).fill(null);
	best[0] = { cost: 0, from: -1, tok: null, kind: 'other' };
	const relax = (to: number, cost: number, from: number, tok: RawToken | null, kind: Step['kind']) => {
		const cur = best[to];
		if (!cur || cost < cur.cost - 1e-9) best[to] = { cost, from, tok, kind };
	};
	const wordCost = (s: string) => ([...s].length > 1 ? 1 : PARTICLES.has(s) ? 0.7 : 1.5);
	for (let i = 0; i < n; i++) {
		const here = best[i];
		if (!here) continue;
		if (!JAPANESE.test(chars[i])) {
			relax(i + 1, here.cost, i, null, 'other');
			continue;
		}
		relax(i + 1, here.cost + 100, i, null, 'unknown');
		for (let len = 1; len <= Math.min(12, n - i); len++) {
			const s = chars.slice(i, i + len).join('');
			if (!JAPANESE.test(chars[i + len - 1])) break;
			const exact = j.wordsOf(c, s);
			if (exact.length) {
				// prefer a grammar reading of a lone kana (が the particle, not 蛾)
				const w = exact.find((x) => typeof x.id === 'number' && m?.grammar.has(x.id)) ?? exact[0];
				const tok: RawToken = { text: s, kind: 'word', word: w, form: s, path: [], reading: isKanaText(s) ? fold(s) : fold(w.reading), alt: exact.filter((x) => x !== w).map((x) => fold(x.reading)) };
				relax(i + len, here.cost + wordCost(s), i, tok, 'word');
			}
			for (const d of j.deinflect(s)) {
				const w = j.wordsOf(c, d.base).find((x) => x.kinds.includes(d.kind));
				if (!w) continue;
				const reading = isKanaText(s) ? fold(s) : surfaceReading(s, d.base, w.reading);
				relax(i + len, here.cost + 1, i, { text: s, kind: 'word', word: w, form: d.base, path: d.path, reading, alt: [] }, 'word');
				break;
			}
		}
	}
	const steps: Step[] = [];
	for (let at = n; at > 0; ) {
		const st = best[at]!;
		steps.push(st);
		at = st.from;
	}
	steps.reverse();
	const out: RawToken[] = [];
	let pos = 0;
	for (const st of steps) {
		const end = st.tok ? pos + [...st.tok.text].length : pos + 1;
		if (st.tok) out.push(st.tok);
		else {
			const ch = chars[pos];
			const last = out[out.length - 1];
			if (last && last.kind === st.kind) last.text += ch;
			else out.push({ text: ch, kind: st.kind, word: null, form: ch, path: [], reading: '', alt: [] });
		}
		pos = end;
	}
	return out;
}

const PARTICLES = new Set([...'がのはをにへとでもやかねよなわぞさ']);
const unknownChars = (ts: RawToken[]) => ts.filter((t) => t.kind === 'unknown').reduce((n, t) => n + t.text.length, 0);

/** Reading of a conjugated surface: the base's reading with the base's okurigana swapped for the surface's. */
function surfaceReading(surface: string, base: string, baseReading: string): string {
	let k = 0;
	while (k < surface.length && k < base.length && surface[k] === base[k]) k++;
	const baseTail = fold(base.slice(k));
	const r = fold(baseReading);
	if (!r.endsWith(baseTail)) return '';
	return r.slice(0, r.length - baseTail.length) + fold(surface.slice(k));
}

async function rawTokens(jp: string): Promise<{ tokens: RawToken[]; full: boolean }> {
	try {
		const j = await jisho();
		const r = await j.readText(jp);
		return {
			full: true,
			tokens: r.tokens.map((t) => ({
				text: t.text,
				kind: t.kind,
				word: t.word,
				form: t.form,
				path: t.path,
				reading: t.reading,
				alt: t.path.length ? [] : t.alternatives.filter((a) => a.path.length === 0).map((a) => fold(a.word.reading))
			}))
		};
	} catch {
		return { full: false, tokens: await segmentCommon(jp) };
	}
}

/** readText, with the common-words segmentation as a second opinion when it leaves gaps. */
async function bestTokens(jp: string): Promise<{ tokens: RawToken[]; full: boolean }> {
	const first = await rawTokens(jp);
	if (!first.full || unknownChars(first.tokens) === 0) return first;
	try {
		const second = await segmentCommon(jp);
		if (unknownChars(second) < unknownChars(first.tokens)) return { full: true, tokens: second };
	} catch {
		/* keep readText's answer */
	}
	return first;
}

/** Can the per-token readings be chosen so they spell `target`? */
function readingAligns(tokens: RawToken[], target: string): boolean {
	const goal = fold(KANA_ONLY(target.normalize('NFKC')));
	const opts = tokens
		.map((t) => {
			if (t.kind === 'word') return [...new Set([t.reading, ...t.alt].filter(Boolean))];
			const kana = fold(KANA_ONLY(t.text));
			return kana ? [kana] : null;
		})
		.filter((x): x is string[] => x !== null);
	let states = new Set([0]);
	for (const o of opts) {
		const next = new Set<number>();
		for (const p of states) for (const r of o) if (goal.startsWith(r, p)) next.add(p + r.length);
		if (!next.size) return false;
		states = next;
	}
	return states.has(goal.length);
}

/**
 * Tokenise Japanese (longest match on the dictionary, conjugations included) and check every
 * piece is a dictionary word. Used to vet AI example sentences. `reading` (optional) must be
 * spellable from the tokens' readings. Punctuation, spaces, Latin and digits are ignored.
 */
export async function verifyText(jp: string, reading?: string): Promise<VerifyTextResult> {
	let raw: { tokens: RawToken[]; full: boolean };
	try {
		raw = await bestTokens(jp);
	} catch {
		return { ok: false, available: false, tokens: [], unknown: [], readingMatches: null };
	}
	const tokens: VerifyToken[] = raw.tokens.map((t) => {
		const v: VerifyToken = { surface: t.text, known: t.kind !== 'unknown', kind: t.kind };
		if (t.kind === 'word' && t.word) {
			if (t.form !== t.text) v.base = t.form;
			if (t.reading) v.reading = t.reading;
			if (typeof t.word.id === 'number') v.wordId = t.word.id;
			v.gloss = t.word.meaning;
			if (t.path.length) v.inflection = t.path.join(', ');
		}
		return v;
	});
	const unknown = [...new Set(raw.tokens.filter((t) => t.kind === 'unknown').map((t) => t.text))];
	const hasWord = raw.tokens.some((t) => t.kind === 'word');
	const readingMatches = reading === undefined ? null : readingAligns(raw.tokens, reading);
	return {
		ok: hasWord && unknown.length === 0 && readingMatches !== false,
		available: raw.full || unknown.length === 0,
		tokens,
		unknown,
		readingMatches
	};
}

// ------------------------------------------------------------ verifyItem ----

async function isExpression(id: number, m: Meta | null): Promise<boolean> {
	if (m?.phrase.has(id)) return true;
	try {
		const { loadEntry } = await import('@johnmorrisdotca/jisho/entries');
		const e = await loadEntry(id);
		return !!e?.senses[0]?.pos.includes('exp');
	} catch {
		return false;
	}
}

/**
 * Is `text` read `reading` a JMdict entry? Fixed expressions (pos "exp": いただきます,
 * おねがいします) are kind 'phrase'. Text with no single entry is tokenised: if it splits into
 * 2+ known words whose readings spell `reading`, it is a verified phrase without a hit.
 */
export async function verifyItem(item: { text: string; reading: string }): Promise<VerifyItemResult> {
	const text = item.text.trim().normalize('NFKC');
	const reading = (item.reading || item.text).trim().normalize('NFKC');
	if (!text) return { verified: false, hit: null, available: true, kind: 'word' };
	const m = await metaOrNull();
	const target = fold(reading);
	const pick = (ws: Word[]) =>
		ws
			.filter(hasId)
			.filter((w) => fold(w.reading) === target)
			.sort((a, b) => a.rank - b.rank)[0];

	let found: (Word & { id: number }) | undefined;
	let full = true;
	try {
		const j = await jisho();
		const ws = await j.loadWords([text, reading]);
		found = pick(j.wordsOf(ws, text));
	} catch {
		full = false;
		try {
			const j = await jisho();
			found = pick(j.wordsOf(await commonWords(), text));
		} catch {
			/* nothing loaded */
		}
	}
	if (found) {
		const hit = toHit(found, m);
		if (hit.kind === 'word' && !found.common && (await isExpression(found.id, m))) hit.kind = 'phrase';
		return { verified: true, hit, available: true, kind: hit.kind };
	}

	const v = await verifyText(text, reading);
	const words = v.tokens.filter((t) => t.kind === 'word');
	if (v.ok && words.length >= 2) {
		return { verified: true, hit: null, available: true, kind: 'phrase', parts: v.tokens };
	}
	return {
		verified: false,
		hit: null,
		available: full && v.available,
		kind: words.length >= 2 ? 'phrase' : 'word',
		parts: words.length >= 2 ? v.tokens : undefined
	};
}
