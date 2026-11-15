/**
 * Sign in with Apple, a second way in beside passkeys.
 *
 *   GET    /api/auth/apple/start          → 302 to Apple (signed out: sign in or sign up)
 *   GET    /api/auth/apple/start?link=1   → 302 to Apple (signed in: connect Apple to this account)
 *   POST   /api/auth/apple/callback       Apple's form_post → 303 to /#apple=<result> or /#apple-error=<code>
 *   DELETE /api/auth/apple                disconnect Apple (needs a passkey left) → Me
 *
 * The web flow, with no Apple JavaScript on our pages: we redirect to Apple,
 * Apple posts `id_token` back to the callback, and we verify it against
 * Apple's published keys (worker/auth/appleToken.ts). That needs only the
 * Services ID (APPLE_CLIENT_ID); no private key, because we never call
 * Apple's token endpoint. We ask only for the name scope: no email is
 * requested or stored.
 *
 * Apple's POST is cross-site, so our SameSite=Strict session cookie is not
 * sent with it. Instead `start` stores a single-use state (with the nonce,
 * and the account id when connecting) and puts the state in a short-lived
 * SameSite=None cookie scoped to /api/auth/apple. The callback accepts the
 * post only when the form's state matches that cookie, so a sign-in can't
 * be finished in another browser (login CSRF).
 *
 * New accounts follow SIGNUP_MODE and the same throttles as passkey sign-ups.
 */
import { b64urlEncode, randomBytes, sha256Hex } from '../crypto.ts';
import type { Env } from '../env.ts';
import { aiError, cookieSecure, getCookie, HttpError, httpError, json } from '../http.ts';
import { AppleTokenError, verifyAppleIdToken, type KeyFetcher } from './appleToken.ts';
import { cleanName, createSession, meOf, requireSession, SESSION_COOKIE, signupOpen, signupThrottle } from './passkey.ts';

const STATE_COOKIE = 'bk_apple';
const STATE_TTL_MS = 10 * 60 * 1000;
const AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

export const appleEnabled = (env: Env) => !!env.APPLE_CLIENT_ID?.trim();

/** Results the app shows after the redirect back (src/lib/ai/apple.ts). */
export type AppleResult = 'signed-in' | 'created' | 'linked';
export type AppleErrorCode = 'cancelled' | 'closed' | 'taken' | 'other-apple' | 'disabled' | 'expired' | 'rate_limited' | 'failed';

function stateCookie(url: URL, value: string, maxAge: number) {
	// Apple's form_post is a cross-site POST: only SameSite=None cookies come with it.
	// Plain-http localhost can't use Secure (and so not None); Apple can't redirect there anyway.
	const secure = cookieSecure(url);
	return [
		`${STATE_COOKIE}=${value}`,
		'HttpOnly',
		secure ? 'Secure' : '',
		secure ? 'SameSite=None' : 'SameSite=Lax',
		'Path=/api/auth/apple',
		`Max-Age=${maxAge}`
	]
		.filter(Boolean)
		.join('; ');
}

const redirectUri = (url: URL) => `${url.origin}/api/auth/apple/callback`;

async function start(req: Request, env: Env) {
	const url = new URL(req.url);
	const link = url.searchParams.get('link') === '1';
	let userId: number | null = null;
	if (link) {
		const s = await requireSession(req, env);
		if (s.kind === 'dev') throw httpError(400, 'bad_request', 'Not available in dev mode');
		userId = s.userId;
	}
	const state = b64urlEncode(randomBytes(32));
	const nonce = b64urlEncode(randomBytes(32));
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM apple_states WHERE expires_at <= ?1`).bind(now),
		env.DB.prepare(`INSERT INTO apple_states (state_hash, nonce, user_id, expires_at) VALUES (?1, ?2, ?3, ?4)`).bind(
			await sha256Hex(state),
			nonce,
			userId,
			now + STATE_TTL_MS
		)
	]);
	const to = new URL(AUTHORIZE_URL);
	to.searchParams.set('client_id', env.APPLE_CLIENT_ID!.trim());
	to.searchParams.set('redirect_uri', redirectUri(url));
	to.searchParams.set('response_type', 'code id_token');
	to.searchParams.set('response_mode', 'form_post');
	to.searchParams.set('scope', 'name');
	to.searchParams.set('state', state);
	to.searchParams.set('nonce', nonce);
	return new Response(null, {
		status: 302,
		headers: { location: to.toString(), 'set-cookie': stateCookie(url, state, STATE_TTL_MS / 1000), 'cache-control': 'no-store' }
	});
}

/** Apple sends the name only on the first authorization, as JSON in the `user` field. */
function nameFromApple(raw: string | File | null): string {
	if (typeof raw !== 'string' || raw.length > 4096) return 'Learner';
	try {
		const n = (JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } }).name;
		const first = typeof n?.firstName === 'string' ? n.firstName : '';
		const last = typeof n?.lastName === 'string' ? n.lastName : '';
		return cleanName(`${first} ${last}`.trim() || 'Learner');
	} catch {
		return 'Learner';
	}
}

export async function callback(req: Request, env: Env, keys?: KeyFetcher): Promise<Response> {
	const url = new URL(req.url);
	const headers = new Headers({ 'cache-control': 'no-store' });
	headers.append('set-cookie', stateCookie(url, '', 0));
	const done = (hash: string) => {
		headers.set('location', `${url.origin}/#${hash}`);
		return new Response(null, { status: 303, headers });
	};
	const fail = (code: AppleErrorCode) => done(`apple-error=${code}`);

	let form: FormData;
	try {
		if (Number(req.headers.get('content-length') ?? '0') > 32 * 1024) return fail('failed');
		form = await req.formData();
	} catch {
		return fail('failed');
	}
	const state = form.get('state');
	const cookieState = getCookie(req, STATE_COOKIE);
	if (typeof state !== 'string' || !cookieState || state !== cookieState) return fail('expired');
	// single use, even when Apple reports an error
	const st = await env.DB.prepare(
		`DELETE FROM apple_states WHERE state_hash = ?1 AND expires_at > ?2 RETURNING nonce, user_id AS userId`
	)
		.bind(await sha256Hex(state), Date.now())
		.first<{ nonce: string; userId: number | null }>();
	if (!st) return fail('expired');
	const appleError = form.get('error');
	if (appleError) return fail(appleError === 'user_cancelled_authorize' ? 'cancelled' : 'failed');

	let sub: string;
	try {
		({ sub } = await verifyAppleIdToken(String(form.get('id_token') ?? ''), {
			clientId: env.APPLE_CLIENT_ID!.trim(),
			nonce: st.nonce,
			keys
		}));
	} catch (e) {
		if (!(e instanceof AppleTokenError)) console.error('apple keys', (e as Error).message);
		return fail('failed');
	}
	const now = Date.now();
	const known = await env.DB.prepare(
		`SELECT ap.user_id AS userId, a.disabled AS disabled FROM apple_identities ap JOIN accounts a ON a.id = ap.user_id WHERE ap.sub = ?1`
	)
		.bind(sub)
		.first<{ userId: number; disabled: number }>();

	if (st.userId) {
		// connecting Apple to the account that started this
		if (known) return known.userId === st.userId ? done('apple=linked') : fail('taken');
		const res = await env.DB.prepare(
			`INSERT INTO apple_identities (sub, user_id, created_at) SELECT ?1, ?2, ?3
			  WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?2) AND NOT EXISTS (SELECT 1 FROM apple_identities WHERE user_id = ?2)`
		)
			.bind(sub, st.userId, now)
			.run();
		return res.meta.changes ? done('apple=linked') : fail('other-apple');
	}

	if (known) {
		if (known.disabled) return fail('disabled');
		await env.DB.prepare(`UPDATE apple_identities SET last_used_at = ?1 WHERE sub = ?2`).bind(now, sub).run();
		headers.append('set-cookie', await createSession(env, url, known.userId, null, 'apple', sub));
		return done('apple=signed-in');
	}

	// a new account
	if (!signupOpen(env)) return fail('closed');
	try {
		await signupThrottle(req, env);
	} catch (e) {
		if (e instanceof HttpError && e.status === 429) return fail('rate_limited');
		throw e;
	}
	const acct = await env.DB.prepare(`INSERT INTO accounts (name, webauthn_user_id, created_at) VALUES (?1, ?2, ?3) RETURNING id`)
		.bind(nameFromApple(form.get('user')), b64urlEncode(randomBytes(16)), now)
		.first<{ id: number }>();
	try {
		await env.DB.prepare(`INSERT INTO apple_identities (sub, user_id, created_at, last_used_at) VALUES (?1, ?2, ?3, ?3)`)
			.bind(sub, acct!.id, now)
			.run();
	} catch {
		// two callbacks raced for the same Apple ID: keep the first account
		await env.DB.prepare(`DELETE FROM accounts WHERE id = ?1`).bind(acct!.id).run();
		return fail('failed');
	}
	headers.append('set-cookie', await createSession(env, url, acct!.id, null, 'apple', sub));
	return done('apple=created');
}

async function unlink(req: Request, env: Env) {
	const session = await requireSession(req, env);
	const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?1`).bind(session.userId).first<{ n: number }>();
	if (!n?.n) throw httpError(400, 'bad_request', 'Add a passkey first, so you can still sign in without Apple.');
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1 AND kind = 'apple'`).bind(session.userId),
		env.DB.prepare(`DELETE FROM apple_identities WHERE user_id = ?1`).bind(session.userId)
	]);
	if (session.kind === 'apple') {
		// this session signed in with Apple, so it just ended
		const url = new URL(req.url);
		const clear = [`${SESSION_COOKIE}=`, 'HttpOnly', cookieSecure(url) ? 'Secure' : '', 'SameSite=Strict', 'Path=/api', 'Max-Age=0']
			.filter(Boolean)
			.join('; ');
		return json(meOf(null, env), { headers: { 'set-cookie': clear } });
	}
	return json(meOf({ ...session, appleLinked: false }, env));
}

export async function handleApple(req: Request, env: Env, path: string): Promise<Response | null> {
	if (!appleEnabled(env)) return aiError(404, 'bad_request', 'Sign in with Apple isn’t set up on this server');
	const m = req.method;
	if (path === '/api/auth/apple/start' && m === 'GET') {
		try {
			return await start(req, env);
		} catch (e) {
			// a page navigation, not a fetch: send people back to the app, not to a JSON error
			if (!(e instanceof HttpError)) throw e;
			const origin = new URL(req.url).origin;
			return Response.redirect(`${origin}/#apple-error=${e.status === 401 ? 'expired' : 'failed'}`, 303);
		}
	}
	if (path === '/api/auth/apple/callback' && m === 'POST') return callback(req, env);
	if (path === '/api/auth/apple' && m === 'DELETE') return unlink(req, env);
	return null;
}
