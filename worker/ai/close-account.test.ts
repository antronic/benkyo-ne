/**
 * The person's own "Delete account" closes the account (disabled, signed out,
 * API keys gone) and keeps its data, research data included. The Fleet
 * console's Delete still erases everything.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { d1, migratedDb } from '../test/d1.ts';
import { accountDataStatements, closeAccountStatements } from './credentials.ts';

let db: DatabaseSync;
let env: { DB: D1Database };
const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = 2`).get() as { n: number }).n;

beforeEach(() => {
	db = migratedDb();
	env = { DB: d1(db) };
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (2, 'Learner', 'h2', 0, 0)`);
	db.exec(`INSERT INTO beta_consents (user_id, version, accepted_at, user_agent) VALUES (2, 2, 1, 'UA')`);
	db.exec(`INSERT INTO beta_events (user_id, received_at, at, kind, name) VALUES (2, 1, 1, 'progress', 'review')`);
	db.exec(`INSERT INTO beta_ai_calls (user_id, at, kind, status, prompt_user) VALUES (2, 1, 'ask', 'done', 'hello')`);
	db.exec(
		`INSERT INTO ai_credentials (provider, label, key_cipher, key_iv, key_last4, created_at, user_id) VALUES ('anthropic', 'k', 'c', 'iv', '1234', 0, 2)`
	);
	db.exec(`INSERT INTO sessions (token_hash, passkey_id, kind, user_id, created_at, expires_at) VALUES ('t', 'p', 'passkey', 2, 0, ${Date.now() + 1e9})`);
});

describe('closing an account', () => {
	it('disables it, signs it out and deletes its API keys', async () => {
		await env.DB.batch(closeAccountStatements(env as never, 2));
		expect(db.prepare(`SELECT disabled FROM accounts WHERE id = 2`).get()).toEqual({ disabled: 1 });
		expect(count('sessions')).toBe(0);
		expect(count('ai_credentials')).toBe(0);
	});

	it('keeps all research data, linked to the account', async () => {
		await env.DB.batch(closeAccountStatements(env as never, 2));
		expect(count('beta_events')).toBe(1);
		expect(count('beta_consents')).toBe(1);
		expect(db.prepare(`SELECT prompt_user FROM beta_ai_calls WHERE user_id = 2`).get()).toEqual({ prompt_user: 'hello' });
	});

	it('records the close in the Fleet audit log', async () => {
		await env.DB.batch(closeAccountStatements(env as never, 2));
		expect(db.prepare(`SELECT action, actor_id AS actor, target_id AS target FROM admin_audit`).all()).toEqual([
			{ action: 'account.close', actor: 2, target: 2 }
		]);
	});

	it('the Fleet console Delete still erases everything', async () => {
		await env.DB.batch(accountDataStatements(env as never, 2));
		for (const table of ['beta_events', 'beta_ai_calls', 'beta_consents', 'ai_credentials', 'sessions']) expect(count(table), table).toBe(0);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE id = 2`).get()).toEqual({ n: 0 });
	});
});
