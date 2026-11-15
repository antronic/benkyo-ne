/**
 * Browser client for the fleet console API. The console sits behind
 * Cloudflare Access: when the Access sign-in has lapsed, the edge answers
 * API calls with a redirect to the Access login, which we report as
 * `access` so the page can offer a full reload (that runs the Access flow).
 */
import type { AdminOverview } from './contract.ts';

export type AdminErrorCode = 'access' | 'closed' | 'forbidden' | 'signin' | 'offline' | 'server';

export class AdminError extends Error {
	constructor(
		public status: number,
		public code: AdminErrorCode,
		message: string
	) {
		super(message);
	}
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AdminError(0, 'offline', 'You’re offline');
	let res: Response;
	try {
		res = await fetch(path, { ...init, credentials: 'same-origin', redirect: 'manual' });
	} catch {
		throw new AdminError(0, 'access', 'Sign in through Cloudflare Access again');
	}
	if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400))
		throw new AdminError(res.status, 'access', 'Sign in through Cloudflare Access again');
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const message = (body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
		const code: AdminErrorCode =
			res.status === 503 ? 'closed' : res.status === 401 ? 'signin' : res.status === 403 ? 'forbidden' : 'server';
		throw new AdminError(res.status, code, message);
	}
	return body as T;
}

export const overview = () => call<AdminOverview>('/api/admin/overview');
