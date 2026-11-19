/**
 * Personal note sync (contract Note), piggybacking on POST /api/sync like
 * user cards (worker/cards.ts). Last-write-wins by updatedAt; `rev` (per
 * store, monotonic) is the pull cursor. Notes are private: nothing here is
 * ever readable by another account.
 */
import type { Note } from '../src/lib/notes/contract.ts';
import { NOTE_MAX, SUBJECT_RE } from '../src/lib/notes/contract.ts';

export const MAX_NOTES_PUSH = 500;
export const MAX_NOTES_PULL = 1000;

const isTime = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e15;
const isStr = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

export function validNote(n: unknown): n is Note {
	if (!n || typeof n !== 'object' || Array.isArray(n)) return false;
	const r = n as Record<string, unknown>;
	return (
		typeof r.subject === 'string' &&
		r.subject.length <= 128 &&
		SUBJECT_RE.test(r.subject) &&
		isStr(r.label, 200) &&
		isStr(r.body, NOTE_MAX) &&
		isTime(r.createdAt) &&
		isTime(r.updatedAt) &&
		typeof r.deleted === 'boolean'
	);
}

export function upsertNoteStatements(db: D1Database, store: number, notes: Note[]): D1PreparedStatement[] {
	const stmt = db.prepare(
		`INSERT INTO user_notes (user_id, subject, label, body, created_at, updated_at, deleted, rev)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT COALESCE(MAX(rev), 0) + 1 FROM user_notes WHERE user_id = ?1))
		 ON CONFLICT (user_id, subject) DO UPDATE SET
		   label = excluded.label, body = excluded.body, created_at = excluded.created_at,
		   updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
		 WHERE excluded.updated_at > user_notes.updated_at`
	);
	return notes.map((n) =>
		stmt.bind(
			store,
			n.subject,
			n.label,
			// a deleted note keeps no text on the server
			n.deleted ? '' : n.body,
			Math.round(n.createdAt),
			Math.round(n.updatedAt),
			n.deleted ? 1 : 0
		)
	);
}

interface NoteRow {
	subject: string;
	label: string;
	body: string;
	created_at: number;
	updated_at: number;
	deleted: number;
	rev: number;
}

export async function pullNotes(db: D1Database, store: number, cursor: number) {
	const { results } = await db
		.prepare(`SELECT * FROM user_notes WHERE user_id = ?1 AND rev > ?2 ORDER BY rev LIMIT ?3`)
		.bind(store, cursor, MAX_NOTES_PULL)
		.all<NoteRow>();
	const next = results.length ? results[results.length - 1].rev : cursor;
	const notes: Note[] = results.map((r) => ({
		subject: r.subject,
		label: r.label,
		body: r.body,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		deleted: !!r.deleted
	}));
	return { notes, notesCursor: next };
}

/** Move a sync key store's notes into an account store (see claimKeyStore). */
/**
 * Move one store's notes into another. New revs go above the target's highest rev, read inside
 * the same statement so a write from another device can't take the same rev in between.
 */
export function claimNotesStatement(db: D1Database, store: number, from: number): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO user_notes (user_id, subject, label, body, created_at, updated_at, deleted, rev)
			 SELECT ?1, subject, label, body, created_at, updated_at, deleted,
			        (SELECT COALESCE(MAX(rev), 0) FROM user_notes WHERE user_id = ?1) + rev
			   FROM user_notes WHERE user_id = ?2
			 ON CONFLICT (user_id, subject) DO UPDATE SET
			   label = excluded.label, body = excluded.body, created_at = excluded.created_at,
			   updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
			 WHERE excluded.updated_at > user_notes.updated_at`
		)
		.bind(store, from);
}
