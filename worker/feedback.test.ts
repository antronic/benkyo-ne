import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from './auth/passkey.ts';
import { d1, migratedDb } from './test/d1.ts';

let session: Session | null = null;
vi.mock('./auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleFeedback, purgeFeedback, FEEDBACK_LIMITS, REPORT_KEEP_DAYS } = await import('./feedback.ts');
const { handleAdmin } = await import('./admin/routes.ts');
const { accountDataStatements } = await import('./ai/credentials.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const ADMIN: Session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
const learner = (id: number): Session => ({ tokenHash: `t${id}`, passkeyId: `pk${id}`, kind: 'passkey', userId: id, name: `L${id}`, isAdmin: false, appleLinked: false });

async function run(fn: () => Promise<Response | null>) {
	try {
		const res = (await fn())!;
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (!h.status) throw e;
		return { status: h.status, body: h.body as any };
	}
}
function as(id: number | null, method: string, path: string, body?: unknown) {
	session = id === null ? null : learner(id);
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handleFeedback(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url));
}
function admin(method: string, path: string, body?: unknown) {
	session = ADMIN;
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handleAdmin(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url));
}
const vote = (id: number, subject: string, v: number) => as(id, 'POST', '/api/feedback/vote', { subject, label: subject.split(':')[1], vote: v });
const report = (id: number, subject: string, reason = 'wrong', detail = '') =>
	as(id, 'POST', '/api/feedback/report', { subject, label: 'label', reason, detail, locale: 'th' });

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0), (3, 'Aoi', 'h3', 0, 0)`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${Date.now() + 3_600_000})`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1' };
});

describe('learner feedback', () => {
	it('needs a sign-in', async () => {
		expect((await as(null, 'GET', '/api/feedback/mine')).status).toBe(401);
		expect((await as(null, 'POST', '/api/feedback/vote', { subject: 'kanji:日', vote: 1 })).status).toBe(401);
	});

	it('keeps one vote per person per subject, changes it, and takes it back', async () => {
		await vote(2, 'kanji:日', 1);
		await vote(2, 'kanji:日', -1);
		await vote(2, 'unit:n5-01', 1);
		await vote(3, 'kanji:日', -1);
		expect((await as(2, 'GET', '/api/feedback/mine')).body).toEqual({ votes: { 'kanji:日': -1, 'unit:n5-01': 1 } });
		await vote(2, 'unit:n5-01', 0);
		expect((await as(2, 'GET', '/api/feedback/mine')).body).toEqual({ votes: { 'kanji:日': -1 } });
		expect((await as(3, 'GET', '/api/feedback/mine')).body).toEqual({ votes: { 'kanji:日': -1 } });
	});

	it('refuses unknown content and bad votes', async () => {
		expect((await vote(2, 'post:12', 1)).status).toBe(400);
		expect((await vote(2, 'kanji:', 1)).status).toBe(400);
		expect((await vote(2, 'kanji:日', 2)).status).toBe(400);
		expect((await report(2, 'kanji:日', 'spam')).status).toBe(400);
	});

	it('takes one open report per person per subject, with its reason, detail and language', async () => {
		expect((await report(2, 'grammar:n5-16-te-kudasai', 'translation', '  The Thai is off  ')).body).toEqual({ ok: true });
		const again = await report(2, 'grammar:n5-16-te-kudasai');
		expect(again.status).toBe(409);
		expect(again.body.problem).toBe('already_reported');
		expect((await report(3, 'grammar:n5-16-te-kudasai')).status).toBe(200);
		const rows = db.prepare(`SELECT account_id AS who, reason, detail, locale, status FROM content_reports ORDER BY id`).all();
		expect(rows).toEqual([
			{ who: 2, reason: 'translation', detail: 'The Thai is off', locale: 'th', status: 'open' },
			{ who: 3, reason: 'wrong', detail: '', locale: 'th', status: 'open' }
		]);
	});

	it('limits reports per day', async () => {
		for (let i = 0; i < FEEDBACK_LIMITS.reports; i++) expect((await report(2, `word:${i}`)).status).toBe(200);
		expect((await report(2, 'word:one-more')).status).toBe(429);
	});

	it('is erased with the account', async () => {
		await vote(2, 'kanji:日', 1);
		await report(2, 'kanji:日');
		await (env.DB as any).batch(accountDataStatements(env as never, 2));
		expect(db.prepare(`SELECT COUNT(*) AS n FROM content_votes`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT COUNT(*) AS n FROM content_reports`).get()).toEqual({ n: 0 });
	});
});

describe('fleet feedback', () => {
	it('lists the most reported and down-voted content and open reports', async () => {
		await vote(2, 'kanji:日', 1);
		await vote(3, 'kanji:日', 1);
		await vote(2, 'word:1', -1);
		await vote(3, 'word:1', -1);
		await vote(2, 'unit:n5-01', -1);
		await report(3, 'unit:n5-01', 'confusing', 'Too fast');
		const { status, body } = await admin('GET', '/api/admin/feedback');
		expect(status).toBe(200);
		expect(body).toMatchObject({ up: 2, down: 3, open: 1 });
		expect(body.subjects.map((s: any) => [s.subject, s.up, s.down, s.open])).toEqual([
			['unit:n5-01', 0, 1, 1],
			['word:1', 0, 2, 0],
			['kanji:日', 2, 0, 0]
		]);
		expect(body.reports).toMatchObject([{ subject: 'unit:n5-01', reason: 'confusing', detail: 'Too fast', locale: 'th' }]);
	});

	it('marks a report fixed or dismissed, audited, and lets the learner report again', async () => {
		await report(2, 'kanji:日');
		const id = (db.prepare(`SELECT id FROM content_reports`).get() as { id: number }).id;
		expect((await admin('POST', '/api/admin/feedback/report', { id, status: 'fixed' })).status).toBe(200);
		expect((await admin('GET', '/api/admin/feedback')).body.reports).toEqual([]);
		expect(db.prepare(`SELECT action, target_id AS target FROM admin_audit`).all()).toEqual([{ action: 'feedback.fixed', target: id }]);
		expect((await report(2, 'kanji:日')).status).toBe(200);
		expect((await admin('POST', '/api/admin/feedback/report', { id, status: 'gone' })).status).toBe(400);
		expect((await admin('POST', '/api/admin/feedback/report', { id: 999, status: 'fixed' })).status).toBe(404);
	});

	it('forgets handled reports after the keep period', async () => {
		await report(2, 'kanji:日');
		await report(3, 'kanji:日');
		const now = Date.now();
		db.exec(`UPDATE content_reports SET status = 'dismissed', handled_at = ${now - (REPORT_KEEP_DAYS + 1) * 86_400_000} WHERE account_id = 2`);
		expect(await purgeFeedback(env as never, now)).toBe(1);
		expect(db.prepare(`SELECT account_id AS who FROM content_reports`).all()).toEqual([{ who: 3 }]);
	});

	it('is admin only', async () => {
		session = learner(2);
		const url = new URL('http://localhost:8787/api/admin/feedback');
		const r = await run(() => handleAdmin(new Request(url), env as never, url));
		expect(r.status).toBeGreaterThanOrEqual(401);
	});
});
