/**
 * Browser client for the Worker's auth + AI endpoints (docs/AI-PLAN.md).
 * Auth is a passkey; the session is an HttpOnly cookie the browser sends
 * automatically (same origin), so no token is ever readable from JS.
 */
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { i18n, t } from '#lib/i18n/index.svelte.ts';
import type {
	AiError,
	AiSource,
	ManagedAi,
	PasskeyInfo,
	AskRequest,
	AskResponse,
	LessonRequest,
	LessonResponse,
	CredentialInfo,
	CredentialInput,
	Feature,
	FeatureModel,
	FillRequest,
	FillResponse,
	Me,
	ModelInfo,
	ProposeRequest,
	ProposeResponse,
	TranslateRequest,
	TranslateResponse,
	WriteRequest,
	WriteResponse,
	Usage
} from './contract.ts';
import type { Person } from '../avatar/person.ts';
import type { BetaStatus } from '../beta/contract.ts';
import type { PromoRedeemed } from '../promo/contract.ts';
import { telemetry } from '../beta/telemetry.svelte.ts';

export class AiRequestError extends Error {
	constructor(
		public status: number,
		public code: AiError['error'] | 'network' | 'offline',
		message: string
	) {
		super(message);
	}
}

/** Managed AI errors in the interface language (the server's text is English). */
function managedMessage(code: AiError['error']): string | null {
	if (i18n.locale === 'en') return null;
	if (code === 'allowance_reached') return t('ai.err.allowance');
	if (code === 'package_ended') return t('ai.err.packageEnded');
	if (code === 'no_model') return t('ai.err.noModel');
	if (code === 'rate_limited') return t('ai.err.rateLimited');
	return null;
}

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AiRequestError(0, 'offline', t('sync.offline'));
	let res: Response;
	try {
		res = await fetch(path, {
			...init,
			credentials: 'same-origin',
			headers: { ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
			body: init.json !== undefined ? JSON.stringify(init.json) : init.body
		});
	} catch {
		telemetry.track('error', 'api_network', { path, method: init.method ?? 'GET' });
		throw new AiRequestError(0, 'network', t('ai.err.network'));
	}
	const text = await res.text();
	const body = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const e = body as Partial<AiError> | null;
		// path, status and the server's message only: request bodies (which can hold an API key) are never sent
		telemetry.track('error', 'api_error', { path, method: init.method ?? 'GET', status: res.status, code: e?.error ?? null, message: e?.message ?? null });
		if (e?.error === 'consent_required') void import('../state/ai.svelte.ts').then((m) => m.ai.refresh());
		const code = (e?.error as AiError['error']) ?? 'provider';
		if (code === 'allowance_reached' || code === 'package_ended') void import('../state/ai.svelte.ts').then((m) => m.ai.refresh());
		throw new AiRequestError(res.status, code, managedMessage(code) ?? e?.message ?? `HTTP ${res.status}`);
	}
	return body as T;
}

// ------------------------------------------------------------------ auth ----

export const me = () => call<Me>('/api/auth/me');

/** A short label for this device, saved with the passkey ("iPhone", "Mac", …). */
export function deviceName(): string {
	const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
	if (/iPad/.test(ua)) return 'iPad';
	if (/iPhone/.test(ua)) return 'iPhone';
	if (/Android/.test(ua)) return 'Android';
	if (/Macintosh/.test(ua)) return navigator.maxTouchPoints > 1 ? 'iPad' : 'Mac';
	if (/Windows/.test(ua)) return 'Windows';
	if (/Linux/.test(ua)) return 'Linux';
	return 'This device';
}

/**
 * Signed out with `name`: create an account (its first passkey); `invite` when sign-ups are invite-only.
 * Signed in: add another passkey to your account.
 */
/**
 * Sign up (with a name) or add a passkey (without). A sign-up sends the invite and the promo code
 * from a link; the server counts the invite and redeems the code (or the invite's own) as it makes
 * the account, and answers with the package it gave (`promo`, null when none).
 */
export async function registerPasskey(name?: string, invite?: string, coupon?: string): Promise<{ recoveryCode?: string; promo?: PromoRedeemed | null }> {
	const options = await call<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/register/options', {
		method: 'POST',
		json: name ? { name, ...(invite ? { invite } : {}) } : {}
	});
	const response = await startRegistration({ optionsJSON: options });
	return call('/api/auth/register/verify', { method: 'POST', json: { response, deviceName: deviceName(), ...(name && coupon ? { coupon } : {}) } });
}

export async function signIn(): Promise<Me> {
	const options = await call<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/login/options', {
		method: 'POST',
		json: {}
	});
	const response = await startAuthentication({ optionsJSON: options });
	return call<Me>('/api/auth/login/verify', { method: 'POST', json: response });
}

export const recover = (code: string) => call<Me>('/api/auth/recover', { method: 'POST', json: { code } });
export const signOut = () => call<Me>('/api/auth/logout', { method: 'POST', json: {} });
export const listPasskeys = () => call<PasskeyInfo[]>('/api/auth/passkeys');
export const deletePasskey = (id: string) => call(`/api/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const newRecoveryCode = () => call<{ recoveryCode: string }>('/api/auth/recovery-code', { method: 'POST', json: {} });
export const renameAccount = (name: string) => call<Me>('/api/auth/account', { method: 'PATCH', json: { name } });
/** Save the avatar's parts (null removes it), or answer the one-time prompt with "Not now" (docs/AVATAR.md). */
export const putAvatar = (avatar: Partial<Person> | null) => call<Me>('/api/auth/avatar', { method: 'PUT', json: { avatar } });
export const avatarLater = () => call<Me>('/api/auth/avatar', { method: 'PUT', json: { later: true } });
export const deleteAccount = () => call<Me>('/api/auth/account', { method: 'DELETE', json: { confirm: 'DELETE' } });

/**
 * Sign in with Apple: a full-page trip to Apple and back (worker/auth/apple.ts).
 * `link` connects Apple to the account you're signed in to. The result comes
 * back in the URL hash; see takeAppleResult().
 */
export function startApple(link = false) {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AiRequestError(0, 'offline', t('sync.offline'));
	location.assign(`/api/auth/apple/start${link ? '?link=1' : ''}`);
}
export const disconnectApple = () => call<Me>('/api/auth/apple', { method: 'DELETE' });

const APPLE_ERRORS: Record<string, string> = {
	cancelled: '',
	closed: 'New sign-ups are closed right now. Already joined with a passkey? Sign in with it.',
	taken: 'That Apple ID is already connected to another Benkyo account.',
	'other-apple': 'This account already has a different Apple ID connected.',
	disabled: 'This account is disabled.',
	expired: 'That took too long. Please try again.',
	rate_limited: 'Too many sign-ups right now. Try again later.',
	failed: 'Sign in with Apple didn’t work. Please try again.'
};

/**
 * Read and clear the #apple=… / #apple-error=… that the Worker redirects back
 * with. Returns null when this page load isn't the end of an Apple sign-in.
 */
export function takeAppleResult(): { ok: true; result: 'signed-in' | 'created' | 'linked' } | { ok: false; message: string } | null {
	if (typeof location === 'undefined') return null;
	const m = /^#apple(-error)?=([a-z_-]{1,20})$/.exec(location.hash);
	if (!m) return null;
	history.replaceState(history.state, '', location.pathname + location.search);
	if (m[1]) return { ok: false, message: APPLE_ERRORS[m[2]] ?? APPLE_ERRORS.failed };
	const r = m[2];
	return r === 'signed-in' || r === 'created' || r === 'linked' ? { ok: true, result: r } : null;
}

// ------------------------------------------------------------------ beta ----

export const acceptConsent = (version: number) => call<BetaStatus>('/api/beta/consent', { method: 'POST', json: { version } });
export const withdrawConsent = () => call<BetaStatus>('/api/beta/consent', { method: 'DELETE' });
export const deleteBetaData = () => call<{ ok: true }>('/api/beta/data', { method: 'DELETE' });
/** Your beta data as a JSON file, opened as a download. */
export async function downloadBetaData() {
	const data = await call<unknown>('/api/beta/export');
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = `benkyo-beta-data-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// ----------------------------------------------------------- credentials ----

export const listCredentials = () => call<CredentialInfo[]>('/api/ai/credentials');
export const addCredential = (c: CredentialInput) =>
	call<CredentialInfo>('/api/ai/credentials', { method: 'POST', json: c });
export const deleteCredential = (id: number) => call(`/api/ai/credentials/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------- models ----

export const listModels = () => call<ModelInfo[]>('/api/ai/models');
export const setPrice = (p: { provider: string; model: string; inputPerM: number; outputPerM: number }) =>
	call('/api/ai/prices', { method: 'PUT', json: p });
export const getFeatures = () => call<FeatureModel[]>('/api/ai/features');
export const setFeature = (f: FeatureModel) => call('/api/ai/features', { method: 'PUT', json: f });
export const getUsage = () => call<Usage>('/api/ai/usage');
export const setCap = (capUsd: number) => call('/api/ai/cap', { method: 'PUT', json: { capUsd } });
/** the package's AI (managed AI), its allowance, and which AI is in use */
export const getManaged = () => call<ManagedAi>('/api/ai/managed');
export const setAiSource = (prefer: AiSource) => call<ManagedAi>('/api/ai/managed', { method: 'PUT', json: { prefer } });

// ------------------------------------------------------------ generation ----

export const propose = (r: ProposeRequest) => call<ProposeResponse>('/api/ai/propose', { method: 'POST', json: r });
export const fill = (r: FillRequest) => call<FillResponse>('/api/ai/fill', { method: 'POST', json: r });
export const lesson = (r: LessonRequest) => call<LessonResponse>('/api/ai/lesson', { method: 'POST', json: r });
export const ask = (r: AskRequest) => call<AskResponse>('/api/ai/ask', { method: 'POST', json: r });
/** Writing helper: politeness check and a natural rewrite of a message. */
export const write = (r: WriteRequest) => call<WriteResponse>('/api/ai/write', { method: 'POST', json: r });
/** Translate a community note or reply (the Worker reads the text). */
export const translate = (r: TranslateRequest) => call<TranslateResponse>('/api/ai/translate', { method: 'POST', json: r });

/**
 * Ask AI, streamed: `ondelta` gets the reply text as the model writes it.
 * Resolves with the final parsed reply. Abort with `signal` (Stop button).
 */
export async function askStream(r: AskRequest, ondelta: (text: string) => void, signal?: AbortSignal): Promise<AskResponse> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AiRequestError(0, 'offline', t('sync.offline'));
	let res: Response;
	try {
		res = await fetch('/api/ai/ask/stream', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
			body: JSON.stringify(r),
			signal
		});
	} catch (e) {
		if ((e as Error)?.name === 'AbortError') throw e;
		throw new AiRequestError(0, 'network', t('ai.err.network'));
	}
	if (!res.ok || !res.body) {
		const body = (await res.json().catch(() => null)) as Partial<AiError> | null;
		const code = (body?.error as AiError['error']) ?? 'provider';
		if (code === 'allowance_reached' || code === 'package_ended') void import('../state/ai.svelte.ts').then((m) => m.ai.refresh());
		throw new AiRequestError(res.status, code, managedMessage(code) ?? body?.message ?? `HTTP ${res.status}`);
	}
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	let event = 'message';
	let data = '';
	for (;;) {
		let chunk: ReadableStreamReadResult<string>;
		try {
			chunk = await reader.read();
		} catch (e) {
			if ((e as Error)?.name === 'AbortError') throw e;
			throw new AiRequestError(0, 'network', t('ai.err.dropped'));
		}
		if (chunk.done) break;
		buf += chunk.value;
		let i: number;
		while ((i = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, i).replace(/\r$/, '');
			buf = buf.slice(i + 1);
			if (line.startsWith('event:')) event = line.slice(6).trim();
			else if (line.startsWith('data:')) data += line.slice(5).trimStart();
			else if (line === '' && data) {
				const payload = JSON.parse(data);
				data = '';
				if (event === 'delta') ondelta(payload.t as string);
				else if (event === 'done') return payload as AskResponse;
				else if (event === 'error') throw new AiRequestError(502, payload.error ?? 'provider', payload.message ?? t('ai.err.failed'));
				event = 'message';
			}
		}
	}
	throw new AiRequestError(0, 'network', t('ai.err.endedEarly'));
}

export type { Feature };
