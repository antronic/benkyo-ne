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
import { sumUsage, usageCharge, worstForCall } from './cost.ts';
import { GLOBAL_PER_MIN, rateLimit, settle } from './ledger.ts';
import { startCall } from './managed.ts';
import { streamOpenAi } from './openai.ts';
import type { AdapterResult, UsageEntry } from './types.ts';
import { recordAiCall } from '../beta/routes.ts';

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
	// the package's AI or the learner's own key (worker/ai/managed.ts), worst case reserved
	const started = await startCall(env, ctx, session.userId, feature, (t) => worstForCall(parts, t));
	if (!started.ok) return started.res;
	const { target, reservation } = started;
	const { model } = target;
	let apiKey: string;
	try {
		apiKey = await target.key();
	} catch (e) {
		// nothing was sent: release the reservation
		await settle(env, [started.reservation], { status: 'failed', usage: { input: 0, output: 0 }, cost: 0 }).catch(() => {});
		throw e;
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
		const startedAt = Date.now();
		let text = '';
		const onText = (t: string) => {
			text += t;
			send('delta', { t });
		};
		let result: AdapterResult;
		try {
			result =
				target.provider === 'anthropic'
					? await streamAnthropic(parts, model, apiKey, onText, abort.signal)
					: await streamOpenAi(parts, model, target.baseUrl!, apiKey, onText, { signal: abort.signal });
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
		const charge = unknown ? null : usageCharge(usage, target);
		const cost = charge?.usd ?? null;
		const total = sumUsage(usage);
		await settle(env, [reservation], { status: reply ? 'done' : 'failed', usage: total, cost, credits: charge?.credits ?? null }).catch(() => {});
		// Beta usage data: the question, the prompt and the streamed answer (only with consent).
		await recordAiCall(env, session.userId, {
			kind: 'ask_stream',
			feature,
			provider: target.provider,
			model,
			status: gone ? 'stopped' : reply ? 'done' : result.ok ? 'invalid' : 'failed',
			error: result.ok ? null : `${result.error}: ${result.message}`,
			startedAt,
			inputTokens: total.input + (total.cacheRead ?? 0) + (total.cacheWrite ?? 0),
			outputTokens: total.output,
			costUsd: cost,
			request: ask,
			system: parts.system,
			user: parts.user,
			outputText: result.ok ? result.text : text || null,
			result: reply
		});

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
