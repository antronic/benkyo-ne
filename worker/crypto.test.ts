import { describe, expect, it } from 'vitest';
import { b64encode, b64urlDecode, b64urlEncode, deriveKey, open, randomBytes, safeEqual, seal } from './crypto.ts';
import { generateRecoveryCode, normalizeRecoveryCode } from './auth/passkey.ts';

const master = () => b64encode(randomBytes(32));

describe('AES-GCM credential encryption', () => {
	it('round-trips and uses a fresh 12-byte IV per seal', async () => {
		const key = await deriveKey(master());
		const a = await seal(key, 'sk-ant-secret-1234', 'aad');
		const b = await seal(key, 'sk-ant-secret-1234', 'aad');
		expect(atob(a.iv).length).toBe(12);
		expect(a.iv).not.toBe(b.iv);
		expect(a.cipher).not.toBe(b.cipher);
		expect(a.cipher).not.toContain('secret');
		expect(await open(key, a, 'aad')).toBe('sk-ant-secret-1234');
	});
	it('fails with the wrong master key', async () => {
		const sealed = await seal(await deriveKey(master()), 'sk-1', 'aad');
		await expect(open(await deriveKey(master()), sealed, 'aad')).rejects.toThrow();
	});
	it('fails with the wrong AAD (row moved to another provider/base URL)', async () => {
		const key = await deriveKey(master());
		const sealed = await seal(key, 'sk-1', 'ai-cred|openai-compatible|https://a.example');
		await expect(open(key, sealed, 'ai-cred|openai-compatible|https://evil.example')).rejects.toThrow();
	});
	it('fails on tampered ciphertext', async () => {
		const key = await deriveKey(master());
		const sealed = await seal(key, 'sk-1', 'aad');
		const bytes = Uint8Array.from(atob(sealed.cipher), (c) => c.charCodeAt(0));
		bytes[0] ^= 1;
		await expect(open(key, { ...sealed, cipher: b64encode(bytes) }, 'aad')).rejects.toThrow();
	});
	it('rejects a missing or short master key', () => {
		expect(() => deriveKey(undefined)).toThrow(/not set/);
		expect(() => deriveKey(b64encode(randomBytes(16)))).toThrow(/32 bytes/);
	});
});

describe('encoding helpers', () => {
	it('base64url round-trips', () => {
		const bytes = randomBytes(33);
		expect([...b64urlDecode(b64urlEncode(bytes))]).toEqual([...bytes]);
		expect(b64urlEncode(new Uint8Array([251, 255]))).toBe('-_8');
	});
	it('safeEqual', async () => {
		expect(await safeEqual('abc', 'abc')).toBe(true);
		expect(await safeEqual('abc', 'abd')).toBe(false);
		expect(await safeEqual('', 'a')).toBe(false);
	});
});

describe('recovery codes', () => {
	it('are 4×5 unambiguous characters and normalise case/separators', () => {
		const c = generateRecoveryCode();
		expect(c).toMatch(/^[A-HJKMNP-TV-Z2-9]{5}(-[A-HJKMNP-TV-Z2-9]{5}){3}$/);
		expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, ' '))).toBe(c.replace(/-/g, ''));
		expect(generateRecoveryCode()).not.toBe(c);
	});
});

describe('per-account key binding', () => {
	it('a key sealed for one account does not open for another', async () => {
		const { credentialAad } = await import('./ai/credentials.ts');
		const key = await deriveKey(master());
		const sealed = await seal(key, 'sk-user-1', credentialAad('anthropic', null, 1));
		expect(await open(key, sealed, credentialAad('anthropic', null, 1))).toBe('sk-user-1');
		await expect(open(key, sealed, credentialAad('anthropic', null, 2))).rejects.toThrow();
		await expect(open(key, sealed, credentialAad('anthropic', null))).rejects.toThrow();
	});
	it('keeps the single-owner AAD for version 1 rows', async () => {
		const { credentialAad } = await import('./ai/credentials.ts');
		expect(credentialAad('openai-compatible', 'https://x.test/v1')).toBe('ai-cred|openai-compatible|https://x.test/v1');
		expect(credentialAad('anthropic', null, 7)).toBe('ai-cred|v2|u7|anthropic|');
	});
});
