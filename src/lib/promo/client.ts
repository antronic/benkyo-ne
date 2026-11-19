/**
 * Browser client for promo codes (worker/promo.ts). Errors carry the
 * server's `problem` so the app can say what went wrong in the learner's
 * language.
 */
import type { PromoError, PromoProblem, PromoRedeemed, PromoStatus } from './contract.ts';

export class PromoRequestError extends Error {
	constructor(
		public status: number,
		/** 'offline' and 'network' come from the browser, the rest from the server */
		public problem: PromoProblem | 'offline' | 'network' | 'signed_out' | 'other',
		message: string
	) {
		super(message);
	}
}

async function call<T>(path: string, json?: unknown): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new PromoRequestError(0, 'offline', 'offline');
	let res: Response;
	try {
		res = await fetch(path, {
			method: json === undefined ? 'GET' : 'POST',
			credentials: 'same-origin',
			headers: json === undefined ? undefined : { 'content-type': 'application/json' },
			body: json === undefined ? undefined : JSON.stringify(json)
		});
	} catch {
		throw new PromoRequestError(0, 'network', 'network');
	}
	const body = (await res.json().catch(() => null)) as unknown;
	if (!res.ok) {
		const e = body as Partial<PromoError> | null;
		throw new PromoRequestError(res.status, e?.problem ?? (res.status === 401 ? 'signed_out' : 'other'), e?.message ?? `HTTP ${res.status}`);
	}
	return body as T;
}

export const promoStatus = () => call<PromoStatus>('/api/promo');
export const redeemPromo = (code: string) => call<PromoRedeemed>('/api/promo/redeem', { code });
