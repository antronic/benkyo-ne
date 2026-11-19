/**
 * Fleet console accounts API against a real SQLite (node:sqlite) with the
 * repo's migrations applied. Access is skipped with the localhost dev bypass;
 * the session is mocked so step-up and admin rules are exercised for real.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { CONSENT_VERSION } from '../../src/lib/beta/contract.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));

const { handleAdmin } = await import('./routes.ts');

function d1(db: DatabaseSync) {
	const stmt = (sql: string, args: unknown[] = []) => ({
		bind: (...a: unknown[]) => stmt(sql, a),
		first: async <T>() => (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
		all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
		run: async () => db.prepare(sql).run(...(args as never[])),
		exec: () => ({ results: db.prepare(sql).all(...(args as never[])) })
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

const NOW = Date.now();
let db: DatabaseSync;
let env: { DB: D1Database; CONTENT: KVNamespace; DEV_AUTH_BYPASS: string };

beforeEach(() => {
	db = new DatabaseSync(':memory:');
	const dir = new URL('../migrations/', import.meta.url);
	for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at, last_seen_at) VALUES
		(1, 'Owner', 'h1', 1, 0, ${NOW}),
		(2, 'Mika', 'h2', 0, 0, ${NOW - 1000}),
		(3, 'Ken', 'h3', 0, 0, NULL),
		(4, 'Other admin', 'h4', 1, 0, NULL)`);
	db.exec(`INSERT INTO passkeys (id, public_key, created_at, user_id, name) VALUES ('pk1', 'x', 0, 1, 'Mac'), ('pk2', 'x', 0, 2, 'iPhone')`);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES
		('admin-token', 'pk1', 'passkey', 1, 0, ${NOW + 3_600_000}),
		('mika-token', 'pk2', 'passkey', 2, 0, ${NOW + 3_600_000})`);
	db.exec(`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd, user_id) VALUES
		(${NOW}, 'fill', 'anthropic', 'm1', 'done', 0.25, 2),
		(${NOW}, 'fill', 'anthropic', 'm1', 'failed', 9, 2)`);
	db.exec(`INSERT INTO beta_consents (user_id, version, accepted_at) VALUES (2, ${CONSENT_VERSION}, ${NOW})`);
	env = { DB: d1(db) as unknown as D1Database, CONTENT: {} as KVNamespace, DEV_AUTH_BYPASS: '1' };
	session = { tokenHash: 'admin-token', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
});

async function call(method: string, path: string, body?: unknown) {
	const url = new URL(`http://localhost:8787${path}`);
	const req = new Request(url, {
		method,
		headers: body === undefined ? {} : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	try {
		const res = await handleAdmin(req, env as never, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		return { status: h.status, body: h.body as any };
	}
}
const stepUp = (agoMs = 0) => db.exec(`UPDATE sessions SET stepup_at = ${Date.now() - agoMs} WHERE token_hash = 'admin-token'`);
const audit = () => db.prepare(`SELECT action, target_id, actor_email FROM admin_audit ORDER BY id`).all();

describe('reading accounts', () => {
	it('lists accounts, most recently seen first, with spend and consent', async () => {
		const r = await call('GET', '/api/admin/accounts');
		expect(r.status).toBe(200);
		expect(r.body.accounts.map((a: any) => a.name)).toEqual(['Owner', 'Mika', 'Other admin', 'Ken']);
		const mika = r.body.accounts[1];
		expect(mika).toMatchObject({ monthUsd: 0.25, consented: true, passkeys: 1, isAdmin: false, disabled: false });
		expect(r.body.next).toBeNull();
	});

	it('searches by name or id and treats % and _ literally', async () => {
		expect((await call('GET', '/api/admin/accounts?q=mik')).body.accounts.map((a: any) => a.id)).toEqual([2]);
		expect((await call('GET', '/api/admin/accounts?q=%233')).body.accounts.map((a: any) => a.id)).toEqual([3]);
		expect((await call('GET', '/api/admin/accounts?q=%25')).body.accounts).toEqual([]);
	});

	it('shows a detail page without session tokens', async () => {
		const r = await call('GET', '/api/admin/accounts/2');
		expect(r.body.passkeyList.map((p: any) => p.name)).toEqual(['iPhone']);
		expect(r.body.sessions).toHaveLength(1);
		expect(JSON.stringify(r.body)).not.toContain('mika-token');
		expect(r.body.spendByModel).toEqual([{ feature: 'fill', provider: 'anthropic', model: 'm1', calls: 1, usd: 0.25 }]);
		expect(r.body.recoveryCode).toBe('none');
		expect((await call('GET', '/api/admin/accounts/99')).status).toBe(404);
	});

	it('refuses non-admin and recovery sessions', async () => {
		session = { ...session!, isAdmin: false };
		expect((await call('GET', '/api/admin/accounts')).status).toBe(403);
		session = { ...session!, isAdmin: true, kind: 'recovery' };
		expect((await call('GET', '/api/admin/accounts')).status).toBe(403);
		session = null;
		expect((await call('GET', '/api/admin/accounts')).status).toBe(401);
	});
});

describe('changing accounts', () => {
	it('needs a passkey tap from the last 5 minutes', async () => {
		let r = await call('PATCH', '/api/admin/accounts/2', { disabled: true });
		expect(r.status).toBe(428);
		expect(r.body.error).toBe('stepup_required');
		stepUp(6 * 60_000);
		expect((await call('PATCH', '/api/admin/accounts/2', { disabled: true })).status).toBe(428);
		stepUp();
		r = await call('PATCH', '/api/admin/accounts/2', { disabled: true });
		expect(r.status).toBe(200);
		expect(r.body.disabled).toBe(true);
		expect(audit()).toEqual([{ action: 'account.disable', target_id: 2, actor_email: 'dev@localhost' }]);
	});

	it('disabling ends the account’s sessions; enabling brings it back', async () => {
		stepUp();
		await call('PATCH', '/api/admin/accounts/2', { disabled: true });
		expect(db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = 2`).get()).toEqual({ n: 0 });
		const r = await call('PATCH', '/api/admin/accounts/2', { disabled: false });
		expect(r.body.disabled).toBe(false);
		expect(audit().map((a: any) => a.action)).toEqual(['account.disable', 'account.enable']);
	});

	it('won’t disable or delete yourself or another admin', async () => {
		stepUp();
		expect((await call('PATCH', '/api/admin/accounts/1', { disabled: true })).status).toBe(400);
		expect((await call('PATCH', '/api/admin/accounts/4', { disabled: true })).status).toBe(400);
		expect((await call('DELETE', '/api/admin/accounts/4', { confirm: 'Other admin' })).status).toBe(400);
		expect((await call('POST', '/api/admin/accounts/1/revoke')).status).toBe(400);
		expect(audit()).toEqual([]);
	});

	it('changes the cap within limits', async () => {
		stepUp();
		expect((await call('PATCH', '/api/admin/accounts/2', { capUsd: -1 })).status).toBe(400);
		expect((await call('PATCH', '/api/admin/accounts/2', { capUsd: 5000 })).status).toBe(400);
		expect((await call('PATCH', '/api/admin/accounts/2', {})).status).toBe(400);
		const r = await call('PATCH', '/api/admin/accounts/2', { capUsd: 12.345 });
		expect(r.body.capUsd).toBe(12.35);
		const row = db.prepare(`SELECT detail_json FROM admin_audit`).get() as { detail_json: string };
		expect(JSON.parse(row.detail_json)).toEqual({ from: 5, to: 12.35 });
	});

	it('revokes sessions', async () => {
		stepUp();
		const r = await call('POST', '/api/admin/accounts/2/revoke');
		expect(r.body.sessions).toEqual([]);
		expect(audit().map((a: any) => a.action)).toEqual(['account.revoke_sessions']);
	});

	it('deletes only when the name is typed exactly, and keeps the audit row', async () => {
		stepUp();
		expect((await call('DELETE', '/api/admin/accounts/2', { confirm: 'mika' })).status).toBe(400);
		expect((await call('DELETE', '/api/admin/accounts/2', { confirm: 'Mika' })).body).toEqual({ ok: true });
		for (const t of ['accounts WHERE id', 'passkeys WHERE user_id', 'sessions WHERE user_id', 'ai_ledger WHERE user_id', 'beta_consents WHERE user_id'])
			expect(db.prepare(`SELECT COUNT(*) AS n FROM ${t} = 2`).get()).toEqual({ n: 0 });
		expect(audit()).toEqual([{ action: 'account.delete', target_id: 2, actor_email: 'dev@localhost' }]);
	});
});
