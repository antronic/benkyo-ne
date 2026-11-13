/**
 * Provider credentials (docs/AI-PLAN.md D4): AES-GCM encrypted in D1,
 * write-only from the app. Only `last4` is ever returned.
 */
import type { CredentialInfo, CredentialInput, ProviderKind } from '../../src/lib/ai/contract.ts';
import { deriveKey, open, seal } from '../crypto.ts';
import type { Env } from '../env.ts';
import { httpError, isLocalhost } from '../http.ts';

export interface CredRow {
	id: number;
	provider: ProviderKind;
	base_url: string | null;
	label: string;
	key_cipher: string;
	key_iv: string;
	key_last4: string;
	created_at: number;
}

export const toInfo = (r: CredRow): CredentialInfo => ({
	id: r.id,
	provider: r.provider,
	label: r.label,
	baseUrl: r.base_url,
	last4: r.key_last4,
	createdAt: r.created_at
});

/** Ciphertexts are bound to provider + base URL (AES-GCM additional data). */
export const credentialAad = (provider: ProviderKind, baseUrl: string | null) => `ai-cred|${provider}|${baseUrl ?? ''}`;

export async function listCredentials(env: Env): Promise<CredRow[]> {
	const { results } = await env.DB.prepare(`SELECT * FROM ai_credentials ORDER BY id`).all<CredRow>();
	return results;
}

export async function getCredential(env: Env, id: number): Promise<CredRow | null> {
	return (await env.DB.prepare(`SELECT * FROM ai_credentials WHERE id = ?1`).bind(id).first<CredRow>()) ?? null;
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

export async function createCredential(env: Env, body: unknown, workerUrl: URL): Promise<CredentialInfo> {
	const b = (body ?? {}) as Partial<CredentialInput>;
	if (b.provider !== 'anthropic' && b.provider !== 'openai-compatible')
		throw httpError(400, 'bad_request', 'provider must be anthropic or openai-compatible');
	const label = typeof b.label === 'string' ? b.label.trim() : '';
	if (!label || label.length > 60) throw httpError(400, 'bad_request', 'label must be 1–60 characters');
	const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : '';
	if (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey))
		throw httpError(400, 'bad_request', 'apiKey looks invalid');
	const baseUrl = b.provider === 'openai-compatible' ? normalizeBaseUrl(b.baseUrl, workerUrl) : null;

	const key = await masterKey(env);
	const sealed = await seal(key, apiKey, credentialAad(b.provider, baseUrl));
	const row = await env.DB.prepare(
		`INSERT INTO ai_credentials (provider, base_url, label, key_cipher, key_iv, key_last4, created_at)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING *`
	)
		.bind(b.provider, baseUrl, label, sealed.cipher, sealed.iv, apiKey.slice(-4), Date.now())
		.first<CredRow>();
	return toInfo(row!);
}

export async function deleteCredential(env: Env, id: number): Promise<boolean> {
	const res = await env.DB.batch([
		env.DB.prepare(`DELETE FROM ai_feature_models WHERE credential_id = ?1`).bind(id),
		env.DB.prepare(`DELETE FROM ai_credentials WHERE id = ?1`).bind(id)
	]);
	return (res[1].meta.changes ?? 0) > 0;
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
		return await open(key, { cipher: row.key_cipher, iv: row.key_iv }, credentialAad(row.provider, row.base_url));
	} catch {
		throw httpError(503, 'provider', 'Stored API key could not be decrypted (was AI_MASTER_KEY changed?)');
	}
}
