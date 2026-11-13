/**
 * Sync: push the local review log, pull entries from other devices.
 *
 * The log is append-only and card state is derived by replaying it, so two
 * devices can never produce conflicting card states. One request per sync,
 * which keeps us inside the Workers/D1 free-tier limits (docs/PLAN.md §8).
 */
import { get, getAll, put, putMany } from '#lib/db/idb.ts';
import { progress, type StoredLog } from '#lib/state/progress.svelte.ts';
import type { ReviewLog } from '#lib/srs/fsrs.ts';

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function getSyncKey(): Promise<string | undefined> {
	return get<string>('meta', 'syncKey');
}

export async function createSyncKey(): Promise<string> {
	const key = b64url(crypto.getRandomValues(new Uint8Array(24)));
	await put('meta', key, 'syncKey');
	return key;
}

export async function setSyncKey(key: string) {
	await put('meta', key.trim(), 'syncKey');
	await put('meta', 0, 'syncCursor');
}

export type SyncResult = { pushed: number; pulled: number } | { error: string };

let running: Promise<SyncResult> | null = null;

export function sync(): Promise<SyncResult> {
	running ??= doSync().finally(() => (running = null));
	return running;
}

async function doSync(): Promise<SyncResult> {
	const key = await getSyncKey();
	if (!key) return { error: 'no-key' };
	if (!navigator.onLine) return { error: 'offline' };

	const all = await getAll<StoredLog>('logs');
	const pending = all.filter((l) => l.synced === 0).slice(0, 500);
	const cursor = (await get<number>('meta', 'syncCursor')) ?? 0;

	let res: Response;
	try {
		res = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
			body: JSON.stringify({ cursor, logs: pending.map(({ synced: _s, ...l }) => l) })
		});
	} catch {
		return { error: 'network' };
	}
	if (!res.ok) return { error: `http-${res.status}` };

	const body = (await res.json()) as { cursor: number; logs: ReviewLog[] };
	await putMany(
		'logs',
		pending.map((l) => ({ ...l, synced: 1 }))
	);
	await progress.mergeLogs(body.logs);
	await put('meta', body.cursor, 'syncCursor');
	return { pushed: pending.length, pulled: body.logs.length };
}

/** Sync when the app opens, comes back online, or is hidden. */
export function startAutoSync() {
	const run = () => void sync();
	run();
	addEventListener('online', run);
	document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && run());
}
