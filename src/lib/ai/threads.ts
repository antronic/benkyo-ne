/**
 * Ask AI conversations ("threads"), kept on this device in IndexedDB.
 * One list under meta/'askThreads'; the open one under meta/'askCurrent'.
 * The single chat from earlier versions (meta/'askThread') becomes the first thread.
 */
import type { AskResponse } from './contract.ts';
import { del, get, put } from '../db/idb.ts';

export interface AskMsg {
	role: 'user' | 'assistant';
	text: string;
	reply?: AskResponse;
	/** the reply was stopped or cut off before it finished */
	partial?: boolean;
}

export interface AskThread {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	msgs: AskMsg[];
}

const MAX_THREADS = 200;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function titleFor(msgs: AskMsg[]): string {
	const q = msgs.find((m) => m.role === 'user')?.text.replace(/\s+/g, ' ').trim() ?? '';
	return q.length > 60 ? `${q.slice(0, 57).trimEnd()}…` : q || 'New chat';
}

export async function loadThreads(): Promise<AskThread[]> {
	let list = (await get<AskThread[]>('meta', 'askThreads')) ?? null;
	if (!list) {
		list = [];
		const old = await get<AskMsg[]>('meta', 'askThread');
		if (old?.length) {
			const now = Date.now();
			list.push({ id: newId(), title: titleFor(old), createdAt: now, updatedAt: now, msgs: old });
		}
		await put('meta', list, 'askThreads');
		if (old) await del('meta', 'askThread');
	}
	return sortThreads(list);
}

export const sortThreads = (list: AskThread[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

export async function saveThreads(list: AskThread[]) {
	await put('meta', sortThreads(list.filter((t) => t.msgs.length)).slice(0, MAX_THREADS), 'askThreads');
}

export const getCurrent = () => get<string>('meta', 'askCurrent');
export const setCurrent = (id: string | null) => (id ? put('meta', id, 'askCurrent') : del('meta', 'askCurrent'));

/** Threads whose title or messages contain the query (case-insensitive), with a snippet. */
export function searchThreads(list: AskThread[], query: string): { thread: AskThread; snippet: string }[] {
	const q = query.trim().toLowerCase();
	return list
		.map((thread) => {
			const last = [...thread.msgs].reverse().find((m) => m.role === 'assistant') ?? thread.msgs.at(-1);
			if (!q) return { thread, snippet: last?.text ?? '' };
			if (thread.title.toLowerCase().includes(q)) return { thread, snippet: last?.text ?? '' };
			for (const m of thread.msgs) {
				const hay = [m.text, m.reply?.answer2 ?? '', ...(m.reply?.examples ?? []).map((e) => `${e.jp} ${e.reading} ${e.en}`)].join('\n');
				const i = hay.toLowerCase().indexOf(q);
				if (i >= 0) {
					const from = Math.max(0, i - 30);
					return { thread, snippet: (from ? '…' : '') + hay.slice(from, i + q.length + 60) };
				}
			}
			return null;
		})
		.filter((r): r is { thread: AskThread; snippet: string } => !!r);
}

/** iOS-style section for a time: Today, Yesterday, Previous 7 Days, month name. */
export function sectionOf(t: number, now = Date.now()): string {
	const d = new Date(t);
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	const day = 86_400_000;
	if (t >= start.getTime()) return 'Today';
	if (t >= start.getTime() - day) return 'Yesterday';
	if (t >= start.getTime() - 7 * day) return 'Previous 7 Days';
	if (t >= start.getTime() - 30 * day) return 'Previous 30 Days';
	return d.toLocaleDateString(undefined, { month: 'long', year: d.getFullYear() === start.getFullYear() ? undefined : 'numeric' });
}
