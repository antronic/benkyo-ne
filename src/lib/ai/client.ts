/**
 * Browser client for the Worker's auth + AI endpoints (docs/AI-PLAN.md).
 * Auth is a passkey; the session is an HttpOnly cookie the browser sends
 * automatically (same origin), so no token is ever readable from JS.
 */
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
	AiError,
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
	Usage
} from './contract.ts';

export class AiRequestError extends Error {
	constructor(
		public status: number,
		public code: AiError['error'] | 'network' | 'offline',
		message: string
	) {
		super(message);
	}
}

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AiRequestError(0, 'offline', 'You’re offline');
	let res: Response;
	try {
		res = await fetch(path, {
			...init,
			credentials: 'same-origin',
			headers: { ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
			body: init.json !== undefined ? JSON.stringify(init.json) : init.body
		});
	} catch {
		throw new AiRequestError(0, 'network', 'Network error');
	}
	const text = await res.text();
	const body = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const e = body as Partial<AiError> | null;
		throw new AiRequestError(res.status, (e?.error as AiError['error']) ?? 'provider', e?.message ?? `HTTP ${res.status}`);
	}
	return body as T;
}

// ------------------------------------------------------------------ auth ----

export const me = () => call<Me>('/api/auth/me');

export async function registerPasskey(setupToken?: string): Promise<{ recoveryCode?: string }> {
	const headers: Record<string, string> = setupToken ? { 'x-setup-token': setupToken } : {};
	const options = await call<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/register/options', {
		method: 'POST',
		headers,
		json: {}
	});
	const response = await startRegistration({ optionsJSON: options });
	return call('/api/auth/register/verify', { method: 'POST', headers, json: response });
}

export async function signIn(): Promise<void> {
	const options = await call<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/login/options', {
		method: 'POST',
		json: {}
	});
	const response = await startAuthentication({ optionsJSON: options });
	await call('/api/auth/login/verify', { method: 'POST', json: response });
}

export const recover = (code: string) => call<{ ok: boolean }>('/api/auth/recover', { method: 'POST', json: { code } });
export const signOut = () => call('/api/auth/logout', { method: 'POST', json: {} });

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

// ------------------------------------------------------------ generation ----

export const propose = (r: ProposeRequest) => call<ProposeResponse>('/api/ai/propose', { method: 'POST', json: r });
export const fill = (r: FillRequest) => call<FillResponse>('/api/ai/fill', { method: 'POST', json: r });

export type { Feature };
