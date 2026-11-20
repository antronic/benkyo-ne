/**
 * Card maker pipeline (docs/AI-PLAN.md §4b).
 *
 *   input ─▶ candidates ─▶ you pick ─▶ fill (AI, optional) ─▶ verify ─▶ save
 *
 * Dictionary steps run on the device and offline. AI steps run through the
 * Worker; when AI isn't available the cards are still saved with dictionary
 * content, and the AI part is queued in the outbox for later.
 */
import { lookupEnglish, lookupJapanese, lookupRomaji, verifyItem, verifyText, getGlosses, type DictHit } from '#lib/dict/dict.ts';
import * as api from '#lib/ai/client.ts';
import type { Bi, CardKind, FilledItem, ProposedItem, ProposeRequest, SightingVia, UserCard } from '#lib/ai/contract.ts';
import { ai } from '#lib/state/ai.svelte.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import { words } from '#lib/state/words.svelte.ts';
import { del, getAll, put } from '#lib/db/idb.ts';

export type MakerMode = 'english' | 'japanese' | 'romaji' | 'screenshot' | 'scenario';

export interface Candidate {
	key: string;
	text: string;
	reading: string;
	written: string[];
	kind: CardKind;
	gloss: string;
	verified: boolean;
	wordId: number | null;
	note: Bi | null;
	inflection?: string;
}

export interface CandidateResult {
	items: Candidate[];
	/** AI added ranking/notes (english) or produced the items (scenario/screenshot) */
	aiUsed: boolean;
	/** shown when AI was wanted but unavailable or failed */
	aiNote?: string;
	/** scenario/photo: AI-suggested pack name (becomes the cards' tag) */
	packName?: Bi | null;
}

const fromHit = (h: DictHit): Candidate => ({
	key: `${h.kind}:${h.id}`,
	text: h.text,
	reading: h.reading,
	written: h.written,
	kind: h.kind,
	gloss: h.gloss,
	verified: true,
	wordId: h.id,
	note: null,
	inflection: h.inflection
});

const errText = (e: unknown) => (e instanceof Error ? e.message : 'AI request failed');

export async function candidatesFor(
	mode: MakerMode,
	input: string,
	image?: ProposeRequest['image']
): Promise<CandidateResult> {
	const q = input.trim();
	if (mode === 'japanese') return { items: (await lookupJapanese(q, 12)).map(fromHit), aiUsed: false };
	if (mode === 'romaji') return { items: (await lookupRomaji(q, 12)).map(fromHit), aiUsed: false };

	if (mode === 'english') {
		const hits = (await lookupEnglish(q, 10)).map(fromHit);
		if (!hits.length || !ai.available) return { items: hits, aiUsed: false, aiNote: hits.length ? ai.reason || undefined : undefined };
		try {
			const r = await api.propose({
				mode: 'english',
				input: q,
				candidates: hits.map((h) => ({ text: h.text, reading: h.reading, gloss: h.gloss })),
				secondLang: progress.settings.secondLang
			});
			// The model may only rank/annotate the dictionary's candidates, never add new ones.
			const ranked: Candidate[] = [];
			for (const p of r.items) {
				const h = hits.find((x) => x.reading === p.reading && (x.text === p.text || x.written.includes(p.text)));
				if (h && !ranked.includes(h)) ranked.push({ ...h, note: p.note });
			}
			for (const h of hits) if (!ranked.includes(h) && !ranked.some((x) => x.key === h.key)) ranked.push(h);
			return { items: ranked, aiUsed: true };
		} catch (e) {
			return { items: hits, aiUsed: false, aiNote: errText(e) };
		}
	}

	// scenario / screenshot: AI proposes, the dictionary verifies each item.
	if (!ai.available) return { items: [], aiUsed: false, aiNote: ai.reason || 'AI is unavailable' };
	try {
		const r = await api.propose({ mode, input: q, image, secondLang: progress.settings.secondLang });
		const items: Candidate[] = [];
		for (const p of r.items) items.push(await verifiedCandidate(p));
		return { items: dedupe(items), aiUsed: true, packName: r.packName ?? null };
	} catch (e) {
		return { items: [], aiUsed: false, aiNote: errText(e) };
	}
}

/**
 * An AI-proposed item, checked against the dictionary. `stableKey` gives an
 * item the dictionary doesn't know the same card id every time (the Writing
 * helper saves the same set phrases again and again); otherwise it is new.
 */
export async function verifiedCandidate(p: ProposedItem, stableKey = false): Promise<Candidate> {
	const v = await verifyItem({ text: p.text, reading: p.reading });
	const hit = v.hit;
	return {
		key: hit ? `${hit.kind}:${hit.id}` : `${p.kind}:custom:${stableKey ? p.text : crypto.randomUUID()}`,
		text: hit?.text ?? p.text,
		reading: hit?.reading ?? p.reading,
		written: hit?.written ?? (p.text !== p.reading ? [p.text] : []),
		kind: hit?.kind ?? p.kind,
		gloss: hit?.gloss ?? p.gloss,
		verified: v.verified,
		wordId: hit?.id ?? null,
		note: p.note
	};
}

const dedupe = (xs: Candidate[]) => xs.filter((x, i) => xs.findIndex((y) => y.key === x.key) === i);

/** Kanji shown on the back (D17): a written form that differs from the reading. */
const kanjiOf = (c: Pick<Candidate, 'written' | 'reading' | 'text'>) =>
	c.written.find((w) => w !== c.reading) ?? (c.text !== c.reading ? c.text : null);

/** Create cards for the chosen candidates, then enrich them with AI (now or later). */
export async function saveCandidates(
	chosen: Candidate[],
	opts: { tags: string[]; source: UserCard['source']; via?: SightingVia; ctx?: string | null }
): Promise<UserCard[]> {
	const now = Date.now();
	const second = progress.settings.secondLang;
	const saved: UserCard[] = [];
	for (const c of chosen) {
		const id = c.key;
		const gloss2 = second && c.wordId ? ((await getGlosses(c.wordId, second))?.join('; ') ?? null) : null;
		const prev = words.cards[id];
		saved.push(
			await words.save({
				id,
				kind: c.kind,
				front: c.reading,
				kanji: kanjiOf(c),
				gloss: c.gloss,
				gloss2: prev?.gloss2 ?? gloss2,
				usage: prev?.usage ?? null,
				hook: prev?.hook ?? null,
				example: prev?.example ?? null,
				verified: c.verified,
				source: opts.source,
				tags: [...new Set([...(prev?.tags ?? []), ...opts.tags])],
				createdAt: prev?.createdAt ?? now,
				deleted: false,
				seen: prev?.seen ?? null
			})
		);
	}
	// phrasebook: saving from a photo or a look-up counts as it coming up in your life
	if (opts.via) await words.see(saved.map((c) => c.id), opts.via, opts.ctx ?? null);
	await enrich(saved.map((c) => c.id));
	return saved.map((c) => words.cards[c.id] ?? c);
}

interface OutboxItem {
	id: string;
	kind: 'fill';
	cardIds: string[];
	createdAt: number;
}

/**
 * AI enrichment: hooks, usage, examples, second-language gloss. Examples are
 * verified against the dictionary and dropped if any token is unknown.
 * Queues to the outbox when AI isn't available.
 */
export async function enrich(cardIds: string[]): Promise<'done' | 'queued'> {
	const cards = cardIds.map((id) => words.cards[id]).filter(Boolean);
	if (!cards.length) return 'done';
	if (!ai.available) {
		await put('outbox', { id: crypto.randomUUID(), kind: 'fill', cardIds, createdAt: Date.now() } satisfies OutboxItem);
		return 'queued';
	}
	const known = [...progress.knownKana];
	const r = await api.fill({
		items: cards.map((c) => ({ key: c.id, text: c.kanji ?? c.front, reading: c.front, kind: c.kind, gloss: c.gloss })),
		knownKana: known,
		allowExamples: known.length >= 15,
		secondLang: progress.settings.secondLang,
		theme: false
	});
	await applyFill(r.items);
	return 'done';
}

export async function applyFill(items: FilledItem[]) {
	for (const f of items) {
		const c = words.cards[f.key];
		if (!c) continue;
		let example = f.example;
		if (example) {
			const lines = example.jp.split('\n');
			const checks = await Promise.all(lines.map((l) => verifyText(l)));
			// Drop examples with unknown words; keep when the dictionary piece isn't available offline.
			if (checks.some((v) => v.available && !v.ok)) example = null;
		}
		await words.save({
			...c,
			gloss2: c.gloss2 ?? f.gloss2,
			hook: f.hook,
			usage: f.usage,
			example
		});
	}
}

/** Run queued AI work (call when coming online / after sign-in). */
export async function processOutbox() {
	if (!ai.available) return;
	const items = (await getAll<OutboxItem>('outbox')).sort((a, b) => a.createdAt - b.createdAt);
	for (const it of items) {
		try {
			await enrich(it.cardIds);
			await del('outbox', it.id);
		} catch {
			return; // try again later
		}
	}
}

/** Resize an image to ≤1568px on the long side as JPEG base64 (vision input). */
export async function imageToBase64(file: File): Promise<NonNullable<ProposeRequest['image']>> {
	const bmp = await createImageBitmap(file);
	const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bmp.width * scale);
	canvas.height = Math.round(bmp.height * scale);
	canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
	const url = canvas.toDataURL('image/jpeg', 0.85);
	return { mediaType: 'image/jpeg', base64: url.slice(url.indexOf(',') + 1) };
}
