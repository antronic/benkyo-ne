/** Small HTTP helpers shared by the Worker modules. */
import type { AiError } from '../src/lib/ai/contract.ts';

export const json = (data: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...init.headers }
	});

export const aiError = (status: number, error: AiError['error'], message: string, headers?: HeadersInit) =>
	json({ error, message } satisfies AiError, { status, headers });

export class HttpError extends Error {
	constructor(
		public status: number,
		public body: AiError
	) {
		super(body.message);
	}
}
export const httpError = (status: number, error: AiError['error'], message: string) =>
	new HttpError(status, { error, message });

/** Parse a JSON body with a size ceiling; throws HttpError(400/413). */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
	const len = Number(req.headers.get('content-length') ?? '0');
	if (len > maxBytes) throw httpError(413, 'bad_request', 'Request body too large');
	const text = await req.text();
	if (text.length > maxBytes) throw httpError(413, 'bad_request', 'Request body too large');
	try {
		return JSON.parse(text);
	} catch {
		throw httpError(400, 'bad_request', 'Body must be JSON');
	}
}

export function getCookie(req: Request, name: string): string | null {
	const header = req.headers.get('cookie');
	if (!header) return null;
	for (const part of header.split(';')) {
		const i = part.indexOf('=');
		if (i < 0) continue;
		if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
	}
	return null;
}

export const isLocalhost = (hostname: string) =>
	hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';

/** Secure is omitted only for plain-http localhost (wrangler dev). */
export function cookieSecure(url: URL) {
	return !(url.protocol === 'http:' && isLocalhost(url.hostname));
}
