/**
 * Passkey accounts (docs/AI-PLAN.md D3/D24, wave 2 phase A).
 *
 *   POST   /api/auth/register/options  signed out: {name} → sign-up options for a new account
 *                                      signed in: {} → options to add a passkey to your account
 *   POST   /api/auth/register/verify   RegistrationResponseJSON (or {response, deviceName})
 *                                      → {ok, recoveryCode?} + session cookie
 *   POST   /api/auth/login/options     → PublicKeyCredentialRequestOptionsJSON (discoverable)
 *   POST   /api/auth/login/verify      AuthenticationResponseJSON → Me + cookie
 *   POST   /api/auth/logout            → Me, cookie cleared
 *   GET    /api/auth/me                → Me
 *   POST   /api/auth/recover {code}    → Me + cookie; the code is consumed
 *   GET    /api/auth/passkeys          → PasskeyInfo[]
 *   DELETE /api/auth/passkeys/:id      (not the last one)
 *   POST   /api/auth/recovery-code     → {recoveryCode} (replaces the old one)
 *   PATCH  /api/auth/account {name}    → Me
 *   DELETE /api/auth/account {confirm: "DELETE"} → Me (signed out)
 *   /api/auth/apple/*                  Sign in with Apple (worker/auth/apple.ts)
 *
 * Accounts are identified only by the session: every query below takes the
 * user id from the session row, never from the request. Sessions: random
 * 256-bit token in the HttpOnly cookie `bk_session`; D1 keeps only its
 * SHA-256, bound to the account and (for passkey sessions) to the passkey
 * that created it, so removing a passkey ends its sessions (and, for Apple
 * sessions, to the linked Apple ID, so disconnecting Apple ends them).
 */
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import type { Me, PasskeyInfo } from '../../src/lib/ai/contract.ts';
import { b64urlDecode, b64urlEncode, randomBytes, randomToken, sha256Hex } from '../crypto.ts';
import type { Env } from '../env.ts';
import { aiError, cookieSecure, getCookie, httpError, isLocalhost, json, readJson } from '../http.ts';
import { rateLimit } from '../ai/ledger.ts';
import { deleteAccountData } from '../ai/credentials.ts';
import { appleEnabled, handleApple } from './apple.ts';
import { betaStatus } from '../beta/routes.ts';

export const SESSION_COOKIE = 'bk_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = 'Benkyo';
/** Sign-up throttles (docs/AI-PLAN.md "Abuse limits"). */
const SIGNUPS_PER_IP_PER_HOUR = 5;
const SIGNUPS_PER_DAY = 200;

/** Throws 429 when sign-ups from this network, or overall today, are over the limit. */
export async function signupThrottle(req: Request, env: Env) {
	if (!(await rateLimit(env, `signup-ip:${clientIp(req)}`, SIGNUPS_PER_IP_PER_HOUR, Date.now(), 60)))
		throw httpError(429, 'rate_limited', 'Too many sign-ups from this network; try again later');
	if (!(await rateLimit(env, 'signup-all', SIGNUPS_PER_DAY, Date.now(), 1440)))
		throw httpError(429, 'rate_limited', 'Sign-ups are busy today; try again tomorrow');
}

export interface Session {
	/** SHA-256 of the token */
	tokenHash: string;
	passkeyId: string | null;
	kind: 'passkey' | 'recovery' | 'apple' | 'dev';
	userId: number;
	name: string;
	isAdmin: boolean;
	/** an Apple ID is connected to this account */
	appleLinked: boolean;
}

// --------------------------------------------------------------- session ----

export async function getSession(req: Request, env: Env): Promise<Session | null> {
	const url = new URL(req.url);
	if (env.DEV_AUTH_BYPASS === '1' && isLocalhost(url.hostname)) {
		await env.DB.prepare(
			`INSERT OR IGNORE INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES (1, 'Dev', 'dev', 1, ?1)`
		)
			.bind(Date.now())
			.run();
		return { tokenHash: 'dev', passkeyId: null, kind: 'dev', userId: 1, name: 'Dev', isAdmin: true, appleLinked: false };
	}
	const token = getCookie(req, SESSION_COOKIE);
	if (!token || token.length > 128) return null;
	const tokenHash = await sha256Hex(token);
	const row = await env.DB.prepare(
		`SELECT s.token_hash AS tokenHash, s.passkey_id AS passkeyId, s.kind AS kind, s.user_id AS userId,
		        a.name AS name, a.is_admin AS isAdmin, p.id AS livePasskey, ap.sub AS appleSub, s.apple_sub AS sessionAppleSub
		   FROM sessions s
		   JOIN accounts a ON a.id = s.user_id AND a.disabled = 0
		   LEFT JOIN passkeys p ON p.id = s.passkey_id AND p.user_id = s.user_id
		   LEFT JOIN apple_identities ap ON ap.user_id = s.user_id
		  WHERE s.token_hash = ?1 AND s.expires_at > ?2`
	)
		.bind(tokenHash, Date.now())
		.first<
			Omit<Session, 'isAdmin' | 'appleLinked'> & {
				isAdmin: number;
				livePasskey: string | null;
				appleSub: string | null;
				sessionAppleSub: string | null;
			}
		>();
	if (!row) return null;
	// Each session is only as good as what it signed in with: the passkey, or the Apple link.
	const passkeyOk = row.kind === 'passkey' && !!row.livePasskey;
	const appleOk = row.kind === 'apple' && !!row.appleSub && row.appleSub === row.sessionAppleSub;
	if (row.kind !== 'recovery' && !passkeyOk && !appleOk) return null;
	return {
		tokenHash: row.tokenHash,
		passkeyId: row.passkeyId,
		kind: row.kind,
		userId: row.userId,
		name: row.name,
		isAdmin: !!row.isAdmin,
		appleLinked: !!row.appleSub
	};
}

export async function createSession(
	env: Env,
	url: URL,
	userId: number,
	passkeyId: string | null,
	kind: 'passkey' | 'recovery' | 'apple',
	appleSub: string | null = null
) {
	const token = randomToken();
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?1`).bind(now),
		env.DB.prepare(
			`INSERT INTO sessions (token_hash, passkey_id, apple_sub, kind, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
		).bind(await sha256Hex(token), passkeyId, appleSub, kind, userId, now, now + SESSION_TTL_MS),
		env.DB.prepare(`UPDATE accounts SET last_seen_at = ?1 WHERE id = ?2`).bind(now, userId)
	]);
	return sessionCookie(url, token, SESSION_TTL_MS / 1000);
}

export function sessionCookie(url: URL, value: string, maxAge: number) {
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

export const signupOpen = (env: Env) => (env.SIGNUP_MODE ?? 'open') !== 'closed';

export function meOf(session: Session | null, env: Env): Me {
	return {
		signedIn: !!session,
		account: session
			? {
					id: session.userId,
					name: session.name,
					isAdmin: session.isAdmin,
					recovery: session.kind === 'recovery',
					via: session.kind,
					appleLinked: session.appleLinked
				}
			: null,
		signupOpen: signupOpen(env),
		appleEnabled: appleEnabled(env)
	};
}

export async function requireSession(req: Request, env: Env): Promise<Session> {
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	return s;
}

// ------------------------------------------------------------ challenges ----

interface ChallengeFor {
	userId?: number | null;
	userHandle?: string | null;
	signupName?: string | null;
}

async function storeChallenge(env: Env, challenge: string, kind: 'register' | 'login', f: ChallengeFor = {}) {
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM auth_challenges WHERE expires_at <= ?1`).bind(now),
		env.DB.prepare(
			`INSERT INTO auth_challenges (challenge, kind, expires_at, user_id, user_handle, signup_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
		).bind(challenge, kind, now + CHALLENGE_TTL_MS, f.userId ?? null, f.userHandle ?? null, f.signupName ?? null)
	]);
}

/** Single use: deletes the challenge and returns what it was issued for, or null. */
async function consumeChallenge(env: Env, challenge: string, kind: 'register' | 'login') {
	return (
		(await env.DB.prepare(
			`DELETE FROM auth_challenges WHERE challenge = ?1 AND kind = ?2 AND expires_at > ?3
			 RETURNING user_id AS userId, user_handle AS userHandle, signup_name AS signupName`
		)
			.bind(challenge, kind, Date.now())
			.first<ChallengeFor>()) ?? null
	);
}

// ---------------------------------------------------------- registration ----

export function cleanName(raw: unknown, max = 40): string {
	const s = typeof raw === 'string' ? raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() : '';
	if (!s) throw httpError(400, 'bad_request', 'Please enter a name');
	if (s.length > max) throw httpError(400, 'bad_request', `Names can be up to ${max} characters`);
	return s;
}

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'local';

async function registerOptions(req: Request, env: Env) {
	const url = new URL(req.url);
	const session = await getSession(req, env);
	const body = ((await readJson(req)) ?? {}) as { name?: unknown };

	let userName: string;
	let userHandle: string;
	let exclude: { id: string; transports: string | null }[] = [];
	let f: ChallengeFor;
	if (session) {
		// add a passkey to the signed-in account
		const acct = await env.DB.prepare(`SELECT name, webauthn_user_id AS handle FROM accounts WHERE id = ?1`)
			.bind(session.userId)
			.first<{ name: string; handle: string }>();
		if (!acct) throw httpError(401, 'unauthorized', 'Account not found');
		userName = acct.name;
		userHandle = acct.handle;
		exclude = (
			await env.DB.prepare(`SELECT id, transports FROM passkeys WHERE user_id = ?1`).bind(session.userId).all<{
				id: string;
				transports: string | null;
			}>()
		).results;
		f = { userId: session.userId };
	} else {
		// sign-up: a brand-new account, created only when the passkey verifies
		if (!signupOpen(env)) throw httpError(403, 'unauthorized', 'New sign-ups are closed right now');
		const name = cleanName(body.name);
		await signupThrottle(req, env);
		userName = name;
		userHandle = b64urlEncode(randomBytes(16));
		f = { userHandle, signupName: name };
	}
	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: url.hostname,
		userName,
		userDisplayName: userName,
		userID: b64urlDecode(userHandle),
		attestationType: 'none',
		timeout: CHALLENGE_TTL_MS,
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
		excludeCredentials: exclude.map((r) => ({ id: r.id, transports: parseTransports(r.transports) }))
	});
	await storeChallenge(env, options.challenge, 'register', f);
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

/** One live recovery code per account: a new one replaces the old. */
async function recoveryStatements(env: Env, userId: number, code: string, now: number) {
	return [
		env.DB.prepare(`DELETE FROM recovery_codes WHERE user_id = ?1 AND used_at IS NULL`).bind(userId),
		env.DB.prepare(`INSERT INTO recovery_codes (code_hash, created_at, user_id) VALUES (?1, ?2, ?3)`).bind(
			await sha256Hex(normalizeRecoveryCode(code)),
			now,
			userId
		)
	];
}

function credentialBody<T>(body: unknown): T {
	if (body && typeof body === 'object' && 'response' in body) {
		const r = (body as { response: unknown }).response;
		if (r && typeof r === 'object' && 'id' in r) return r as T;
	}
	if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string')
		throw httpError(400, 'bad_request', 'Expected a WebAuthn credential response');
	return body as T;
}

function deviceNameOf(body: unknown): string | null {
	const n = body && typeof body === 'object' ? (body as { deviceName?: unknown }).deviceName : undefined;
	if (typeof n !== 'string' || !n.trim()) return null;
	return n.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
}

async function registerVerify(req: Request, env: Env) {
	const url = new URL(req.url);
	const session = await getSession(req, env);
	const body = await readJson(req);
	const response = credentialBody<RegistrationResponseJSON>(body);
	const issued: { c: ChallengeFor | null } = { c: null };
	let result;
	try {
		result = await verifyRegistrationResponse({
			response,
			expectedChallenge: async (c) => !!(issued.c = await consumeChallenge(env, c, 'register')),
			expectedOrigin: url.origin,
			expectedRPID: url.hostname,
			requireUserVerification: true
		});
	} catch (e) {
		return aiError(400, 'bad_request', `Passkey registration failed: ${(e as Error).message}`);
	}
	const ch = issued.c;
	if (!result.verified || !ch) return aiError(400, 'bad_request', 'Passkey registration could not be verified');
	const now = Date.now();

	let userId: number;
	let recoveryCode: string | undefined;
	if (ch.userId) {
		// adding a passkey: the challenge must belong to the account that is signed in now
		if (!session || session.userId !== ch.userId) return aiError(401, 'unauthorized', 'Sign in again to add a passkey');
		userId = ch.userId;
	} else if (ch.userHandle && ch.signupName) {
		if (!signupOpen(env)) return aiError(403, 'unauthorized', 'New sign-ups are closed right now');
		const acct = await env.DB.prepare(
			`INSERT INTO accounts (name, webauthn_user_id, created_at) VALUES (?1, ?2, ?3) RETURNING id`
		)
			.bind(ch.signupName, ch.userHandle, now)
			.first<{ id: number }>();
		userId = acct!.id;
		recoveryCode = generateRecoveryCode();
	} else {
		return aiError(400, 'bad_request', 'Passkey registration could not be verified');
	}

	const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO passkeys (id, public_key, sign_count, transports, device_type, backed_up, created_at, user_id, name)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
		).bind(
			credential.id,
			b64urlEncode(credential.publicKey),
			credential.counter,
			JSON.stringify(credential.transports ?? []),
			credentialDeviceType,
			credentialBackedUp ? 1 : 0,
			now,
			userId,
			deviceNameOf(body)
		),
		...(recoveryCode ? await recoveryStatements(env, userId, recoveryCode, now) : [])
	]);
	// A recovery session becomes a normal passkey session once a passkey is added.
	if (session?.kind === 'recovery') await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(session.tokenHash).run();
	const cookie = await createSession(env, url, userId, credential.id, 'passkey');
	return json({ ok: true, recoveryCode }, { headers: { 'set-cookie': cookie } });
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
	const pk = await env.DB.prepare(
		`SELECT p.id, p.public_key, p.sign_count, p.transports, p.user_id, a.webauthn_user_id AS handle, a.disabled,
		        a.name, a.is_admin
		   FROM passkeys p JOIN accounts a ON a.id = p.user_id WHERE p.id = ?1`
	)
		.bind(response.id)
		.first<{
			id: string;
			public_key: string;
			sign_count: number;
			transports: string | null;
			user_id: number;
			handle: string;
			disabled: number;
			name: string;
			is_admin: number;
		}>();
	if (!pk) return aiError(401, 'unauthorized', 'This passkey isn’t registered here. Create an account or use another passkey.');
	if (pk.disabled) return aiError(403, 'unauthorized', 'This account is disabled');
	// The authenticator's user handle (when sent) must be this passkey's account.
	const handle = response.response.userHandle;
	if (handle && handle !== pk.handle && !pk.handle.startsWith('legacy-'))
		return aiError(401, 'unauthorized', 'Passkey does not match its account');
	let result;
	try {
		result = await verifyAuthenticationResponse({
			response,
			expectedChallenge: async (c) => !!(await consumeChallenge(env, c, 'login')),
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
	const cookie = await createSession(env, url, pk.user_id, pk.id, 'passkey');
	const linked = await env.DB.prepare(`SELECT 1 AS x FROM apple_identities WHERE user_id = ?1`).bind(pk.user_id).first();
	const session: Session = {
		tokenHash: '',
		passkeyId: pk.id,
		kind: 'passkey',
		userId: pk.user_id,
		name: pk.name,
		isAdmin: !!pk.is_admin,
		appleLinked: !!linked
	};
	return json(meOf(session, env), { headers: { 'set-cookie': cookie } });
}

async function logout(req: Request, env: Env) {
	const url = new URL(req.url);
	const token = getCookie(req, SESSION_COOKIE);
	if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256Hex(token)).run();
	return json(meOf(null, env), { headers: { 'set-cookie': sessionCookie(url, '', 0) } });
}

async function recover(req: Request, env: Env) {
	const url = new URL(req.url);
	const body = (await readJson(req)) as { code?: unknown };
	const code = typeof body?.code === 'string' ? normalizeRecoveryCode(body.code) : '';
	if (code.length !== 20) return aiError(400, 'bad_request', 'Recovery code required');
	if (!(await rateLimit(env, `recover-ip:${clientIp(req)}`, 10, Date.now(), 60)))
		return aiError(429, 'rate_limited', 'Too many attempts; try again later');
	const row = await env.DB.prepare(
		`UPDATE recovery_codes SET used_at = ?1 WHERE code_hash = ?2 AND used_at IS NULL RETURNING user_id AS userId`
	)
		.bind(Date.now(), await sha256Hex(code))
		.first<{ userId: number }>();
	if (!row?.userId) return aiError(401, 'unauthorized', 'Invalid or used recovery code');
	const cookie = await createSession(env, url, row.userId, null, 'recovery');
	const acct = await env.DB.prepare(
		`SELECT a.name, a.is_admin AS isAdmin, ap.sub AS appleSub
		   FROM accounts a LEFT JOIN apple_identities ap ON ap.user_id = a.id WHERE a.id = ?1`
	)
		.bind(row.userId)
		.first<{ name: string; isAdmin: number; appleSub: string | null }>();
	const session: Session = {
		tokenHash: '',
		passkeyId: null,
		kind: 'recovery',
		userId: row.userId,
		name: acct?.name ?? '',
		isAdmin: !!acct?.isAdmin,
		appleLinked: !!acct?.appleSub
	};
	return json(meOf(session, env), { headers: { 'set-cookie': cookie } });
}

// --------------------------------------------------------------- account ----

async function listPasskeys(session: Session, env: Env): Promise<PasskeyInfo[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, name, device_type AS deviceType, backed_up AS backedUp, created_at AS createdAt, last_used_at AS lastUsedAt
		   FROM passkeys WHERE user_id = ?1 ORDER BY created_at`
	)
		.bind(session.userId)
		.all<Omit<PasskeyInfo, 'current' | 'backedUp'> & { backedUp: number }>();
	return results.map((r) => ({ ...r, backedUp: !!r.backedUp, current: r.id === session.passkeyId }));
}

async function deletePasskey(session: Session, env: Env, id: string) {
	const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?1`).bind(session.userId).first<{ n: number }>();
	// Apple counts as a way back in, so the last passkey can go once Apple is connected.
	if ((n?.n ?? 0) <= 1 && !session.appleLinked)
		throw httpError(400, 'bad_request', 'You can’t remove your only passkey. Add another first, or delete the account.');
	const res = await env.DB.batch([
		env.DB.prepare(`DELETE FROM sessions WHERE passkey_id = ?1 AND user_id = ?2`).bind(id, session.userId),
		env.DB.prepare(`DELETE FROM passkeys WHERE id = ?1 AND user_id = ?2`).bind(id, session.userId)
	]);
	if (!res[1].meta.changes) throw httpError(404, 'bad_request', 'No such passkey');
}

async function newRecoveryCode(session: Session, env: Env) {
	if (session.kind === 'recovery') throw httpError(403, 'unauthorized', 'Add a passkey first');
	const code = generateRecoveryCode();
	await env.DB.batch(await recoveryStatements(env, session.userId, code, Date.now()));
	return json({ recoveryCode: code });
}

async function renameAccount(req: Request, session: Session, env: Env) {
	const name = cleanName(((await readJson(req)) as { name?: unknown })?.name);
	await env.DB.prepare(`UPDATE accounts SET name = ?1 WHERE id = ?2`).bind(name, session.userId).run();
	return json(meOf({ ...session, name }, env));
}

async function deleteAccount(req: Request, session: Session, env: Env) {
	const body = (await readJson(req)) as { confirm?: unknown };
	if (body?.confirm !== 'DELETE') throw httpError(400, 'bad_request', 'Confirmation required');
	if (session.kind === 'dev') throw httpError(400, 'bad_request', 'Not available in dev mode');
	await deleteAccountData(env, session.userId);
	const url = new URL(req.url);
	return json(meOf(null, env), { headers: { 'set-cookie': sessionCookie(url, '', 0) } });
}

/** Route /api/auth/*; returns null when the path isn't an auth route. */
export async function handleAuth(req: Request, env: Env, path: string): Promise<Response | null> {
	if (path.startsWith('/api/auth/apple')) return handleApple(req, env, path);
	const m = req.method;
	if (path === '/api/auth/me' && m === 'GET') {
		const s = await getSession(req, env);
		return json({ ...meOf(s, env), beta: s ? await betaStatus(env, s.userId) : null } satisfies Me);
	}
	if (path === '/api/auth/passkeys' && m === 'GET') return json(await listPasskeys(await requireSession(req, env), env));
	const pk = /^\/api\/auth\/passkeys\/([A-Za-z0-9_-]{1,512})$/.exec(path);
	if (pk && m === 'DELETE') {
		await deletePasskey(await requireSession(req, env), env, pk[1]);
		return json({ ok: true });
	}
	if (path === '/api/auth/account') {
		if (m === 'PATCH') return renameAccount(req, await requireSession(req, env), env);
		if (m === 'DELETE') return deleteAccount(req, await requireSession(req, env), env);
	}
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
		case '/api/auth/recovery-code':
			return newRecoveryCode(await requireSession(req, env), env);
	}
	return null;
}
