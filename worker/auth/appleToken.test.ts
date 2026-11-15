import { beforeAll, describe, expect, it } from 'vitest';
import { b64urlEncode } from '../crypto.ts';
import { APPLE_ISSUER, verifyAppleIdToken, type AppleJwk } from './appleToken.ts';

const enc = new TextEncoder();
const CLIENT = 'me.example.benkyo.web';
const NOW = Date.UTC(2026, 10, 15, 10, 0, 0);
const nowS = Math.floor(NOW / 1000);

let signer: CryptoKey;
let other: CryptoKey;
let jwks: AppleJwk[];

async function rsa(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify']
	) as Promise<CryptoKeyPair>;
}

beforeAll(async () => {
	const a = await rsa();
	const b = await rsa();
	signer = a.privateKey;
	other = b.privateKey;
	const pub = (await crypto.subtle.exportKey('jwk', a.publicKey)) as JsonWebKey;
	jwks = [{ kty: 'RSA', kid: 'k1', alg: 'RS256', n: pub.n!, e: pub.e! }];
});

async function token(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: CryptoKey } = {}) {
	const h = b64urlEncode(enc.encode(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1' })));
	const p = b64urlEncode(enc.encode(JSON.stringify(claims)));
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? signer, enc.encode(`${h}.${p}`));
	return `${h}.${p}.${b64urlEncode(new Uint8Array(sig))}`;
}

const good = (over: Record<string, unknown> = {}) => ({
	iss: APPLE_ISSUER,
	aud: CLIENT,
	sub: '001234.abcdef.0102',
	iat: nowS - 5,
	exp: nowS + 600,
	nonce: 'n-1',
	...over
});

const verify = (t: string, nonce = 'n-1') => verifyAppleIdToken(t, { clientId: CLIENT, nonce, now: NOW, keys: async () => jwks });

describe('verifyAppleIdToken', () => {
	it('accepts a valid token and returns the subject', async () => {
		expect((await verify(await token(good()))).sub).toBe('001234.abcdef.0102');
	});
	it('rejects a token signed by another key', async () => {
		await expect(verify(await token(good(), { key: other }))).rejects.toThrow('bad signature');
	});
	it('rejects an unknown key id and non-RS256 headers', async () => {
		await expect(verify(await token(good(), { kid: 'nope' }))).rejects.toThrow('unknown signing key');
		await expect(verify(await token(good(), { alg: 'none' }))).rejects.toThrow('unexpected algorithm');
	});
	it('rejects a tampered payload', async () => {
		const [h, , s] = (await token(good())).split('.');
		const p = b64urlEncode(enc.encode(JSON.stringify(good({ sub: 'someone-else' }))));
		await expect(verify(`${h}.${p}.${s}`)).rejects.toThrow('bad signature');
	});
	it('checks issuer, audience, expiry, age and nonce', async () => {
		await expect(verify(await token(good({ iss: 'https://evil.example' })))).rejects.toThrow('wrong issuer');
		await expect(verify(await token(good({ aud: 'com.other.app' })))).rejects.toThrow('wrong audience');
		await expect(verify(await token(good({ exp: nowS - 120 })))).rejects.toThrow('expired');
		await expect(verify(await token(good({ iat: nowS - 3600, exp: nowS + 60 })))).rejects.toThrow('stale token');
		await expect(verify(await token(good()), 'n-2')).rejects.toThrow('nonce mismatch');
		await expect(verify(await token(good({ nonce: undefined })))).rejects.toThrow('nonce mismatch');
	});
	it('rejects malformed input', async () => {
		await expect(verify('not-a-jwt')).rejects.toThrow('malformed token');
		await expect(verify('a.b.c')).rejects.toThrow('malformed token');
	});
});
