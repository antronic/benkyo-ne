/**
 * WebCrypto helpers: hashing, random tokens, base64, and AES-GCM encryption
 * of provider API keys (docs/AI-PLAN.md D4). The AES key is derived with
 * HKDF-SHA256 from the Worker secret AI_MASTER_KEY (base64, 32 bytes).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toHex(buf: ArrayBuffer | Uint8Array) {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string) {
	return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export function b64encode(bytes: Uint8Array): string {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
}

export function b64decode(b64: string): Uint8Array<ArrayBuffer> {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

export const b64urlEncode = (bytes: Uint8Array) =>
	b64encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	return b64decode(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** 256-bit random token, base64url. */
export const randomToken = () => b64urlEncode(randomBytes(32));

/** Constant-time string comparison (compares SHA-256 digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
	const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
	return diff === 0 && a.length === b.length;
}

// ------------------------------------------------------------- AES-GCM ----

const keyCache = new Map<string, Promise<CryptoKey>>();

/** Derive the AES-256-GCM key from the base64 master secret. Throws if invalid. */
export function deriveKey(masterB64: string | undefined): Promise<CryptoKey> {
	if (!masterB64) throw new Error('AI_MASTER_KEY is not set');
	let p = keyCache.get(masterB64);
	if (!p) {
		let raw: Uint8Array<ArrayBuffer>;
		try {
			raw = b64decode(masterB64.trim());
		} catch {
			throw new Error('AI_MASTER_KEY is not valid base64');
		}
		if (raw.length !== 32) throw new Error('AI_MASTER_KEY must be 32 bytes (base64)');
		p = crypto.subtle
			.importKey('raw', raw, 'HKDF', false, ['deriveKey'])
			.then((ikm) =>
				crypto.subtle.deriveKey(
					{ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('benkyo-ne'), info: enc.encode('ai-credentials-v1') },
					ikm,
					{ name: 'AES-GCM', length: 256 },
					false,
					['encrypt', 'decrypt']
				)
			);
		keyCache.set(masterB64, p);
	}
	return p;
}

export interface Sealed {
	cipher: string; // base64
	iv: string; // base64, 12 bytes
}

/**
 * Encrypt with a fresh random 12-byte IV. `aad` binds the ciphertext to its
 * context (provider + base URL), so a row's key can't be moved to another
 * endpoint by editing the database.
 */
export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<Sealed> {
	const iv = randomBytes(12);
	const ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
		key,
		enc.encode(plaintext)
	);
	return { cipher: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

/** Decrypt; throws on a wrong key, wrong AAD or tampered data. */
export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<string> {
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: b64decode(sealed.iv), additionalData: enc.encode(aad) },
		key,
		b64decode(sealed.cipher)
	);
	return dec.decode(pt);
}
