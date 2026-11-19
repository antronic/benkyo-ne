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
const { putAvatar, parseAvatar } = await import('./avatar.ts');
const { meOf } = await import('./auth/passkey.ts');
const { handleCommunity } = await import('./community.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const as = (id: number): Session => ({ tokenHash: `t${id}`, passkeyId: `pk${id}`, kind: 'passkey', userId: id, name: `U${id}`, isAdmin: false, appleLinked: false });

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (1, 'Aoi', 'h1', 0, 1), (2, 'Mika', 'h2', 0, 1)`);
	env = { DB: d1(db) };
});

async function put(id: number | null, body: unknown) {
	session = id === null ? null : as(id);
	const req = new Request('http://localhost:8787/api/auth/avatar', { method: 'PUT', body: JSON.stringify(body) });
	try {
		const res = await putAvatar(req, env as never);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		if (!h.status) throw e;
		return { status: h.status, body: h.body as any };
	}
}
const row = (id: number) => db.prepare(`SELECT avatar, avatar_asked_at AS askedAt FROM accounts WHERE id = ?`).get(id) as { avatar: string | null; askedAt: number | null };

describe('PUT /api/auth/avatar', () => {
	it('needs a session', async () => {
		expect((await put(null, { avatar: { hair: 'bob' } })).status).toBe(401);
	});

	it('stores only known parts, compacted to the changes from the defaults', async () => {
		const r = await put(1, { avatar: { hair: 'bob', glasses: 'round', skin: 's4', photo: 'data:image/jpeg;base64,AAAA', mouth: 'shout' } });
		expect(r.status).toBe(200);
		expect(JSON.parse(row(1).avatar!)).toEqual({ hair: 'bob', glasses: 'round' });
		expect(r.body.account).toMatchObject({ avatar: { hair: 'bob', glasses: 'round' }, avatarAsked: true });
		expect(row(2).avatar).toBeNull();
	});

	it('removes the avatar with null, and rejects anything that is not parts', async () => {
		await put(1, { avatar: { hair: 'afro' } });
		expect((await put(1, { avatar: null })).body.account.avatar).toBeNull();
		expect(row(1).avatar).toBeNull();
		expect(row(1).askedAt).not.toBeNull();
		expect((await put(1, { avatar: 'bob' })).status).toBe(400);
		expect((await put(1, {})).status).toBe(400);
	});

	it('"Not now" answers the prompt once and keeps the first answer time', async () => {
		const me0 = await meOf(as(1), env as never);
		expect(me0.account).toMatchObject({ avatar: null, avatarAsked: false });
		expect((await put(1, { later: true })).body.account.avatarAsked).toBe(true);
		const first = row(1).askedAt;
		await put(1, { later: true });
		expect(row(1).askedAt).toBe(first);
		expect(row(1).avatar).toBeNull();
	});

	it('reads a damaged stored value as no avatar', () => {
		expect(parseAvatar('{not json')).toBeNull();
		expect(parseAvatar('[1,2]')).toBeNull();
		expect(parseAvatar('{"hair":"long","x":1}')).toEqual({ hair: 'long' });
	});
});

describe('avatars in community notes', () => {
	it('shows each author with their own avatar', async () => {
		await put(1, { avatar: { hair: 'bun', cloth: 'shu' } });
		for (const id of [1, 2]) {
			session = as(id);
			const req = (method: string, path: string, body?: unknown) => {
				const url = new URL(`http://localhost:8787${path}`);
				return handleCommunity(new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, url);
			};
			await req('PUT', '/api/community/profile', { handle: `user${id}`, guidelines: GUIDELINES_VERSION });
			db.exec(`UPDATE accounts SET created_at = 1`);
			await req('POST', '/api/community/posts', { subject: 'kanji:日', label: '日', body: `A note from ${id} about the sun`, lang: 'en' });
		}
		session = as(2);
		const url = new URL(`http://localhost:8787/api/community/subject?s=${encodeURIComponent('kanji:日')}`);
		const res = await handleCommunity(new Request(url), env as never, url);
		const body = (await res!.json()) as any;
		expect(body.posts.map((p: any) => [p.handle, p.avatar])).toEqual([['user1', { hair: 'bun', cloth: 'shu' }]]);
		expect(body.mine).toMatchObject({ handle: 'user2', avatar: null });
	});
});
