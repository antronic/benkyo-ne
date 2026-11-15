/**
 * Verify an Apple `id_token` (a JWT signed RS256 by one of Apple's published
 * keys). Pure apart from the key fetch, which callers can replace in tests.
 *
 * https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
 */
import { b64urlDecode } from '../crypto.ts';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
/** Accept a little clock skew between Apple and the Worker. */
const SKEW_S = 60;
/** Apple's tokens live 10 minutes; reject anything issued long ago. */
const MAX_AGE_S = 15 * 60;

export interface AppleJwk {
	kty: string;
	kid: string;
	alg?: string;
	n: string;
	e: string;
}

export interface AppleClaims {
	sub: string;
	email?: string;
	email_verified?: boolean | string;
	is_private_email?: boolean | string;
}

export type KeyFetcher = () => Promise<AppleJwk[]>;

let cached: { at: number; keys: AppleJwk[] } | null = null;

/** Apple's signing keys, cached for an hour in the isolate. */
export const fetchAppleKeys: KeyFetcher = async () => {
	if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.keys;
	const res = await fetch(APPLE_KEYS_URL, { headers: { accept: 'application/json' } });
	if (!res.ok) throw new Error(`Apple keys: HTTP ${res.status}`);
	const body = (await res.json()) as { keys?: AppleJwk[] };
	if (!Array.isArray(body.keys)) throw new Error('Apple keys: bad response');
	cached = { at: Date.now(), keys: body.keys };
	return body.keys;
};

const dec = new TextDecoder();
const part = (s: string) => JSON.parse(dec.decode(b64urlDecode(s)));

export class AppleTokenError extends Error {}

export async function verifyAppleIdToken(
	token: string,
	opts: { clientId: string; nonce: string; now?: number; keys?: KeyFetcher }
): Promise<AppleClaims> {
	const fail = (why: string): never => {
		throw new AppleTokenError(why);
	};
	if (typeof token !== 'string' || token.length > 8192) fail('missing token');
	const segs = token.split('.');
	if (segs.length !== 3) fail('malformed token');
	let header: { alg?: string; kid?: string };
	let claims: Record<string, unknown>;
	try {
		header = part(segs[0]);
		claims = part(segs[1]);
	} catch {
		return fail('malformed token');
	}
	if (header.alg !== 'RS256' || typeof header.kid !== 'string') fail('unexpected algorithm');

	const pick = (keys: AppleJwk[]) => keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
	const getKeys = opts.keys ?? fetchAppleKeys;
	let jwk = pick(await getKeys());
	if (!jwk && !opts.keys) {
		// Apple rotated keys since we cached them
		cached = null;
		jwk = pick(await getKeys());
	}
	if (!jwk) return fail('unknown signing key');

	const key = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	);
	const ok = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		b64urlDecode(segs[2]),
		new TextEncoder().encode(`${segs[0]}.${segs[1]}`)
	);
	if (!ok) fail('bad signature');

	const now = Math.floor((opts.now ?? Date.now()) / 1000);
	if (claims.iss !== APPLE_ISSUER) fail('wrong issuer');
	const aud = claims.aud;
	if (!(aud === opts.clientId || (Array.isArray(aud) && aud.includes(opts.clientId)))) fail('wrong audience');
	if (typeof claims.exp !== 'number' || claims.exp + SKEW_S < now) fail('expired');
	if (typeof claims.iat !== 'number' || claims.iat - SKEW_S > now || now - claims.iat > MAX_AGE_S) fail('stale token');
	if (typeof claims.nonce !== 'string' || claims.nonce !== opts.nonce) fail('nonce mismatch');
	if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) fail('missing subject');

	return {
		sub: claims.sub as string,
		email: typeof claims.email === 'string' ? claims.email : undefined,
		email_verified: claims.email_verified as AppleClaims['email_verified'],
		is_private_email: claims.is_private_email as AppleClaims['is_private_email']
	};
}
