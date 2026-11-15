/**
 * Browser client for the fleet console API. The console sits behind
 * Cloudflare Access: when the Access sign-in has lapsed, the edge answers
 * API calls with a redirect to the Access login, which we report as
 * `access` so the page can offer a full reload (that runs the Access flow).
 *
 * Dangerous actions answer 428 `stepup_required`; `withStepUp` then asks for
 * a passkey tap and retries once.
 */
import { startAuthentication } from '@simplewebauthn/browser';
import {
	STEPUP_REQUIRED,
	type AdminAccountDetail,
	type AdminAccountList,
	type AdminAccountPatch,
	type AdminOverview
} from './contract.ts';

export type AdminErrorCode = 'access' | 'closed' | 'forbidden' | 'signin' | 'offline' | 'stepup' | 'bad' | 'server';

export class AdminError extends Error {
	constructor(
		public status: number,
		public code: AdminErrorCode,
		message: string
	) {
		super(message);
	}
}

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AdminError(0, 'offline', 'You’re offline');
	let res: Response;
	try {
		res = await fetch(path, {
			...init,
			credentials: 'same-origin',
			redirect: 'manual',
			headers: init.json !== undefined ? { 'content-type': 'application/json' } : undefined,
			body: init.json !== undefined ? JSON.stringify(init.json) : init.body
		});
	} catch {
		throw new AdminError(0, 'access', 'Sign in through Cloudflare Access again');
	}
	if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400))
		throw new AdminError(res.status, 'access', 'Sign in through Cloudflare Access again');
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const b = body as { error?: string; message?: string } | null;
		const message = b?.message ?? `HTTP ${res.status}`;
		const code: AdminErrorCode =
			res.status === 428 && b?.error === STEPUP_REQUIRED
				? 'stepup'
				: res.status === 503
					? 'closed'
					: res.status === 401
						? 'signin'
						: res.status === 403
							? 'forbidden'
							: res.status === 400 || res.status === 404
								? 'bad'
								: 'server';
		throw new AdminError(res.status, code, message);
	}
	return body as T;
}

/** Confirm with a passkey of the signed-in account (fresh for 5 minutes). */
export async function stepUp(): Promise<void> {
	const options = await call<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/admin/stepup/options', {
		method: 'POST',
		json: {}
	});
	const response = await startAuthentication({ optionsJSON: options });
	await call('/api/admin/stepup/verify', { method: 'POST', json: response });
}

async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (!(e instanceof AdminError) || e.code !== 'stepup') throw e;
		await stepUp();
		return fn();
	}
}

export const overview = () => call<AdminOverview>('/api/admin/overview');

export const listAccounts = (q = '', offset = 0) =>
	call<AdminAccountList>(`/api/admin/accounts?q=${encodeURIComponent(q)}&offset=${offset}`);
export const getAccount = (id: number) => call<AdminAccountDetail>(`/api/admin/accounts/${id}`);
export const patchAccount = (id: number, patch: AdminAccountPatch) =>
	withStepUp(() => call<AdminAccountDetail>(`/api/admin/accounts/${id}`, { method: 'PATCH', json: patch }));
export const revokeSessions = (id: number) =>
	withStepUp(() => call<AdminAccountDetail>(`/api/admin/accounts/${id}/revoke`, { method: 'POST', json: {} }));
export const deleteAccount = (id: number, confirm: string) =>
	withStepUp(() => call<{ ok: true }>(`/api/admin/accounts/${id}`, { method: 'DELETE', json: { confirm } }));
