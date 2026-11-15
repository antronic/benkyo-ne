import { beforeEach, describe, expect, it } from 'vitest';
import { b64urlEncode } from '../crypto.ts';
import { _clearJwksCache, verifyAccessJwt, type AccessConfig } from './access.ts';

const enc = new TextEncoder();
const cfg: AccessConfig = { teamDomain: 'team.cloudflareaccess.com', aud: 'aud-123' };
const ISS = 'https://team.cloudflareaccess.com';
const NOW = 1_800_000_000_000;

async function keyPair(kid: string) {
	const kp = (await crypto.subtle.generateKey(
		{ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['sign', 'verify']
	)) as CryptoKeyPair;
	const jwk = { ...((await crypto.subtle.exportKey('jwk', kp.publicKey)) as JsonWebKey), kid };
	return { kp, jwk };
}

async function sign(priv: CryptoKey, kid: string, payload: Record<string, unknown>) {
	const h = b64urlEncode(enc.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
	const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, enc.encode(`${h}.${p}`));
	return `${h}.${p}.${b64urlEncode(new Uint8Array(sig))}`;
}

const good = (over: Record<string, unknown> = {}) => ({
	aud: ['aud-123'],
	iss: ISS,
	email: 'Owner@Example.com',
	sub: 'u1',
	exp: NOW / 1000 + 600,
	nbf: NOW / 1000 - 10,
	...over
});

describe('verifyAccessJwt', () => {
	let a: Awaited<ReturnType<typeof keyPair>>;
	let fetched: string[];
	const fetchJwks = async (url: string) => {
		fetched.push(url);
		return { keys: [a.jwk] };
	};
	beforeEach(async () => {
		_clearJwksCache();
		fetched = [];
		a = await keyPair('k1');
	});

	it('accepts a valid token and returns the lower-cased email', async () => {
		const t = await sign(a.kp.privateKey, 'k1', good());
		await expect(verifyAccessJwt(t, cfg, { now: NOW, fetchJwks })).resolves.toEqual({ email: 'owner@example.com', sub: 'u1' });
		expect(fetched).toEqual([`${ISS}/cdn-cgi/access/certs`]);
	});

	it('rejects another application, team, expiry and allow-list', async () => {
		const opts = { now: NOW, fetchJwks };
		await expect(verifyAccessJwt(await sign(a.kp.privateKey, 'k1', good({ aud: ['other'] })), cfg, opts)).rejects.toThrow(/another application/);
		await expect(verifyAccessJwt(await sign(a.kp.privateKey, 'k1', good({ iss: 'https://evil.cloudflareaccess.com' })), cfg, opts)).rejects.toThrow(/another team/);
		await expect(verifyAccessJwt(await sign(a.kp.privateKey, 'k1', good({ exp: NOW / 1000 - 1 })), cfg, opts)).rejects.toThrow(/expired/);
		const t = await sign(a.kp.privateKey, 'k1', good());
		await expect(verifyAccessJwt(t, { ...cfg, emails: ['someone@else.com'] }, opts)).rejects.toThrow(/not allowed/);
		await expect(verifyAccessJwt(t, { ...cfg, emails: ['owner@example.com'] }, opts)).resolves.toBeTruthy();
	});

	it('rejects a token signed by a key Access did not publish', async () => {
		const b = await keyPair('k1');
		const forged = await sign(b.kp.privateKey, 'k1', good());
		await expect(verifyAccessJwt(forged, cfg, { now: NOW, fetchJwks })).rejects.toThrow(/signature/);
	});

	it('rejects tampered payloads and non-RS256 headers', async () => {
		const t = await sign(a.kp.privateKey, 'k1', good());
		const [h, , s] = t.split('.');
		const p2 = b64urlEncode(enc.encode(JSON.stringify(good({ email: 'attacker@x.com' }))));
		await expect(verifyAccessJwt(`${h}.${p2}.${s}`, cfg, { now: NOW, fetchJwks })).rejects.toThrow(/signature/);
		const none = b64urlEncode(enc.encode(JSON.stringify({ alg: 'none', kid: 'k1' })));
		await expect(verifyAccessJwt(`${none}.${p2}.`, cfg, { now: NOW, fetchJwks })).rejects.toThrow(/algorithm/);
		await expect(verifyAccessJwt('garbage', cfg, { now: NOW, fetchJwks })).rejects.toThrow(/Malformed/);
	});

	it('refetches keys once when the kid is new (rotation)', async () => {
		await verifyAccessJwt(await sign(a.kp.privateKey, 'k1', good()), cfg, { now: NOW, fetchJwks });
		const old = a;
		a = await keyPair('k2');
		await expect(verifyAccessJwt(await sign(a.kp.privateKey, 'k2', good()), cfg, { now: NOW, fetchJwks })).resolves.toBeTruthy();
		expect(fetched.length).toBe(2);
		expect(old).toBeTruthy();
	});
});
