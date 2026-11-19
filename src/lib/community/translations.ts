/**
 * Translations of community notes and replies, kept on this device so the
 * same note isn't translated (and paid for) twice. The key holds the note's
 * id, its last edit time and the target language, so an edited note is
 * translated again. Only the newest MAX entries are kept.
 */
import type { TranslateLang } from '#lib/ai/contract.ts';

const STORE = 'benkyo.translations';
const MAX = 200;

type Entry = { text: string; at: number };
let memory: Record<string, Entry> | null = null;

function load(): Record<string, Entry> {
	if (memory) return memory;
	try {
		memory = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Entry>;
	} catch {
		memory = {};
	}
	return memory;
}

export const translationKey = (kind: 'post' | 'reply', id: number, version: number, to: TranslateLang) => `${kind}:${id}:${version}:${to}`;

export function cachedTranslation(key: string): string | null {
	return load()[key]?.text ?? null;
}

export function saveTranslation(key: string, text: string, now = Date.now()) {
	const all = load();
	all[key] = { text, at: now };
	const keys = Object.keys(all);
	if (keys.length > MAX) {
		keys.sort((a, b) => all[a].at - all[b].at);
		for (const k of keys.slice(0, keys.length - MAX)) delete all[k];
	}
	try {
		localStorage.setItem(STORE, JSON.stringify(all));
	} catch {
		/* storage full or blocked: the in-memory copy still works this session */
	}
}

/** Tests only. */
export function resetTranslations() {
	memory = null;
}
