/**
 * POST /api/ai/translate (docs/COMMUNITY.md): the Worker reads the note itself,
 * only one the learner may see, and runs it on the translate model (Haiku
 * by default on an own Anthropic key, the cheapest model on a package).
 */
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
vi.mock('../beta/routes.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../beta/routes.ts')>()),
	requireConsent: async () => {},
	recordAiCall: async () => {}
}));
const calls: { model: string; user: string }[] = [];
let reply: unknown = { text: 'Picture a window with the sun in it.' };
vi.mock('./anthropic.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./anthropic.ts')>()),
	callAnthropic: async (parts: { user: string }, model: string) => {
		calls.push({ model, user: parts.user });
		return { ok: true, text: JSON.stringify(reply), usage: [{ model, input: 300, output: 80 }] };
	}
}));

const { handleAi } = await import('./routes.ts');
const { seal, deriveKey, b64encode } = await import('../crypto.ts');
const { credentialAad } = await import('./credentials.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

async function call(body: unknown, path = '/api/ai/translate') {
	const url = new URL(`http://localhost:8787${path}`);
	const req = new Request(url, { method: 'POST', body: JSON.stringify(body) });
	try {
		const res = await handleAi(req, env as never, ctx, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		return { status: h.status, body: h.body as any };
	}
}

async function addOwnKey(userId: number) {
	const key = await deriveKey(env.AI_MASTER_KEY as string);
	const s = await seal(key, 'sk-ant-own', credentialAad('anthropic', null, userId));
	db.prepare(
		`INSERT INTO ai_credentials (id, provider, base_url, label, key_cipher, key_iv, key_last4, created_at, user_id, aad_version)
		 VALUES (5, 'anthropic', NULL, 'Mine', ?, ?, '0own', 0, ?, 2)`
	).run(s.cipher, s.iv, userId);
}

beforeEach(async () => {
	calls.length = 0;
	reply = { text: 'Picture a window with the sun in it.' };
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (2, 'Mika', 'h2', 0, 0), (3, 'Mai', 'h3', 0, 0)`);
	db.exec(`INSERT INTO community_profiles (account_id, handle, guidelines_version, status, created_at, updated_at) VALUES (3, 'mai.th', 1, 'active', 0, 0)`);
	db.exec(`INSERT INTO community_posts (id, author_id, type, subject, label, body, lang, status, created_at)
		VALUES (1, 3, 'note', 'kanji:日', '日', 'จำว่าเป็นหน้าต่างที่มีพระอาทิตย์', 'th', 'published', 0),
		       (2, 3, 'note', 'kanji:月', '月', 'ซ่อนไว้', 'th', 'hidden', 0)`);
	db.exec(`INSERT INTO community_replies (id, post_id, author_id, body, lang, status, created_at) VALUES (9, 1, 3, 'ขอบคุณ', 'th', 'published', 0)`);
	env = { DB: d1(db), AI_MASTER_KEY: b64encode(randomBytes(32)) };
	session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 2, name: 'Mika', isAdmin: false, appleLinked: false };
	await addOwnKey(2);
});

describe('translate', () => {
	it('translates a visible note on the smallest model and reads the text from D1', async () => {
		const r = await call({ kind: 'post', id: 1, to: 'en' });
		expect(r).toEqual({ status: 200, body: { text: 'Picture a window with the sun in it.', to: 'en' } });
		expect(calls).toHaveLength(1);
		expect(calls[0].model).toBe('claude-haiku-5-5');
		expect(calls[0].user).toContain('จำว่าเป็นหน้าต่างที่มีพระอาทิตย์');
		expect(calls[0].user).toContain('Target language: English');
		const row = db.prepare(`SELECT feature, model, status FROM ai_ledger`).get();
		expect(row).toEqual({ feature: 'translate', model: 'claude-haiku-5-5', status: 'done' });
	});

	it('translates replies too', async () => {
		expect((await call({ kind: 'reply', id: 9, to: 'ja' })).status).toBe(200);
	});

	it('uses the model the learner picked for translate', async () => {
		db.exec(`INSERT INTO ai_feature_models (user_id, feature, credential_id, model) VALUES (2, 'translate', 5, 'claude-sonnet-5-5')`);
		await call({ kind: 'post', id: 1, to: 'en' });
		expect(calls[0].model).toBe('claude-sonnet-5-5');
	});

	it('refuses notes the learner can’t see, and ones already in that language', async () => {
		expect((await call({ kind: 'post', id: 2, to: 'en' })).status).toBe(404);
		expect((await call({ kind: 'post', id: 99, to: 'en' })).status).toBe(404);
		db.exec(`INSERT INTO community_blocks (account_id, blocked_id, created_at) VALUES (2, 3, 0)`);
		expect((await call({ kind: 'post', id: 1, to: 'en' })).status).toBe(404);
		db.exec(`DELETE FROM community_blocks`);
		expect((await call({ kind: 'post', id: 1, to: 'th' })).status).toBe(400);
		expect(calls).toHaveLength(0);
	});

	it('rejects a bad request without calling the model', async () => {
		expect((await call({ kind: 'post', id: 1, to: 'fr' })).status).toBe(400);
		expect((await call({ kind: 'thread', id: 1, to: 'en' })).status).toBe(400);
		expect((await call({ text: 'translate this', to: 'en' })).status).toBe(400);
		expect(calls).toHaveLength(0);
	});

	it('says the reply was unusable when the model returns no text', async () => {
		reply = { text: '' };
		const r = await call({ kind: 'post', id: 1, to: 'en' });
		expect(r.status).toBe(502);
		expect(r.body.error).toBe('invalid_output');
	});

	it('lets a learner pick a model for translate', async () => {
		const url = new URL('http://localhost:8787/api/ai/features');
		const res = await handleAi(new Request(url, { method: 'PUT', body: JSON.stringify({ feature: 'translate', credentialId: 5, model: 'claude-haiku-5-5' }) }), env as never, ctx, url);
		expect(res.status).toBe(200);
		expect(db.prepare(`SELECT feature, model FROM ai_feature_models WHERE user_id = 2`).all()).toEqual([{ feature: 'translate', model: 'claude-haiku-5-5' }]);
	});
});
