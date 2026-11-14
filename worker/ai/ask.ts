/**
 * POST /api/ai/ask/stream — Ask AI with the answer streamed as it is written.
 *
 * Same checks as the other AI calls (rate limit, model, price, worst-case
 * reservation under the cap); problems found before the model starts come
 * back as normal JSON errors. Once streaming, the body is server-sent events:
 *
 *   event: delta  data: {"t": "<text>"}
 *   event: done   data: AskResponse
 *   event: error  data: {"error": "...", "message": "..."}
 */
import type { AiError, AskRequest, AskResponse } from '../../src/lib/ai/contract.ts';
import { buildAskStreamPrompt, finishAskText } from '../../src/lib/ai/askStream.ts';
import { estimateInputTokens } from '../../src/lib/ai/prices.ts';
import { parseAskRequest } from '../../src/lib/ai/validate.ts';
import type { Env } from '../env.ts';
import { aiError, readJson } from '../http.ts';
import type { Session } from '../auth/passkey.ts';
import { streamAnthropic } from './anthropic.ts';
import { sumUsage, usageCost, worstCaseForCall } from './cost.ts';
import { decryptKey } from './credentials.ts';
import { GLOBAL_PER_MIN, getUsage, rateLimit, reserve, settle } from './ledger.ts';
import { priceFor, resolveFeature } from './models.ts';
import { streamOpenAi } from './openai.ts';
import type { AdapterResult, UsageEntry } from './types.ts';

const enc = new TextEncoder();
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export async function handleAskStream(req: Request, env: Env, ctx: ExecutionContext, session: Session): Promise<Response> {
	const parsed = parseAskRequest(await readJson(req, 256 * 1024));
	if (!parsed.ok) return aiError(400, 'bad_request', parsed.error);
	const ask: AskRequest = parsed.value;

	if (!((await rateLimit(env, `user:${session.userId}`)) && (await rateLimit(env, 'all-users', GLOBAL_PER_MIN))))
		return aiError(429, 'rate_limited', 'Too many AI calls; wait a minute and try again.', { 'retry-after': '60' });

	const parts = buildAskStreamPrompt(ask);
	const feature = 'propose' as const; // Ask AI uses the "Suggestions" model
	const target = await resolveFeature(env, session.userId, feature);
	if (!target) return aiError(409, 'no_model', `No model is set for "${feature}". Add an API key in Settings.`);
	const { cred, model } = target;
	const priced = await priceFor(env, ctx, cred, model);
	if (!priced) return aiError(409, 'no_price', `Set a price for ${model} to use it under the spend cap.`);

	const apiKey = await decryptKey(env, cred);
	const worst = worstCaseForCall(parts, cred.provider, model, priced.price);
	const reservation = await reserve(env, session.userId, { feature, provider: cred.provider, model, worstUsd: worst });
	if (reservation === null) {
		const u = await getUsage(env, session.userId);
		return aiError(
			402,
			'cap_reached',
			`Monthly AI cap reached ($${u.spentUsd.toFixed(3)} of $${u.capUsd.toFixed(2)} used; this call could cost up to $${worst.toFixed(3)}).`
		);
	}

	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	const writer = writable.getWriter();
	const abort = new AbortController();
	let gone = false; // the app closed the connection (Stop, or left the page)
	const send = (event: string, data: unknown) => {
		if (gone) return;
		writer.write(sse(event, data)).catch(() => {
			gone = true;
			abort.abort();
		});
	};
	req.signal?.addEventListener?.('abort', () => {
		gone = true;
		abort.abort();
	});

	const run = async () => {
		let text = '';
		const onText = (t: string) => {
			text += t;
			send('delta', { t });
		};
		let result: AdapterResult;
		try {
			result =
				cred.provider === 'anthropic'
					? await streamAnthropic(parts, model, apiKey, onText, abort.signal)
					: await streamOpenAi(parts, model, cred.base_url!, apiKey, onText, { signal: abort.signal });
		} catch (e) {
			result = { ok: false, status: 502, error: 'provider', message: (e as Error)?.message ?? 'AI call failed', usage: [], billedUnknown: true };
		}

		let usage: UsageEntry[] = result.usage;
		let unknown = !result.ok && !!result.billedUnknown;
		if (gone && !usage.length) {
			// Stopped early: estimate from what was written instead of keeping the worst case.
			usage = [{ model, input: estimateInputTokens([parts.system, parts.user]), output: Math.ceil(text.length / 2) + 50 }];
			unknown = false;
		}
		const reply: AskResponse | null = result.ok ? finishAskText(result.text, ask) : null;
		await settle(env, [reservation], {
			status: reply ? 'done' : 'failed',
			usage: sumUsage(usage),
			cost: unknown ? null : usageCost(usage, model, priced.price)
		}).catch(() => {});

		if (reply) send('done', reply);
		else if (!result.ok) send('error', { error: result.error, message: result.message } satisfies Pick<AiError, 'error' | 'message'>);
		else send('error', { error: 'invalid_output', message: 'The model’s reply was empty.' });
		await writer.close().catch(() => {});
	};
	ctx.waitUntil(run());

	return new Response(readable, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			'x-accel-buffering': 'no'
		}
	});
}
