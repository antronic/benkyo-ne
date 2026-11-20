/**
 * /api/sync against a real SQLite (node:sqlite) behind a tiny D1 shim, with
 * the repo's migrations applied. The session is mocked: `signedInAs` picks the
 * account, or null for signed out.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let signedInAs: number | null = null;
vi.mock('./auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./auth/passkey.ts')>()),
	getSession: async () =>
		signedInAs === null
			? null
			: { tokenHash: 't', passkeyId: 'p', kind: 'passkey', userId: signedInAs, name: 'A', isAdmin: false }
}));

const { handleSync } = await import('./sync.ts');
const { deleteAccountData } = await import('./ai/credentials.ts');

function d1(db: DatabaseSync) {
	const stmt = (sql: string, args: unknown[] = []) => ({
		bind: (...a: unknown[]) => stmt(sql, a),
		first: async <T>() => (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
		all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
		run: async () => db.prepare(sql).run(...(args as never[])),
		exec: () => db.prepare(sql).all(...(args as never[]))
	});
	return {
		prepare: (sql: string) => stmt(sql),
		batch: async (stmts: ReturnType<typeof stmt>[]) => {
			db.exec('BEGIN');
			try {
				const out = stmts.map((s) => s.exec());
				db.exec('COMMIT');
				return out;
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		}
	};
}

let db: DatabaseSync;
let env: { DB: D1Database };
beforeEach(() => {
	db = new DatabaseSync(':memory:');
	const dir = new URL('./migrations/', import.meta.url);
	for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, created_at) VALUES (1, 'A', 'a', 0), (2, 'B', 'b', 0)`);
	env = { DB: d1(db) as unknown as D1Database };
	signedInAs = null;
});

const KEY = 'k'.repeat(32);
const log = (id: string, cardId = 'kana:a') => ({ id, cardId, grade: 3, reviewedAt: 1, elapsedDays: 0, durationMs: 900 });
const card = (id: string, updatedAt: number, gloss = id) => ({
	id: `word:${id}`,
	kind: 'word',
	front: id,
	kanji: null,
	gloss,
	gloss2: null,
	usage: null,
	hook: null,
	example: null,
	verified: true,
	source: 'user',
	tags: [],
	createdAt: 1,
	updatedAt,
	deleted: false
});

async function post(body: object, opts: { key?: string; origin?: string; cookie?: string } = {}) {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (opts.cookie) headers.cookie = opts.cookie;
	if (opts.key) headers.authorization = `Bearer ${opts.key}`;
	if (opts.origin) headers.origin = opts.origin;
	const res = await handleSync(
		new Request('https://benkyo.test/api/sync', { method: 'POST', headers, body: JSON.stringify(body) }),
		env as never
	);
	return { status: res.status, setCookie: res.headers.get('set-cookie'), body: (await res.json()) as Record<string, any> };
}

describe('account sync', () => {
	it('signed out with no key is refused', async () => {
		expect((await post({ cursor: 0, logs: [] })).status).toBe(401);
	});

	it('two devices on one account see each other’s reviews', async () => {
		signedInAs = 1;
		const a = await post({ cursor: 0, logs: [log('l1')], cards: [card('neko', 5)], cardsCursor: 0 });
		expect(a.status).toBe(200);
		expect(a.body.scope).toBe('account:1');
		const b = await post({ cursor: 0, logs: [], cards: [], cardsCursor: 0 });
		expect(b.body.logs.map((l: { id: string }) => l.id)).toEqual(['l1']);
		expect(b.body.cards.map((c: { id: string }) => c.id)).toEqual(['word:neko']);
	});

	it('phrasebook sightings travel with the card, and a bad one is refused', async () => {
		signedInAs = 1;
		const seen = { count: 3, recent: [{ at: 7, via: 'photo', ctx: '資料を共有します' }] };
		await post({ cursor: 0, logs: [], cards: [{ ...card('shiryou', 5), seen }], cardsCursor: 0 });
		const b = await post({ cursor: 0, logs: [], cards: [], cardsCursor: 0 });
		expect(b.body.cards[0].seen).toEqual(seen);
		// an older app that does not know about sightings edits the card: they are kept
		const { seen: _drop, ...plain } = { ...card('shiryou', 8, 'documents'), seen: null };
		await post({ cursor: 0, logs: [], cards: [plain], cardsCursor: 0 });
		const c = await post({ cursor: 0, logs: [], cards: [], cardsCursor: 0 });
		expect(c.body.cards[0]).toMatchObject({ gloss: 'documents', seen });
		const bad = await post({ cursor: 0, logs: [], cards: [{ ...card('x', 6), seen: { count: 1, recent: [{ at: 1, via: 'mind', ctx: null }] } }], cardsCursor: 0 });
		expect(bad.status).toBe(400);
	});

	it('accounts are kept apart', async () => {
		signedInAs = 1;
		await post({ cursor: 0, logs: [log('mine')] });
		signedInAs = 2;
		expect((await post({ cursor: 0, logs: [] })).body.logs).toEqual([]);
	});

	it('moves an old key’s progress into the account once, then retires the key', async () => {
		// old device, signed out, syncing with its key
		await post({ cursor: 0, logs: [log('k1'), log('k2')], cards: [card('inu', 5, 'old dog')], cardsCursor: 0 }, { key: KEY });
		// the account already has some progress and a newer copy of one card
		signedInAs = 1;
		await post({ cursor: 0, logs: [log('a1')], cards: [card('inu', 9, 'dog'), card('tori', 3)], cardsCursor: 0 });

		const first = await post({ cursor: 0, logs: [], cards: [], cardsCursor: 0 }, { key: KEY });
		expect(first.body).toMatchObject({ keyRetired: true, claimed: true, scope: 'account:1' });
		expect(first.body.logs.map((l: { id: string }) => l.id).sort()).toEqual(['a1', 'k1', 'k2']);
		const inu = first.body.cards.find((c: { id: string }) => c.id === 'word:inu');
		expect(inu.gloss).toBe('dog'); // newer edit wins

		// the key store is emptied and marked claimed
		expect(db.prepare(`SELECT COUNT(*) AS n FROM review_log WHERE user_id = (SELECT id FROM users WHERE claimed_by = 1)`).get()).toEqual({ n: 0 });
		// a second claim does nothing
		expect((await post({ cursor: 0, logs: [] }, { key: KEY })).body.claimed).toBe(false);

		// another device still on the key, signed out, is told to sign in
		signedInAs = null;
		const stale = await post({ cursor: 0, logs: [log('k3')] }, { key: KEY });
		expect(stale.status).toBe(409);
		expect(stale.body.error).toBe('key-claimed');
	});

	it('moved cards are pulled by a device that already caught up on the account', async () => {
		signedInAs = 1;
		const caught = await post({ cursor: 0, logs: [], cards: [card('a', 1), card('b', 1)], cardsCursor: 0 });
		signedInAs = null;
		await post({ cursor: 0, logs: [], cards: [card('c', 1)], cardsCursor: 0 }, { key: KEY });
		signedInAs = 1;
		await post({ cursor: 0, logs: [] }, { key: KEY });
		const later = await post({ cursor: caught.body.cursor, logs: [], cards: [], cardsCursor: caught.body.cardsCursor });
		expect(later.body.cards.map((c: { id: string }) => c.id)).toEqual(['word:c']);
	});

	it('refuses cross-origin writes', async () => {
		signedInAs = 1;
		expect((await post({ cursor: 0, logs: [] }, { origin: 'https://evil.test' })).status).toBe(403);
	});

	it('deleting the account deletes its synced progress', async () => {
		signedInAs = 1;
		await post({ cursor: 0, logs: [log('x')], cards: [card('x', 1)], cardsCursor: 0 });
		await deleteAccountData(env as never, 1);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM review_log`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT COUNT(*) AS n FROM user_cards`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT COUNT(*) AS n FROM users WHERE account_id = 1`).get()).toEqual({ n: 0 });
	});
});

const note = (subject: string, updatedAt: number, body = 'remember it', deleted = false) => ({
	subject,
	label: subject.slice(subject.indexOf(':') + 1),
	body,
	createdAt: 1,
	updatedAt,
	deleted
});

describe('personal notes', () => {
	it('sync between devices on one account, newest edit wins, deletes travel', async () => {
		signedInAs = 1;
		await post({ cursor: 0, logs: [], notes: [note('kana:あ', 5, 'like a fish'), note('word:neko', 5)], notesCursor: 0 });
		// an older edit from a slow device loses
		await post({ cursor: 0, logs: [], notes: [note('kana:あ', 3, 'stale')], notesCursor: 0 });
		// the other device deletes one
		await post({ cursor: 0, logs: [], notes: [note('word:neko', 9, '', true)], notesCursor: 0 });

		const pulled = await post({ cursor: 0, logs: [], notesCursor: 0 });
		const byId = Object.fromEntries(pulled.body.notes.map((n: { subject: string }) => [n.subject, n]));
		expect(byId['kana:あ'].body).toBe('like a fish');
		expect(byId['word:neko']).toMatchObject({ deleted: true, body: '' });
		// the cursor only returns what changed after it
		const again = await post({ cursor: 0, logs: [], notesCursor: pulled.body.notesCursor });
		expect(again.body.notes).toEqual([]);
	});

	it('are private to their account', async () => {
		signedInAs = 1;
		await post({ cursor: 0, logs: [], notes: [note('kanji:日', 2, 'sun')], notesCursor: 0 });
		signedInAs = 2;
		expect((await post({ cursor: 0, logs: [], notesCursor: 0 })).body.notes).toEqual([]);
	});

	it('refuses notes it does not understand', async () => {
		signedInAs = 1;
		expect((await post({ cursor: 0, logs: [], notes: [note('nope:x', 2)] })).status).toBe(400);
		expect((await post({ cursor: 0, logs: [], notes: [note('kana:あ', 2, 'x'.repeat(4001))] })).status).toBe(400);
	});

	it('older clients that send no notes get no notes back', async () => {
		signedInAs = 1;
		await post({ cursor: 0, logs: [], notes: [note('kana:い', 2)], notesCursor: 0 });
		expect((await post({ cursor: 0, logs: [] })).body.notes).toBeUndefined();
	});

	it('move with an old sync key into the account, and go with the account', async () => {
		await post({ cursor: 0, logs: [], notes: [note('kana:う', 4, 'from the key')], notesCursor: 0 }, { key: KEY });
		signedInAs = 1;
		const first = await post({ cursor: 0, logs: [], notes: [], notesCursor: 0 }, { key: KEY });
		expect(first.body.notes.map((n: { body: string }) => n.body)).toEqual(['from the key']);

		await deleteAccountData(env as never, 1);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM user_notes`).get()).toEqual({ n: 0 });
	});
});

describe('staying signed in', () => {
	const DAY = 24 * 60 * 60 * 1000;
	const expiry = () => (db.prepare(`SELECT expires_at AS e FROM sessions WHERE token_hash = 't'`).get() as { e: number }).e;
	beforeEach(() => {
		// a fresh 12-hour sign-in, as createSession makes it
		db.exec(
			`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'p', 'passkey', 1, 0, ${Date.now() + DAY / 2})`
		);
		signedInAs = 1;
	});

	it('a sync renews a sign-in to 400 days by default', async () => {
		const r = await post({ cursor: 0, logs: [] }, { cookie: 'bk_session=tok' });
		expect(r.setCookie).toMatch(/^bk_session=tok;.*Max-Age=34560000/);
		expect(expiry()).toBeGreaterThan(Date.now() + 399 * DAY);
		// not again until half of it has passed
		expect((await post({ cursor: 0, logs: [] }, { cookie: 'bk_session=tok' })).setCookie).toBeNull();
	});

	it('the lifetime is a setting, and lowering it cuts long sessions down', async () => {
		await post({ cursor: 0, logs: [] }, { cookie: 'bk_session=tok' });
		db.exec(`INSERT INTO ai_settings (key, value) VALUES ('session_ttl_days', '7')`);
		const r = await post({ cursor: 0, logs: [] }, { cookie: 'bk_session=tok' });
		expect(r.setCookie).toMatch(/Max-Age=604800/);
		expect(expiry()).toBeLessThanOrEqual(Date.now() + 7 * DAY);
	});

	it('falls back to the Worker var, and ignores nonsense', async () => {
		const { sessionTtlMs, parseSessionDays } = await import('./auth/session.ts');
		expect(await sessionTtlMs({ ...env, SESSION_TTL_DAYS: '30' } as never)).toBe(30 * DAY);
		expect(parseSessionDays('0')).toBe(400);
		expect(parseSessionDays('abc')).toBe(400);
		expect(parseSessionDays('9999')).toBe(400);
		expect(parseSessionDays('0.5')).toBe(0.5);
	});

	it('recovery sessions are never renewed', async () => {
		db.exec(`UPDATE sessions SET kind = 'recovery'`);
		const { renewSession } = await import('./auth/session.ts');
		const req = new Request('https://benkyo.test/api/sync', { headers: { cookie: 'bk_session=tok' } });
		expect(await renewSession(req, env as never, { tokenHash: 't', kind: 'recovery' } as never)).toBeNull();
	});
});
