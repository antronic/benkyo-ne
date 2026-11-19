/**
 * POST /api/sync: push review logs (+ user cards), pull since cursors.
 *
 * Progress belongs to the signed-in account. Signing in on any device (passkey,
 * recovery code or Apple) is all it takes; the session cookie picks the store.
 * Each sync also renews the sign-in, so it doesn't run out while you use the app.
 *
 * Older devices still send a random sync key as `Authorization: Bearer`:
 *   - signed out: the key's store is used as before, until it is claimed;
 *   - signed in: the key's store is moved into the account once ("claimed"),
 *     the response says `keyRetired`, and the device forgets the key;
 *   - a claimed key used while signed out gets 409 `key-claimed`, so the
 *     device can ask you to sign in instead.
 *
 * The log is append-only and card state is derived by replaying it, so merging
 * two stores can't produce conflicting card states. Cards and notes merge last-write-wins.
 */
import { getSession } from './auth/passkey.ts';
import { renewSession } from './auth/session.ts';
import { MAX_CARDS_PULL, MAX_CARDS_PUSH, pullCards, upsertCardStatements, validCard } from './cards.ts';
import type { Env } from './env.ts';
import { json } from './http.ts';
import { claimNotesStatement, MAX_NOTES_PULL, MAX_NOTES_PUSH, pullNotes, upsertNoteStatements, validNote } from './notes.ts';
import type { Note } from '../src/lib/notes/contract.ts';
import type { UserCard } from '../src/lib/ai/contract.ts';

interface LogIn {
	id: string;
	cardId: string;
	grade: number;
	reviewedAt: number;
	elapsedDays: number;
	durationMs: number;
}

export const MAX_PUSH = 500;
export const MAX_PULL = 1000;

async function sha256(text: string) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const validLog = (l: LogIn) =>
	typeof l?.id === 'string' &&
	l.id.length <= 64 &&
	typeof l.cardId === 'string' &&
	l.cardId.length <= 64 &&
	Number.isInteger(l.grade) &&
	l.grade >= 1 &&
	l.grade <= 4 &&
	Number.isFinite(l.reviewedAt) &&
	Number.isFinite(l.elapsedDays) &&
	Number.isFinite(l.durationMs);

/** The account's sync store, created on first use. */
export async function accountStore(env: Env, accountId: number, now: number): Promise<number> {
	const row = await env.DB.prepare(
		`INSERT INTO users (sync_key_hash, account_id, created_at, last_seen_at) VALUES ('account:' || CAST(?1 AS INTEGER), CAST(?1 AS INTEGER), ?2, ?2)
		 ON CONFLICT (sync_key_hash) DO UPDATE SET last_seen_at = ?2
		 RETURNING id`
	)
		.bind(accountId, now)
		.first<{ id: number }>();
	if (!row) throw new Error('account store');
	return row.id;
}

/**
 * Move an unclaimed sync key's progress into the account's store, once.
 * Returns true when there was something to move.
 */
export async function claimKeyStore(env: Env, keyHash: string, store: number, accountId: number, now: number) {
	const old = await env.DB.prepare(
		`SELECT id FROM users WHERE sync_key_hash = ?1 AND account_id IS NULL AND claimed_by IS NULL`
	)
		.bind(keyHash)
		.first<{ id: number }>();
	if (!old || old.id === store) return false;
	// New revs go above the account's, so devices already pulling the account see the moved cards.
	const top = await env.DB.prepare(`SELECT COALESCE(MAX(rev), 0) AS rev FROM user_cards WHERE user_id = ?1`)
		.bind(store)
		.first<{ rev: number }>();
	await env.DB.batch([
		env.DB.prepare(
			`INSERT OR IGNORE INTO review_log (user_id, id, card_id, grade, reviewed_at, elapsed_days, duration_ms)
			 SELECT ?1, id, card_id, grade, reviewed_at, elapsed_days, duration_ms FROM review_log WHERE user_id = ?2 ORDER BY seq`
		).bind(store, old.id),
		env.DB.prepare(
			`INSERT INTO user_cards (user_id, card_id, kind, front, kanji, gloss, gloss2, usage_json, hook_json, example_json,
			                         verified, source, tags_json, created_at, updated_at, deleted, rev)
			 SELECT ?1, card_id, kind, front, kanji, gloss, gloss2, usage_json, hook_json, example_json,
			        verified, source, tags_json, created_at, updated_at, deleted, ?3 + rev
			   FROM user_cards WHERE user_id = ?2
			 ON CONFLICT (user_id, card_id) DO UPDATE SET
			   kind = excluded.kind, front = excluded.front, kanji = excluded.kanji, gloss = excluded.gloss,
			   gloss2 = excluded.gloss2, usage_json = excluded.usage_json, hook_json = excluded.hook_json,
			   example_json = excluded.example_json, verified = excluded.verified, source = excluded.source,
			   tags_json = excluded.tags_json, created_at = excluded.created_at, updated_at = excluded.updated_at,
			   deleted = excluded.deleted, rev = excluded.rev
			 WHERE excluded.updated_at > user_cards.updated_at`
		).bind(store, old.id, top?.rev ?? 0),
		claimNotesStatement(env.DB, store, old.id),
		env.DB.prepare(`DELETE FROM review_log WHERE user_id = ?1`).bind(old.id),
		env.DB.prepare(`DELETE FROM user_cards WHERE user_id = ?1`).bind(old.id),
		env.DB.prepare(`DELETE FROM user_notes WHERE user_id = ?1`).bind(old.id),
		env.DB.prepare(`UPDATE users SET claimed_by = ?1, last_seen_at = ?2 WHERE id = ?3 AND claimed_by IS NULL`).bind(
			accountId,
			now,
			old.id
		)
	]);
	return true;
}

/** Statements that delete an account's synced progress (used by account deletion). */
export function deleteSyncStatements(db: D1Database, accountId: number): D1PreparedStatement[] {
	return [
		db.prepare(`DELETE FROM review_log WHERE user_id IN (SELECT id FROM users WHERE account_id = ?1)`).bind(accountId),
		db.prepare(`DELETE FROM user_cards WHERE user_id IN (SELECT id FROM users WHERE account_id = ?1)`).bind(accountId),
		db.prepare(`DELETE FROM user_notes WHERE user_id IN (SELECT id FROM users WHERE account_id = ?1)`).bind(accountId),
		db.prepare(`DELETE FROM users WHERE account_id = ?1 OR claimed_by = ?1`).bind(accountId)
	];
}

export async function handleSync(req: Request, env: Env): Promise<Response> {
	// CSRF: the session cookie is SameSite=Strict; also refuse cross-origin writes.
	const origin = req.headers.get('origin');
	if (origin && origin !== new URL(req.url).origin) return json({ error: 'cross-origin' }, { status: 403 });
	const session = await getSession(req, env);
	const auth = req.headers.get('authorization') ?? '';
	const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	const keyOk = key.length >= 24 && key.length <= 128;
	if (!session && !keyOk) return json({ error: 'signed-out' }, { status: 401 });

	let body: { cursor?: number; logs?: LogIn[]; cards?: UserCard[]; cardsCursor?: number; notes?: Note[]; notesCursor?: number };
	try {
		body = await req.json();
	} catch {
		return json({ error: 'bad json' }, { status: 400 });
	}
	const logs = Array.isArray(body.logs) ? body.logs.slice(0, MAX_PUSH) : [];
	if (!logs.every(validLog)) return json({ error: 'bad log entry' }, { status: 400 });
	const cursor = Number.isInteger(body.cursor) ? Number(body.cursor) : 0;
	// User cards are optional; clients that don't send them get the old response shape.
	const withCards = body.cards !== undefined || body.cardsCursor !== undefined;
	const cards = Array.isArray(body.cards) ? body.cards.slice(0, MAX_CARDS_PUSH) : [];
	if (!cards.every(validCard)) return json({ error: 'bad card' }, { status: 400 });
	const cardsCursor = Number.isInteger(body.cardsCursor) ? Number(body.cardsCursor) : 0;
	// Notes are optional too (docs/NOTES.md); older clients don't send them.
	const withNotes = body.notes !== undefined || body.notesCursor !== undefined;
	const notes = Array.isArray(body.notes) ? body.notes.slice(0, MAX_NOTES_PUSH) : [];
	if (!notes.every(validNote)) return json({ error: 'bad note' }, { status: 400 });
	const notesCursor = Number.isInteger(body.notesCursor) ? Number(body.notesCursor) : 0;

	const now = Date.now();
	let store: number;
	let claimed = false;
	if (session) {
		store = await accountStore(env, session.userId, now);
		if (keyOk) claimed = await claimKeyStore(env, await sha256(key), store, session.userId, now);
	} else {
		// Signed out with an old sync key: first sync with a new key creates its store.
		const row = await env.DB.prepare(
			`INSERT INTO users (sync_key_hash, created_at, last_seen_at) VALUES (?1, ?2, ?2)
			 ON CONFLICT (sync_key_hash) DO UPDATE SET last_seen_at = ?2
			 RETURNING id, claimed_by AS claimedBy, account_id AS accountId`
		)
			.bind(await sha256(key), now)
			.first<{ id: number; claimedBy: number | null; accountId: number | null }>();
		if (!row || row.accountId !== null) return json({ error: 'bad key' }, { status: 401 });
		if (row.claimedBy !== null) return json({ error: 'key-claimed' }, { status: 409 });
		store = row.id;
	}

	if (logs.length) {
		const stmt = env.DB.prepare(
			`INSERT OR IGNORE INTO review_log (user_id, id, card_id, grade, reviewed_at, elapsed_days, duration_ms)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
		);
		await env.DB.batch(
			logs.map((l) => stmt.bind(store, l.id, l.cardId, l.grade, l.reviewedAt, l.elapsedDays, Math.round(l.durationMs)))
		);
	}

	const { results } = await env.DB.prepare(
		`SELECT seq, id, card_id AS cardId, grade, reviewed_at AS reviewedAt,
		        elapsed_days AS elapsedDays, duration_ms AS durationMs
		   FROM review_log WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`
	)
		.bind(store, cursor, MAX_PULL)
		.all<LogIn & { seq: number }>();

	if (cards.length) await env.DB.batch(upsertCardStatements(env.DB, store, cards));
	if (notes.length) await env.DB.batch(upsertNoteStatements(env.DB, store, notes));

	const next = results.length ? results[results.length - 1].seq : cursor;
	const out: Record<string, unknown> = {
		cursor: next,
		logs: results.map(({ seq: _s, ...l }) => l),
		// which store the cursors belong to; a device resets its cursors when this changes
		scope: session ? `account:${session.userId}` : 'key',
		more: results.length === MAX_PULL
	};
	if (session && keyOk) Object.assign(out, { keyRetired: true, claimed });
	if (withCards) {
		const c = await pullCards(env.DB, store, cardsCursor);
		Object.assign(out, c, { more: out.more || c.cards.length === MAX_CARDS_PULL });
	}
	if (withNotes) {
		const n = await pullNotes(env.DB, store, notesCursor);
		Object.assign(out, n, { more: out.more || n.notes.length === MAX_NOTES_PULL });
	}
	// Using the app keeps you signed in (worker/auth/session.ts).
	const cookie = session ? await renewSession(req, env, session) : null;
	return json(out, cookie ? { headers: { 'set-cookie': cookie } } : {});
}
