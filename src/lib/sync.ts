/**
 * Sync: push the local review log, pull entries from other devices.
 *
 * Progress follows your account: when you're signed in (passkey, recovery
 * code or Apple), the session cookie tells the Worker whose progress this is,
 * so signing in on another device is all it takes. Signed out, everything
 * stays on this device and syncs the next time you sign in.
 *
 * Devices from before accounts may still hold a random sync key. It keeps
 * working while signed out; the first sync after signing in moves the key's
 * progress into the account and the key is forgotten (worker/sync.ts).
 *
 * The log is append-only and card state is derived by replaying it, so two
 * devices can never produce conflicting card states. Usually one request per
 * sync, which keeps us inside the Workers/D1 free-tier limits (docs/PLAN.md §8).
 */
import { del, get, getAll, put, putMany } from '#lib/db/idb.ts';
import { progress, type StoredLog } from '#lib/state/progress.svelte.ts';
import type { ReviewLog } from '#lib/srs/fsrs.ts';
import type { UserCard } from '#lib/ai/contract.ts';
import { words } from '#lib/state/words.svelte.ts';
import { ai } from '#lib/state/ai.svelte.ts';

const PUSH = 500;
/** Rounds per sync when there's more to send or fetch (first sync on a new device). */
const MAX_ROUNDS = 6;

/** An old per-device sync key, if this device still has one. */
export async function getSyncKey(): Promise<string | undefined> {
	return get<string>('meta', 'syncKey');
}

/** This device's old key was moved into an account elsewhere: signing in picks it up. */
export async function keyWasClaimed(): Promise<boolean> {
	return !!(await get<boolean>('meta', 'syncKeyClaimed'));
}

async function resetCursors() {
	await put('meta', 0, 'syncCursor');
	await put('meta', 0, 'cardsCursor');
}

export type SyncError = 'signed-out' | 'offline' | 'network' | 'key-claimed' | `http-${number}`;
export type SyncResult = { pushed: number; pulled: number } | { error: SyncError };

let running: Promise<SyncResult> | null = null;
/** Local progress has loaded (startAutoSync); a sync asked for earlier waits for it. */
let markReady: () => void;
const ready = new Promise<void>((r) => (markReady = r));

const listeners = new Set<(r: SyncResult) => void>();
/** Hear about every sync, including automatic ones. Returns an unsubscribe. */
export function onSync(fn: (r: SyncResult) => void) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function sync(): Promise<SyncResult> {
	running ??= doSync()
		.then((r) => {
			for (const fn of listeners) fn(r);
			return r;
		})
		.finally(() => (running = null));
	return running;
}

async function doSync(): Promise<SyncResult> {
	await ready;
	if (!navigator.onLine) return { error: 'offline' };
	let pushed = 0;
	let pulled = 0;
	for (let round = 0; round < MAX_ROUNDS; round++) {
		const r = await syncOnce();
		if ('error' in r) return round ? { pushed, pulled } : r;
		pushed += r.pushed;
		pulled += r.pulled;
		if (!r.more) break;
	}
	return { pushed, pulled };
}

type Round = { pushed: number; pulled: number; more: boolean };

async function syncOnce(): Promise<Round | { error: SyncError }> {
	const key = await getSyncKey();
	if (!ai.signedIn && !key) return { error: 'signed-out' };

	const all = await getAll<StoredLog>('logs');
	const pending = all.filter((l) => l.synced === 0).slice(0, PUSH);
	const cursor = (await get<number>('meta', 'syncCursor')) ?? 0;
	// Word/phrase card content: push what changed since the last push (LWW on the server).
	const cardsCursor = (await get<number>('meta', 'cardsCursor')) ?? 0;
	const pushedAt = (await get<number>('meta', 'cardsPushedAt')) ?? 0;
	const changed = (await getAll<UserCard>('userCards'))
		.filter((c) => c.updatedAt > pushedAt)
		.sort((a, b) => a.updatedAt - b.updatedAt)
		.slice(0, PUSH);
	const startedAt = Date.now();

	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (key) headers.authorization = `Bearer ${key}`;
	let res: Response;
	try {
		res = await fetch('/api/sync', {
			method: 'POST',
			credentials: 'same-origin',
			headers,
			body: JSON.stringify({ cursor, logs: pending.map(({ synced: _s, ...l }) => l), cards: changed, cardsCursor })
		});
	} catch {
		return { error: 'network' };
	}
	if (res.status === 401 && !key) {
		// the session ended (expired or signed out elsewhere): show it in the UI
		void ai.refresh();
		return { error: 'signed-out' };
	}
	if (res.status === 409) {
		// this key's progress now lives in an account: sign in to keep syncing
		await del('meta', 'syncKey');
		await put('meta', true, 'syncKeyClaimed');
		return { error: 'key-claimed' };
	}
	if (!res.ok) return { error: `http-${res.status}` };

	const body = (await res.json()) as {
		cursor: number;
		logs: ReviewLog[];
		cards?: UserCard[];
		cardsCursor?: number;
		scope?: string;
		more?: boolean;
		keyRetired?: boolean;
	};
	await putMany(
		'logs',
		pending.map((l) => ({ ...l, synced: 1 }))
	);
	await progress.mergeLogs(body.logs);
	if (body.cards) await words.merge(body.cards);

	// Cursors belong to one store (an account, or the old key). When that changes,
	// e.g. the first sync after signing in, pull that store from the start.
	const scope = body.scope ?? 'key';
	const lastScope = (await get<string>('meta', 'syncScope')) ?? (key ? 'key' : undefined);
	const moved = lastScope !== scope && (cursor > 0 || cardsCursor > 0);
	if (moved) await resetCursors();
	else {
		await put('meta', body.cursor, 'syncCursor');
		if (body.cardsCursor !== undefined) await put('meta', body.cardsCursor, 'cardsCursor');
	}
	await put('meta', scope, 'syncScope');
	if (body.cardsCursor !== undefined) {
		// a full batch may leave cards with the same timestamp behind: resend from just before it
		const next = changed.length < PUSH ? startedAt : changed[changed.length - 1].updatedAt - 1;
		await put('meta', next, 'cardsPushedAt');
	}
	if (body.keyRetired) await del('meta', 'syncKey');
	if (scope !== 'key') await del('meta', 'syncKeyClaimed');

	return {
		pushed: pending.length + changed.length,
		pulled: body.logs.length + (body.cards?.length ?? 0),
		more: moved || !!body.more || pending.length === PUSH || changed.length === PUSH
	};
}

/** Sync when the app opens, comes back online, or is hidden. Signing in also syncs (see +layout.svelte). */
export function startAutoSync() {
	markReady();
	const run = () => void sync();
	run();
	addEventListener('online', run);
	document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && run());
}
