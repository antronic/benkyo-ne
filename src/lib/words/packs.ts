/**
 * "Words you can read" packs (docs/AI-PLAN.md §4, D7–D11).
 *
 * The dictionary picks real common words written only in kana you know
 * (free, offline). AI, when available, adds a theme, hooks and examples.
 * Packs are prefetched so reading works offline; finishing a pack turns its
 * words into cards (introduced later within the daily budget, D10/D19).
 */
import { pickPackWords, type PackPick } from '#lib/dict/packs.ts';
import { getGlosses } from '#lib/dict/dict.ts';
import * as api from '#lib/ai/client.ts';
import type { Bi, FilledItem } from '#lib/ai/contract.ts';
import { del, getAll, put } from '#lib/db/idb.ts';
import { ai } from '#lib/state/ai.svelte.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import { words } from '#lib/state/words.svelte.ts';
import { verifyText } from '#lib/dict/dict.ts';

export interface PackItem extends PackPick {
	gloss2: string | null;
	hook: Bi | null;
	example: FilledItem['example'];
}

export interface Pack {
	id: string;
	createdAt: number;
	theme: Bi | null;
	items: PackItem[];
	enriched: boolean;
	status: 'ready' | 'done';
	/** language the content was written for; regenerate when it changes (D22) */
	lang: string | null;
}

export const PREFETCH = 3;
/** Need at least this many kana before packs make sense (vowels + one row). */
export const MIN_KANA = 10;

export async function listPacks(): Promise<Pack[]> {
	return (await getAll<Pack>('packs')).sort((a, b) => a.createdAt - b.createdAt);
}

async function usedIds(): Promise<number[]> {
	const packs = await getAll<Pack>('packs');
	const ids = new Set<number>();
	for (const p of packs) for (const i of p.items) ids.add(i.id);
	for (const c of words.list) {
		const m = /^(?:word|phrase):(\d+)$/.exec(c.id);
		if (m) ids.add(Number(m[1]));
	}
	return [...ids];
}

export async function createPack(): Promise<Pack | null> {
	const known = progress.knownKana;
	if (known.size < MIN_KANA) return null;
	const picks = await pickPackWords({ knownKana: known, excludeIds: await usedIds(), count: 6, seed: Date.now() });
	if (picks.length < 3) return null;
	const lang = progress.settings.secondLang;
	const items: PackItem[] = [];
	for (const p of picks) {
		items.push({ ...p, gloss2: lang ? ((await getGlosses(p.id, lang))?.join('; ') ?? null) : null, hook: null, example: null });
	}
	const pack: Pack = { id: crypto.randomUUID(), createdAt: Date.now(), theme: null, items, enriched: false, status: 'ready', lang };
	await put('packs', pack);
	await enrichPack(pack);
	return pack;
}

/** Add AI context to a pack (no-op when AI is unavailable). */
export async function enrichPack(pack: Pack): Promise<Pack> {
	if (pack.enriched || !ai.available) return pack;
	try {
		const known = [...progress.knownKana];
		const r = await api.fill({
			items: pack.items.map((i) => ({ key: i.key, text: i.text, reading: i.reading, kind: i.kind, gloss: i.gloss })),
			knownKana: known,
			allowExamples: known.length >= 15,
			secondLang: pack.lang,
			theme: true
		});
		for (const f of r.items) {
			const it = pack.items.find((i) => i.key === f.key);
			if (!it) continue;
			it.hook = f.hook;
			it.gloss2 = it.gloss2 ?? f.gloss2;
			it.example = f.example;
			if (f.example) {
				const v = await verifyText(f.example.jp);
				if (v.available && !v.ok) it.example = null; // unverified example → dropped (D9)
			}
		}
		pack.theme = r.theme;
		pack.enriched = true;
		await put('packs', pack);
	} catch {
		// leave it dictionary-only; enrichment is retried by ensurePacks()
	}
	return pack;
}

/** Keep PREFETCH unread packs ready; enrich any that missed AI earlier. */
export async function ensurePacks(): Promise<void> {
	const packs = await listPacks();
	const lang = progress.settings.secondLang;
	// Content written for another second language is regenerated gradually.
	for (const p of packs) if (p.status === 'ready' && p.lang !== lang) await del('packs', p.id);
	const ready = (await listPacks()).filter((p) => p.status === 'ready');
	for (const p of ready) if (!p.enriched) await enrichPack(p);
	for (let i = ready.length; i < PREFETCH; i++) if (!(await createPack())) break;
}

/** Finishing a pack turns its words into cards (D10). */
export async function finishPack(id: string): Promise<number> {
	const pack = (await getAll<Pack>('packs')).find((p) => p.id === id);
	if (!pack || pack.status === 'done') return 0;
	let n = 0;
	for (const i of pack.items) {
		if (words.cards[i.key]) continue;
		await words.save({
			id: i.key,
			kind: i.kind,
			front: i.reading,
			kanji: i.written.find((w) => w !== i.reading) ?? null,
			gloss: i.gloss,
			gloss2: i.gloss2,
			usage: null,
			hook: i.hook,
			example: i.example,
			verified: true,
			source: 'pack',
			tags: [],
			createdAt: Date.now(),
			deleted: false
		});
		n++;
	}
	pack.status = 'done';
	await put('packs', pack);
	return n;
}
