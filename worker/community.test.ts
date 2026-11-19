import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from './auth/passkey.ts';
import { d1, migratedDb } from './test/d1.ts';
import { GUIDELINES_VERSION } from '../src/lib/community/contract.ts';

let session: Session | null = null;
vi.mock('./auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleCommunity, purgeCommunity, LIMITS, REMOVED_KEEP_DAYS } = await import('./community.ts');
const { accountDataStatements, closeAccountStatements } = await import('./ai/credentials.ts');
const { hasBlockedWords } = await import('./communityWords.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const DAY = 86_400_000;
const OLD = Date.now() - 30 * DAY;
const as = (id: number): Session => ({ tokenHash: `t${id}`, passkeyId: `pk${id}`, kind: 'passkey', userId: id, name: `U${id}`, isAdmin: false, appleLinked: false });

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Aoi', 'h1', 0, ${OLD}), (2, 'Mika', 'h2', 0, ${OLD}), (3, 'Ren', 'h3', 0, ${OLD}), (4, 'Sora', 'h4', 0, ${OLD}), (5, 'New', 'h5', 0, ${Date.now()})`);
	env = { DB: d1(db) };
});

async function call(id: number | null, method: string, path: string, body?: unknown) {
	session = id === null ? null : as(id);
	const url = new URL(`http://localhost:8787${path}`);
	try {
		const res = await handleCommunity(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url);
		return { status: res!.status, body: (await res!.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (!h.status) throw e;
		return { status: h.status, body: h.body as any };
	}
}
const join = (id: number, handle = `user${id}`) => call(id, 'PUT', '/api/community/profile', { handle, guidelines: GUIDELINES_VERSION });
const share = (id: number, body = 'Hook: 日 looks like a window with the sun in it', subject = 'kanji:日') =>
	call(id, 'POST', '/api/community/posts', { subject, label: '日', body, lang: 'en' });
const notesOn = (id: number, subject = 'kanji:日') => call(id, 'GET', `/api/community/subject?s=${encodeURIComponent(subject)}`);

describe('community profile', () => {
	it('needs a handle and the current guidelines before sharing', async () => {
		expect((await call(1, 'GET', '/api/community/me')).body).toMatchObject({ profile: null, canPost: false });
		expect((await share(1)).body.problem).toBe('needs_profile');
		expect((await call(1, 'PUT', '/api/community/profile', { handle: 'aoi', guidelines: 0 })).status).toBe(400);
		const ok = await call(1, 'PUT', '/api/community/profile', { handle: '@Aoi_Learns', guidelines: GUIDELINES_VERSION });
		expect(ok.body).toMatchObject({ profile: { handle: 'aoi_learns', status: 'active' }, canPost: true });
	});

	it('keeps handles unique and well formed', async () => {
		await join(1, 'sakura');
		expect((await join(2, 'SAKURA')).body.problem).toBe('handle_taken');
		expect((await join(2, '9lives')).body.problem).toBe('bad_handle');
		expect((await join(2, 'ab')).body.problem).toBe('bad_handle');
		expect((await join(1, 'sakura')).status).toBe(200); // your own handle again is fine
	});

	it('is signed in only', async () => {
		expect((await call(null, 'GET', '/api/community/me')).status).toBe(401);
	});
});

describe('shared notes', () => {
	beforeEach(async () => {
		for (const id of [1, 2, 3, 4]) await join(id);
	});

	it('shares one copy per item, updates it in place, and lists others first by likes', async () => {
		await share(1);
		const again = await share(1, 'Updated hook');
		expect(again.body).toMatchObject({ body: 'Updated hook', mine: true, status: 'published' });
		expect(again.body.editedAt).toBeTypeOf('number');
		await share(2, 'Second note');
		const p2 = (await notesOn(3)).body.posts.find((p: any) => p.handle === 'user2');
		await call(3, 'POST', '/api/community/like', { kind: 'post', id: p2.id, on: true });
		await call(4, 'POST', '/api/community/like', { kind: 'post', id: p2.id, on: true });

		const view = (await notesOn(3)).body;
		expect(view.total).toBe(2);
		expect(view.posts.map((p: any) => p.handle)).toEqual(['user2', 'user1']);
		expect(view.posts[0]).toMatchObject({ likes: 2, liked: true });
		expect(view.mine).toBeNull();
		const own = (await notesOn(1)).body;
		expect(own.mine.body).toBe('Updated hook');
		expect(own.posts.map((p: any) => p.handle)).toEqual(['user2']);
	});

	it('likes are one per person and can be taken back', async () => {
		const post = (await share(1)).body;
		await call(2, 'POST', '/api/community/like', { kind: 'post', id: post.id, on: true });
		const twice = await call(2, 'POST', '/api/community/like', { kind: 'post', id: post.id, on: true });
		expect(twice.body).toEqual({ liked: true, likes: 1 });
		expect((await call(2, 'POST', '/api/community/like', { kind: 'post', id: post.id, on: false })).body).toEqual({ liked: false, likes: 0 });
	});

	it('replies are one level, counted, and deleted with the note', async () => {
		const post = (await share(1)).body;
		const r = await call(2, 'POST', `/api/community/posts/${post.id}/replies`, { body: 'Nice one!', lang: 'en' });
		expect(r.body).toMatchObject({ handle: 'user2', mine: true, body: 'Nice one!' });
		const t = (await call(3, 'GET', `/api/community/posts/${post.id}`)).body;
		expect(t.post.replies).toBe(1);
		expect(t.replies.map((x: any) => x.body)).toEqual(['Nice one!']);
		expect((await call(2, 'DELETE', `/api/community/posts/${post.id}`)).status).toBe(404); // not yours
		await call(1, 'DELETE', `/api/community/posts/${post.id}`);
		expect((await call(3, 'GET', `/api/community/posts/${post.id}`)).status).toBe(404);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM community_replies`).get()).toEqual({ n: 0 });
	});

	it('refuses blocked words, too many links, and links in replies from new accounts', async () => {
		expect((await share(1, 'Get a casino bonus here')).body.problem).toBe('blocked_words');
		expect((await share(1, 'see https://a.example https://b.example https://c.example')).body.problem).toBe('too_many_links');
		expect((await share(1, 'see https://jisho.org/search/日')).status).toBe(200);
		const post = (await notesOn(2)).body.posts[0];
		await join(5);
		expect((await call(5, 'POST', `/api/community/posts/${post.id}/replies`, { body: 'look www.spam.example' })).body.problem).toBe('links_new_account');
		expect((await call(5, 'POST', `/api/community/posts/${post.id}/replies`, { body: 'Thanks!' })).status).toBe(200);
	});

	it('rate limits posts per day, lower for new accounts', async () => {
		await join(5);
		for (let i = 0; i < LIMITS.posts[1]; i++) expect((await share(5, `note ${i}`, `kana:${'あいうえお'[i]}`)).status).toBe(200);
		expect((await share(5, 'one more', 'kana:か')).body.problem).toBe('rate_limited');
	});

	it('hides a note after three people report it, and hides it only from others', async () => {
		const post = (await share(1)).body;
		for (const id of [2, 3]) await call(id, 'POST', '/api/community/report', { kind: 'post', id: post.id, reason: 'spam' });
		expect((await notesOn(4)).body.total).toBe(1);
		expect((await call(2, 'POST', '/api/community/report', { kind: 'post', id: post.id, reason: 'spam' })).body.problem).toBe('already_reported');
		expect((await call(1, 'POST', '/api/community/report', { kind: 'post', id: post.id, reason: 'spam' })).status).toBe(400); // own post
		await call(4, 'POST', '/api/community/report', { kind: 'post', id: post.id, reason: 'harassment', detail: 'rude' });
		expect((await notesOn(2)).body.total).toBe(0);
		expect((await notesOn(1)).body.mine.status).toBe('hidden'); // the author sees what happened
		// editing doesn't bring it back
		expect((await share(1, 'edited')).body.status).toBe('hidden');
	});

	it('blocking hides a person from you only, and can be undone', async () => {
		const post = (await share(1)).body;
		await call(2, 'POST', '/api/community/block', { kind: 'post', id: post.id });
		expect((await notesOn(2)).body.total).toBe(0);
		expect((await notesOn(3)).body.total).toBe(1);
		expect((await call(2, 'GET', '/api/community/blocks')).body.map((b: any) => b.handle)).toEqual(['user1']);
		await call(2, 'DELETE', '/api/community/blocks/user1');
		expect((await notesOn(2)).body.total).toBe(1);
	});

	it('hides posts of a closed account and of people banned from the community, without deleting them', async () => {
		await share(1);
		await share(2, 'other');
		await (env.DB as D1Database).batch(closeAccountStatements(env as never, 1));
		db.exec(`UPDATE community_profiles SET status = 'banned' WHERE account_id = 2`);
		expect((await notesOn(3)).body.total).toBe(0);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM community_posts`).get()).toEqual({ n: 2 });
	});

	it('muted people can read but not post', async () => {
		db.exec(`UPDATE community_profiles SET status = 'muted' WHERE account_id = 1`);
		expect((await share(1)).body.problem).toBe('muted');
		expect((await notesOn(1)).status).toBe(200);
	});

	it('the fleet Delete erases every community row of the account', async () => {
		const post = (await share(1)).body;
		const other = (await share(2, 'other')).body;
		await call(1, 'POST', `/api/community/posts/${other.id}/replies`, { body: 'hi' });
		await call(1, 'POST', '/api/community/like', { kind: 'post', id: other.id, on: true });
		await call(3, 'POST', `/api/community/posts/${post.id}/replies`, { body: 'under a note that goes' });
		await (env.DB as D1Database).batch(accountDataStatements(env as never, 1));
		for (const t of ['community_profiles', 'community_posts', 'community_replies', 'community_likes'])
			expect(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === 'community_profiles' || t === 'community_likes' ? 'account_id' : 'author_id'} = 1`).get()).toEqual({ n: 0 });
		expect(db.prepare(`SELECT reply_count AS r FROM community_posts WHERE id = ?`).get(other.id)).toEqual({ r: 0 });
		expect(db.prepare(`SELECT COUNT(*) AS n FROM community_replies`).get()).toEqual({ n: 0 });
	});

	it('the daily purge deletes content removed more than 90 days ago', async () => {
		const post = (await share(1)).body;
		const keep = (await share(2, 'kept')).body;
		db.exec(`UPDATE community_posts SET status = 'removed', removed_at = ${Date.now() - (REMOVED_KEEP_DAYS + 1) * DAY} WHERE id = ${post.id}`);
		db.exec(`UPDATE community_posts SET status = 'removed', removed_at = ${Date.now() - DAY} WHERE id = ${keep.id}`);
		expect(await purgeCommunity(env as never)).toMatchObject({ posts: 1 });
		expect(db.prepare(`SELECT id FROM community_posts`).all()).toEqual([{ id: keep.id }]);
	});
});

describe('blocked words', () => {
	it('sees through spacing, case and look-alike digits', () => {
		expect(hasBlockedWords('V I A G R A')).toBe(true);
		expect(hasBlockedWords('c4s1no bonus')).toBe(true);
		expect(hasBlockedWords('水牛 means water buffalo')).toBe(false);
		expect(hasBlockedWords('日 looks like the sun')).toBe(false);
	});
});
