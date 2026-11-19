/**
 * Browser client for the fleet console API. The console sits behind
 * Cloudflare Access: when the Access sign-in has lapsed, the edge answers
 * API calls with a redirect to the Access login, which we report as
 * `access` so the page can offer a full reload (that runs the Access flow).
 *
 * Dangerous actions answer 428 `stepup_required`; `withStepUp` then asks for
 * a passkey tap and retries once.
 */
import type { AdminInvitePatch } from '../invite/contract.ts';
import { startAuthentication } from '@simplewebauthn/browser';
import {
	STEPUP_REQUIRED,
	type AdminAccountDetail,
	type AdminAccountList,
	type AdminAccountPatch,
	type AdminAuditList,
	type AdminGrantInput,
	type AdminPackages,
	type AdminPlanId,
	type AdminPlanPatch,
	type AdminPlanCreate,
	type AdminPlanModelsInput,
	type AdminProviders,
	type AdminProviderInput,
	type AdminProviderPatch,
	type AdminModels,
	type AdminInvite,
	type AdminInviteInput,
	type AdminOverview,
	type AdminSettings,
	type AdminSystem,
	type AdminUsage
} from './contract.ts';
import type { AdminCommunity, AdminContentAction, CommunityStatus, TargetKind } from '#lib/community/contract.ts';
import type { AdminFeedback, FeedbackReportStatus } from '#lib/feedback/contract.ts';

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

export async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
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

export async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
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

export const getSettings = () => call<AdminSettings>('/api/admin/settings');
export const setSignupMode = (mode: 'open' | 'closed') =>
	withStepUp(() => call<AdminSettings>('/api/admin/settings/signup', { method: 'PUT', json: { mode } }));
export const setSessionDays = (days: number | null) =>
	withStepUp(() => call<AdminSettings>('/api/admin/settings/session', { method: 'PUT', json: { days } }));
export const createInvite = (input: AdminInviteInput) => call<AdminInvite>('/api/admin/invites', { method: 'POST', json: input });
export const listInvites = () => call<{ invites: AdminInvite[] }>('/api/admin/invites');
export const updateInvite = (code: string, patch: AdminInvitePatch) =>
	withStepUp(() => call<AdminInvite>(`/api/admin/invites/${encodeURIComponent(code)}`, { method: 'PATCH', json: patch }));
export const deleteInvite = (code: string) =>
	withStepUp(() => call<{ ok: true }>(`/api/admin/invites/${encodeURIComponent(code)}/delete`, { method: 'POST' }));
export const revokeInvite = (code: string) => call<{ ok: true }>(`/api/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });

export const getUsage = (days: 7 | 30 | 90) => call<AdminUsage>(`/api/admin/usage?days=${days}`);
export const getSystem = () => call<AdminSystem>('/api/admin/system');
export const getAudit = (offset = 0, action = '') =>
	call<AdminAuditList>(`/api/admin/audit?offset=${offset}${action ? `&action=${encodeURIComponent(action)}` : ''}`);

export const getPackages = () => call<AdminPackages>('/api/admin/packages');
export const updatePackage = (id: AdminPlanId, patch: AdminPlanPatch) =>
	withStepUp(() => call<AdminPackages>(`/api/admin/packages/${id}`, { method: 'PUT', json: patch }));
export const grantPackage = (accountId: number, input: AdminGrantInput) =>
	withStepUp(() => call<AdminAccountDetail>(`/api/admin/accounts/${accountId}/grants`, { method: 'POST', json: input }));
export const endGrant = (accountId: number, grantId: number) =>
	withStepUp(() => call<AdminAccountDetail>(`/api/admin/accounts/${accountId}/grants/${grantId}`, { method: 'DELETE' }));
export const createPackage = (input: AdminPlanCreate) =>
	withStepUp(() => call<AdminPackages & { created: string }>('/api/admin/packages', { method: 'POST', json: input }));
export const deletePackage = (id: AdminPlanId) =>
	withStepUp(() => call<AdminPackages>(`/api/admin/packages/${id}`, { method: 'DELETE' }));
export const setPackageModels = (id: AdminPlanId, input: AdminPlanModelsInput) =>
	withStepUp(() => call<AdminPackages>(`/api/admin/packages/${id}/models`, { method: 'PUT', json: input }));

export const getProviders = () => call<AdminProviders>('/api/admin/ai/providers');
export const addProvider = (input: AdminProviderInput) =>
	withStepUp(() => call<AdminProviders>('/api/admin/ai/providers', { method: 'POST', json: input }));
export const patchProvider = (id: number, patch: AdminProviderPatch) =>
	withStepUp(() => call<AdminProviders>(`/api/admin/ai/providers/${id}`, { method: 'PATCH', json: patch }));
export const removeProvider = (id: number) =>
	withStepUp(() => call<AdminProviders>(`/api/admin/ai/providers/${id}`, { method: 'DELETE' }));
export const getProviderModels = (id: number, refresh = false) =>
	call<AdminModels>(`/api/admin/ai/providers/${id}/models${refresh ? '?refresh=1' : ''}`);
export const getAllModels = (refresh = false) => call<AdminModels>(`/api/admin/ai/models${refresh ? '?refresh=1' : ''}`);

// community moderation (worker/admin/community.ts)
export const getCommunity = () => call<AdminCommunity>('/api/admin/community');
export const moderateContent = (kind: TargetKind, id: number, action: AdminContentAction) => {
	const go = () => call<{ ok: true }>('/api/admin/community/content', { method: 'POST', json: { kind, id, action } });
	return action === 'remove' ? withStepUp(go) : go();
};
export const setCommunityStatus = (accountId: number, status: CommunityStatus) => {
	const go = () => call<{ ok: true }>('/api/admin/community/author', { method: 'POST', json: { accountId, status } });
	return status === 'active' ? go() : withStepUp(go);
};

// content feedback (worker/admin/feedback.ts)
export const getFeedback = () => call<AdminFeedback>('/api/admin/feedback');
export const setFeedbackReport = (id: number, status: FeedbackReportStatus) =>
	call<{ ok: true }>('/api/admin/feedback/report', { method: 'POST', json: { id, status } });
