import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';
import { GUIDELINES_VERSION } from '../../src/lib/community/contract.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleAdmin } = await import('./routes.ts');
const { handleCommunity } = await import('../community.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const OLD = Date.now() - 30 * 86_400_000;
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
function admin(method: string, path: string, body?: unknown) {
	session = ADMIN;
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handleAdmin(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url));
}
function as(id: number, method: string, path: string, body?: unknown) {
	session = learner(id);
	const url = new URL(`http://localhost:8787${path}`);
	return run(() => handleCommunity(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url));
}
const stepUp = () => db.exec(`UPDATE sessions SET stepup_at = ${Date.now()} WHERE token_hash = 't'`);
const audit = () => db.prepare(`SELECT action, target_id AS target FROM admin_audit ORDER BY id`).all();
const notesOn = async (id: number) => (await as(id, 'GET', `/api/community/subject?s=${encodeURIComponent('kana:あ')}`)).body;

let postId: number;
beforeEach(async () => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Owner', 'h1', 1, ${OLD}), (2, 'Mika', 'h2', 0, ${OLD}), (3, 'Aoi', 'h3', 0, ${OLD}), (4, 'Ren', 'h4', 0, ${OLD}), (5, 'Sora', 'h5', 0, ${OLD})`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'pk1', 'passkey', 1, 0, ${Date.now() + 3_600_000})`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1' };
	for (const id of [2, 3, 4, 5]) await as(id, 'PUT', '/api/community/profile', { handle: `user${id}`, guidelines: GUIDELINES_VERSION });
	postId = (await as(2, 'POST', '/api/community/posts', { subject: 'kana:あ', label: 'あ', body: 'A note', lang: 'en' })).body.id;
});

const reportBy = async (ids: number[]) => {
	for (const id of ids) await as(id, 'POST', '/api/community/report', { kind: 'post', id: postId, reason: 'spam', detail: `from ${id}` });
};

describe('fleet community queue', () => {
	it('lists reported content with its reports and the author history', async () => {
		await reportBy([3]);
		const { body } = await admin('GET', '/api/admin/community');
		expect(body.stats).toMatchObject({ posts7d: 1, openReports: 1, hidden: 0, profiles: 4 });
		expect(body.queue).toHaveLength(1);
		expect(body.queue[0]).toMatchObject({ kind: 'post', id: postId, body: 'A note', openReports: 1, author: { handle: 'user2', posts: 1, removed: 0 } });
		expect(body.queue[0].reports).toEqual([expect.objectContaining({ reason: 'spam', detail: 'from 3' })]);
	});

	it('dismiss closes the reports and puts back a note that reports hid', async () => {
		await reportBy([3, 4, 5]);
		expect((await notesOn(3)).total).toBe(0);
		await admin('POST', '/api/admin/community/content', { kind: 'post', id: postId, action: 'dismiss' });
		expect((await notesOn(3)).total).toBe(1);
		expect((await admin('GET', '/api/admin/community')).body.queue).toHaveLength(0);
		expect(audit()).toEqual([{ action: 'community.dismiss', target: 2 }]);
	});

	it('remove needs a fresh passkey tap, then hides it for good and closes the reports', async () => {
		await reportBy([3]);
		expect((await admin('POST', '/api/admin/community/content', { kind: 'post', id: postId, action: 'remove' })).status).toBe(428);
		stepUp();
		await admin('POST', '/api/admin/community/content', { kind: 'post', id: postId, action: 'remove' });
		expect((await notesOn(3)).total).toBe(0);
		expect((await notesOn(2)).mine.status).toBe('removed'); // the author sees what happened
		const row = db.prepare(`SELECT status, removed_at AS at FROM community_posts WHERE id = ?`).get(postId) as any;
		expect(row.status).toBe('removed');
		expect(row.at).toBeTypeOf('number');
		expect(db.prepare(`SELECT status FROM community_reports`).all()).toEqual([{ status: 'actioned' }]);
		// restore brings it back
		await admin('POST', '/api/admin/community/content', { kind: 'post', id: postId, action: 'restore' });
		expect((await notesOn(3)).total).toBe(1);
	});

	it('mute and ban need step-up; a ban hides the author’s posts, unmuting needs none', async () => {
		expect((await admin('POST', '/api/admin/community/author', { accountId: 2, status: 'banned' })).status).toBe(428);
		stepUp();
		expect((await admin('POST', '/api/admin/community/author', { accountId: 2, status: 'banned' })).status).toBe(200);
		expect((await notesOn(3)).total).toBe(0);
		expect((await as(2, 'POST', '/api/community/posts', { subject: 'kana:い', body: 'x' })).body.problem).toBe('banned');
		db.exec(`UPDATE sessions SET stepup_at = NULL`);
		expect((await admin('POST', '/api/admin/community/author', { accountId: 2, status: 'active' })).status).toBe(200);
		expect((await notesOn(3)).total).toBe(1);
		expect(audit().map((a: any) => a.action)).toEqual(['community.banned', 'community.unmute']);
	});

	it('is admin only', async () => {
		session = learner(3);
		const url = new URL('http://localhost:8787/api/admin/community');
		expect((await run(() => handleAdmin(new Request(url), env as never, url))).status).toBe(403);
	});
});
