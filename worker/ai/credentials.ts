/**
 * Provider credentials (docs/AI-PLAN.md D4): AES-GCM encrypted in D1,
 * write-only from the app. Only `last4` is ever returned.
 */
import type { CredentialInfo, CredentialInput, ProviderKind } from '../../src/lib/ai/contract.ts';
import { deriveKey, open, seal } from '../crypto.ts';
import type { Env } from '../env.ts';
import { httpError, isLocalhost } from '../http.ts';
import { deleteSyncStatements } from '../sync.ts';

export interface CredRow {
	id: number;
	provider: ProviderKind;
	base_url: string | null;
	label: string;
	key_cipher: string;
	key_iv: string;
	key_last4: string;
	created_at: number;
	user_id: number;
	aad_version: number;
}

export const toInfo = (r: CredRow): CredentialInfo => ({
	id: r.id,
	provider: r.provider,
	label: r.label,
	baseUrl: r.base_url,
	last4: r.key_last4,
	createdAt: r.created_at
});

/**
 * Ciphertexts are bound (AES-GCM additional data) to provider + base URL and,
 * from version 2, to the owning account: a row copied to another account
 * can't be decrypted. Version 1 rows are the single-owner keys from before accounts.
 */
export const credentialAad = (provider: ProviderKind, baseUrl: string | null, userId?: number) =>
	userId === undefined ? `ai-cred|${provider}|${baseUrl ?? ''}` : `ai-cred|v2|u${userId}|${provider}|${baseUrl ?? ''}`;

const aadOf = (r: Pick<CredRow, 'provider' | 'base_url' | 'user_id' | 'aad_version'>) =>
	credentialAad(r.provider, r.base_url, r.aad_version >= 2 ? r.user_id : undefined);

export async function listCredentials(env: Env, userId: number): Promise<CredRow[]> {
	const { results } = await env.DB.prepare(`SELECT * FROM ai_credentials WHERE user_id = ?1 ORDER BY id`)
		.bind(userId)
		.all<CredRow>();
	return results;
}

export async function getCredential(env: Env, userId: number, id: number): Promise<CredRow | null> {
	return (
		(await env.DB.prepare(`SELECT * FROM ai_credentials WHERE id = ?1 AND user_id = ?2`).bind(id, userId).first<CredRow>()) ??
		null
	);
}

/**
 * https only; plain http is accepted only for localhost while the Worker
 * itself runs on localhost (wrangler dev). No credentials, query or hash.
 */
export function normalizeBaseUrl(raw: unknown, workerUrl: URL): string {
	if (typeof raw !== 'string' || !raw.trim()) throw httpError(400, 'bad_request', 'baseUrl is required');
	let u: URL;
	try {
		u = new URL(raw.trim());
	} catch {
		throw httpError(400, 'bad_request', 'baseUrl is not a valid URL');
	}
	const devHttp = u.protocol === 'http:' && isLocalhost(u.hostname) && isLocalhost(workerUrl.hostname);
	if (u.protocol !== 'https:' && !devHttp) throw httpError(400, 'bad_request', 'baseUrl must use https');
	if (u.username || u.password || u.search || u.hash)
		throw httpError(400, 'bad_request', 'baseUrl must not contain credentials, a query or a fragment');
	return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

const MAX_KEYS_PER_ACCOUNT = 10;

export async function createCredential(env: Env, userId: number, body: unknown, workerUrl: URL): Promise<CredentialInfo> {
	const b = (body ?? {}) as Partial<CredentialInput>;
	if (b.provider !== 'anthropic' && b.provider !== 'openai-compatible')
		throw httpError(400, 'bad_request', 'provider must be anthropic or openai-compatible');
	const label = typeof b.label === 'string' ? b.label.trim() : '';
	if (!label || label.length > 60) throw httpError(400, 'bad_request', 'label must be 1–60 characters');
	const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : '';
	if (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey))
		throw httpError(400, 'bad_request', 'apiKey looks invalid');
	const baseUrl = b.provider === 'openai-compatible' ? normalizeBaseUrl(b.baseUrl, workerUrl) : null;

	const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ai_credentials WHERE user_id = ?1`).bind(userId).first<{ n: number }>();
	if ((n?.n ?? 0) >= MAX_KEYS_PER_ACCOUNT) throw httpError(400, 'bad_request', `Up to ${MAX_KEYS_PER_ACCOUNT} keys per account`);

	const key = await masterKey(env);
	const sealed = await seal(key, apiKey, credentialAad(b.provider, baseUrl, userId));
	const row = await env.DB.prepare(
		`INSERT INTO ai_credentials (provider, base_url, label, key_cipher, key_iv, key_last4, created_at, user_id, aad_version)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 2) RETURNING *`
	)
		.bind(b.provider, baseUrl, label, sealed.cipher, sealed.iv, apiKey.slice(-4), Date.now(), userId)
		.first<CredRow>();
	return toInfo(row!);
}

export async function deleteCredential(env: Env, userId: number, id: number): Promise<boolean> {
	const res = await env.DB.batch([
		env.DB.prepare(`DELETE FROM ai_feature_models WHERE credential_id = ?1 AND user_id = ?2`).bind(id, userId),
		env.DB.prepare(`DELETE FROM ai_credentials WHERE id = ?1 AND user_id = ?2`).bind(id, userId)
	]);
	return (res[1].meta.changes ?? 0) > 0;
}

/** Delete an account and everything tied to it (keys first). */
export async function deleteAccountData(env: Env, userId: number) {
	await env.DB.batch(accountDataStatements(env, userId));
}

/** Every statement that deletes an account and its data (also used by the fleet console). */
export function accountDataStatements(env: Env, userId: number): D1PreparedStatement[] {
	return [
		// synced learning progress (worker/sync.ts); the copy on each device stays
		...deleteSyncStatements(env.DB, userId),
		env.DB.prepare(`DELETE FROM ai_credentials WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM ai_feature_models WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM ai_model_prices WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM ai_ledger WHERE user_id = ?1`).bind(userId),
		// beta usage data and consent history (worker/beta/routes.ts)
		env.DB.prepare(`DELETE FROM beta_events WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM beta_ai_calls WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM beta_consents WHERE user_id = ?1`).bind(userId),
		// packages granted from the fleet console
		env.DB.prepare(`DELETE FROM plan_grants WHERE account_id = ?1`).bind(userId),
		// promo codes it redeemed (the code's use count stays)
		env.DB.prepare(`DELETE FROM promo_redemptions WHERE account_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM recovery_codes WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM auth_challenges WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM passkeys WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM apple_identities WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM apple_states WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM accounts WHERE id = ?1`).bind(userId)
	];
}

async function masterKey(env: Env) {
	try {
		return await deriveKey(env.AI_MASTER_KEY);
	} catch (e) {
		throw httpError(503, 'provider', `Server misconfigured: ${(e as Error).message}`);
	}
}

export async function decryptKey(env: Env, row: CredRow): Promise<string> {
	const key = await masterKey(env);
	try {
		return await open(key, { cipher: row.key_cipher, iv: row.key_iv }, aadOf(row));
	} catch {
		throw httpError(503, 'provider', 'Stored API key could not be decrypted (was AI_MASTER_KEY changed?)');
	}
}
