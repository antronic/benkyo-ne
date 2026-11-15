/**
 * Cloudflare Access check for the fleet console (docs/AI-PLAN.md, fleet
 * console plan "Security"). Access sits in front of /admin* and
 * /api/admin/* at the edge; the Worker also verifies the signed
 * `Cf-Access-Jwt-Assertion` header itself, so a request that reaches the
 * Worker some other way (another hostname, a preview URL) is still refused.
 *
 * The JWT is RS256, signed by keys published at
 *   https://<team domain>/cdn-cgi/access/certs
 * and must carry the Access application's AUD tag.
 */
import { b64urlDecode } from '../crypto.ts';

export interface AccessConfig {
	teamDomain: string;
	aud: string;
	/** optional extra allow-list, lower-case */
	emails?: string[];
}

export interface AccessIdentity {
	email: string;
	sub: string;
}

export class AccessError extends Error {}

interface Jwk extends JsonWebKey {
	kid?: string;
}
type FetchJwks = (url: string) => Promise<{ keys: Jwk[] }>;

const JWKS_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map<string, { at: number; keys: Map<string, CryptoKey> }>();

const defaultFetch: FetchJwks = async (url) => {
	const res = await fetch(url);
	if (!res.ok) throw new AccessError(`Access keys unavailable (${res.status})`);
	return res.json();
};

/** Normalise "team.cloudflareaccess.com" or "https://team.cloudflareaccess.com/" to an origin. */
export const issuerOf = (teamDomain: string) => 'https://' + teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

async function keysFor(issuer: string, fetchJwks: FetchJwks, refresh = false) {
	const hit = jwksCache.get(issuer);
	if (hit && !refresh && Date.now() - hit.at < JWKS_TTL_MS) return hit.keys;
	const { keys } = await fetchJwks(`${issuer}/cdn-cgi/access/certs`);
	const out = new Map<string, CryptoKey>();
	for (const k of keys ?? []) {
		if (k.kty !== 'RSA' || !k.kid) continue;
		out.set(
			k.kid,
			await crypto.subtle.importKey('jwk', { kty: k.kty, n: k.n, e: k.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
		);
	}
	jwksCache.set(issuer, { at: Date.now(), keys: out });
	return out;
}

const decodeJson = (part: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(part)));

/** Verify an Access JWT; throws AccessError when it isn't valid for this app. */
export async function verifyAccessJwt(
	token: string,
	cfg: AccessConfig,
	opts: { now?: number; fetchJwks?: FetchJwks } = {}
): Promise<AccessIdentity> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new AccessError('Malformed Access token');
	let header: { alg?: string; kid?: string };
	let payload: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string; sub?: string };
	try {
		header = decodeJson(parts[0]);
		payload = decodeJson(parts[1]);
	} catch {
		throw new AccessError('Malformed Access token');
	}
	if (header.alg !== 'RS256' || !header.kid) throw new AccessError('Unexpected Access token algorithm');

	const issuer = issuerOf(cfg.teamDomain);
	const fetchJwks = opts.fetchJwks ?? defaultFetch;
	let key = (await keysFor(issuer, fetchJwks)).get(header.kid);
	// Access rotates keys; fetch again once if the kid is new.
	if (!key) key = (await keysFor(issuer, fetchJwks, true)).get(header.kid);
	if (!key) throw new AccessError('Unknown Access signing key');

	const ok = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		b64urlDecode(parts[2]),
		new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
	);
	if (!ok) throw new AccessError('Bad Access token signature');

	const now = Math.floor((opts.now ?? Date.now()) / 1000);
	const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!auds.includes(cfg.aud)) throw new AccessError('Access token is for another application');
	if (payload.iss !== issuer) throw new AccessError('Access token from another team');
	if (typeof payload.exp !== 'number' || payload.exp <= now) throw new AccessError('Access token expired');
	if (typeof payload.nbf === 'number' && payload.nbf > now + 60) throw new AccessError('Access token not valid yet');
	const email = (payload.email ?? '').toLowerCase();
	if (!email) throw new AccessError('Access token has no email');
	if (cfg.emails?.length && !cfg.emails.includes(email)) throw new AccessError('This email is not allowed');
	return { email, sub: payload.sub ?? '' };
}

/** For tests only. */
export const _clearJwksCache = () => jwksCache.clear();
