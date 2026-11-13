/**
 * Passkey auth (docs/AI-PLAN.md D3/D24, §3).
 *
 *   POST /api/auth/register/options  first passkey: header x-setup-token; later: session
 *   POST /api/auth/register/verify   body: RegistrationResponseJSON (or {response})
 *                                    → {ok, recoveryCode} + session cookie
 *   POST /api/auth/login/options     → PublicKeyCredentialRequestOptionsJSON
 *   POST /api/auth/login/verify      body: AuthenticationResponseJSON (or {response}) → Me + cookie
 *   POST /api/auth/logout            → Me, cookie cleared
 *   GET  /api/auth/me                → Me
 *   POST /api/auth/recover {code}    → Me + cookie; the code is consumed
 *
 * Sessions: random 256-bit token in the HttpOnly cookie `bk_session`; D1 keeps
 * only its SHA-256, bound to the passkey that created it (deleting the passkey
 * ends the session). Challenges live in D1 for 5 minutes and are single use.
 */
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import type { Me } from '../../src/lib/ai/contract.ts';
import { b64urlDecode, b64urlEncode, randomBytes, randomToken, safeEqual, sha256Hex } from '../crypto.ts';
import type { Env } from '../env.ts';
import { aiError, cookieSecure, getCookie, httpError, isLocalhost, json, readJson } from '../http.ts';

export const SESSION_COOKIE = 'bk_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = 'Benkyo';

export interface Session {
	/** SHA-256 of the token; also the rate-limit bucket */
	tokenHash: string;
	passkeyId: string | null;
	kind: 'passkey' | 'recovery' | 'dev';
}

// --------------------------------------------------------------- session ----

export async function getSession(req: Request, env: Env): Promise<Session | null> {
	const url = new URL(req.url);
	if (env.DEV_AUTH_BYPASS === '1' && isLocalhost(url.hostname)) {
		return { tokenHash: 'dev', passkeyId: null, kind: 'dev' };
	}
	const token = getCookie(req, SESSION_COOKIE);
	if (!token || token.length > 128) return null;
	const tokenHash = await sha256Hex(token);
	const row = await env.DB.prepare(
		`SELECT s.token_hash AS tokenHash, s.passkey_id AS passkeyId, s.kind AS kind
		   FROM sessions s LEFT JOIN passkeys p ON p.id = s.passkey_id
		  WHERE s.token_hash = ?1 AND s.expires_at > ?2
		    AND (s.kind = 'recovery' OR p.id IS NOT NULL)`
	)
		.bind(tokenHash, Date.now())
		.first<Session>();
	return row ?? null;
}

async function createSession(env: Env, url: URL, passkeyId: string | null, kind: 'passkey' | 'recovery') {
	const token = randomToken();
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?1`).bind(now),
		env.DB.prepare(
			`INSERT INTO sessions (token_hash, passkey_id, kind, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)`
		).bind(await sha256Hex(token), passkeyId, kind, now, now + SESSION_TTL_MS)
	]);
	return sessionCookie(url, token, SESSION_TTL_MS / 1000);
}

function sessionCookie(url: URL, value: string, maxAge: number) {
	return [
		`${SESSION_COOKIE}=${value}`,
		'HttpOnly',
		cookieSecure(url) ? 'Secure' : '',
		'SameSite=Strict',
		'Path=/api',
		`Max-Age=${maxAge}`
	]
		.filter(Boolean)
		.join('; ');
}

const passkeyCount = async (env: Env) =>
	(await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys`).first<{ n: number }>())?.n ?? 0;

async function me(req: Request, env: Env): Promise<Me> {
	const [session, n] = await Promise.all([getSession(req, env), passkeyCount(env)]);
	return { signedIn: !!session, registered: n > 0 };
}

// ------------------------------------------------------------ challenges ----

async function storeChallenge(env: Env, challenge: string, kind: 'register' | 'login') {
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM auth_challenges WHERE expires_at <= ?1`).bind(now),
		env.DB.prepare(`INSERT INTO auth_challenges (challenge, kind, expires_at) VALUES (?1, ?2, ?3)`).bind(
			challenge,
			kind,
			now + CHALLENGE_TTL_MS
		)
	]);
}

/** Single use: deletes the challenge and reports whether it was valid. */
async function consumeChallenge(env: Env, challenge: string, kind: 'register' | 'login') {
	const row = await env.DB.prepare(
		`DELETE FROM auth_challenges WHERE challenge = ?1 AND kind = ?2 AND expires_at > ?3 RETURNING challenge`
	)
		.bind(challenge, kind, Date.now())
		.first();
	return !!row;
}

// ---------------------------------------------------------- registration ----

/** First passkey: needs the SETUP_TOKEN header. Afterwards: a valid session. */
async function authorizeRegistration(req: Request, env: Env) {
	if ((await passkeyCount(env)) === 0) {
		const want = env.SETUP_TOKEN ?? '';
		const got = req.headers.get('x-setup-token') ?? '';
		if (want.length < 16) throw httpError(503, 'unauthorized', 'SETUP_TOKEN is not configured on the server');
		if (!(await safeEqual(got, want))) throw httpError(401, 'unauthorized', 'Setup token required');
		return;
	}
	if (!(await getSession(req, env))) throw httpError(401, 'unauthorized', 'Sign in to add another passkey');
}

async function webauthnUserId(env: Env): Promise<Uint8Array<ArrayBuffer>> {
	await env.DB.prepare(`INSERT OR IGNORE INTO ai_settings (key, value) VALUES ('webauthn_user_id', ?1)`)
		.bind(b64urlEncode(randomBytes(16)))
		.run();
	const row = await env.DB.prepare(`SELECT value FROM ai_settings WHERE key = 'webauthn_user_id'`).first<{
		value: string;
	}>();
	return b64urlDecode(row!.value);
}

async function registerOptions(req: Request, env: Env) {
	await authorizeRegistration(req, env);
	const url = new URL(req.url);
	const { results } = await env.DB.prepare(`SELECT id, transports FROM passkeys`).all<{
		id: string;
		transports: string | null;
	}>();
	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: url.hostname,
		userName: 'benkyo',
		userDisplayName: 'Benkyo',
		userID: await webauthnUserId(env),
		attestationType: 'none',
		timeout: CHALLENGE_TTL_MS,
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
		excludeCredentials: results.map((r) => ({ id: r.id, transports: parseTransports(r.transports) }))
	});
	await storeChallenge(env, options.challenge, 'register');
	return json(options);
}

function parseTransports(s: string | null): string[] | undefined {
	try {
		const t = s ? JSON.parse(s) : undefined;
		return Array.isArray(t) ? t.filter((x) => typeof x === 'string') : undefined;
	} catch {
		return undefined;
	}
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // 30 symbols, no 0/O/1/I/L/U
export function generateRecoveryCode(): string {
	const out: string[] = [];
	while (out.length < 20) {
		for (const b of randomBytes(32)) {
			if (b < 240 && out.length < 20) out.push(RECOVERY_ALPHABET[b % 30]);
		}
	}
	return out.join('').match(/.{5}/g)!.join('-');
}
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

function credentialBody<T>(body: unknown): T {
	if (body && typeof body === 'object' && 'response' in body) {
		const r = (body as { response: unknown }).response;
		if (r && typeof r === 'object' && 'id' in r) return r as T;
	}
	if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string')
		throw httpError(400, 'bad_request', 'Expected a WebAuthn credential response');
	return body as T;
}

async function registerVerify(req: Request, env: Env) {
	await authorizeRegistration(req, env);
	const url = new URL(req.url);
	const response = credentialBody<RegistrationResponseJSON>(await readJson(req));
	let result;
	try {
		result = await verifyRegistrationResponse({
			response,
			expectedChallenge: (c) => consumeChallenge(env, c, 'register'),
			expectedOrigin: url.origin,
			expectedRPID: url.hostname,
			requireUserVerification: true
		});
	} catch (e) {
		return aiError(400, 'bad_request', `Passkey registration failed: ${(e as Error).message}`);
	}
	if (!result.verified) return aiError(400, 'bad_request', 'Passkey registration could not be verified');
	const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
	const now = Date.now();
	const code = generateRecoveryCode();
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO passkeys (id, public_key, sign_count, transports, device_type, backed_up, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
		).bind(
			credential.id,
			b64urlEncode(credential.publicKey),
			credential.counter,
			JSON.stringify(credential.transports ?? []),
			credentialDeviceType,
			credentialBackedUp ? 1 : 0,
			now
		),
		// one live recovery code at a time: a new registration replaces it
		env.DB.prepare(`DELETE FROM recovery_codes WHERE used_at IS NULL`),
		env.DB.prepare(`INSERT INTO recovery_codes (code_hash, created_at) VALUES (?1, ?2)`).bind(
			await sha256Hex(normalizeRecoveryCode(code)),
			now
		)
	]);
	const cookie = await createSession(env, url, credential.id, 'passkey');
	return json({ ok: true, recoveryCode: code }, { headers: { 'set-cookie': cookie } });
}

// ----------------------------------------------------------------- login ----

async function loginOptions(req: Request, env: Env) {
	const url = new URL(req.url);
	const options = await generateAuthenticationOptions({
		rpID: url.hostname,
		userVerification: 'required',
		timeout: CHALLENGE_TTL_MS
	});
	await storeChallenge(env, options.challenge, 'login');
	return json(options);
}

async function loginVerify(req: Request, env: Env) {
	const url = new URL(req.url);
	const response = credentialBody<AuthenticationResponseJSON>(await readJson(req));
	const pk = await env.DB.prepare(`SELECT id, public_key, sign_count, transports FROM passkeys WHERE id = ?1`)
		.bind(response.id)
		.first<{ id: string; public_key: string; sign_count: number; transports: string | null }>();
	if (!pk) return aiError(401, 'unauthorized', 'Unknown passkey');
	let result;
	try {
		result = await verifyAuthenticationResponse({
			response,
			expectedChallenge: (c) => consumeChallenge(env, c, 'login'),
			expectedOrigin: url.origin,
			expectedRPID: url.hostname,
			requireUserVerification: true,
			credential: {
				id: pk.id,
				publicKey: b64urlDecode(pk.public_key),
				counter: pk.sign_count,
				transports: parseTransports(pk.transports)
			}
		});
	} catch (e) {
		return aiError(401, 'unauthorized', `Passkey sign-in failed: ${(e as Error).message}`);
	}
	if (!result.verified) return aiError(401, 'unauthorized', 'Passkey sign-in could not be verified');
	await env.DB.prepare(`UPDATE passkeys SET sign_count = ?1, last_used_at = ?2 WHERE id = ?3`)
		.bind(result.authenticationInfo.newCounter, Date.now(), pk.id)
		.run();
	const cookie = await createSession(env, url, pk.id, 'passkey');
	return json({ signedIn: true, registered: true } satisfies Me, { headers: { 'set-cookie': cookie } });
}

async function logout(req: Request, env: Env) {
	const url = new URL(req.url);
	const token = getCookie(req, SESSION_COOKIE);
	if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256Hex(token)).run();
	const registered = (await passkeyCount(env)) > 0;
	return json({ signedIn: false, registered } satisfies Me, {
		headers: { 'set-cookie': sessionCookie(url, '', 0) }
	});
}

async function recover(req: Request, env: Env) {
	const url = new URL(req.url);
	const body = (await readJson(req)) as { code?: unknown };
	const code = typeof body?.code === 'string' ? normalizeRecoveryCode(body.code) : '';
	if (code.length !== 20) return aiError(400, 'bad_request', 'Recovery code required');
	const row = await env.DB.prepare(
		`UPDATE recovery_codes SET used_at = ?1 WHERE code_hash = ?2 AND used_at IS NULL RETURNING code_hash`
	)
		.bind(Date.now(), await sha256Hex(code))
		.first();
	if (!row) return aiError(401, 'unauthorized', 'Invalid or used recovery code');
	const cookie = await createSession(env, url, null, 'recovery');
	return json({ signedIn: true, registered: true } satisfies Me, { headers: { 'set-cookie': cookie } });
}

/** Route /api/auth/*; returns null when the path isn't an auth route. */
export async function handleAuth(req: Request, env: Env, path: string): Promise<Response | null> {
	const m = req.method;
	if (path === '/api/auth/me' && m === 'GET') return json(await me(req, env));
	if (m !== 'POST') return null;
	switch (path) {
		case '/api/auth/register/options':
			return registerOptions(req, env);
		case '/api/auth/register/verify':
			return registerVerify(req, env);
		case '/api/auth/login/options':
			return loginOptions(req, env);
		case '/api/auth/login/verify':
			return loginVerify(req, env);
		case '/api/auth/logout':
			return logout(req, env);
		case '/api/auth/recover':
			return recover(req, env);
	}
	return null;
}
