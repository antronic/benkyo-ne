/**
 * POST /api/ai/propose, /fill, /lesson, /ask and /translate.
 *
 * auth (caller) → rate limit → pick the package's AI or the learner's own key
 * for the feature ('vision' when an image is attached; worker/ai/managed.ts) →
 * reserve worst case under the allowance or cap (402 allowance_reached / cap_reached) → call provider → settle ledger with actual usage →
 * validate output (502 invalid_output) → respond.
 */
import type { AskRequest, Feature, FillRequest, LessonRequest, ProposeRequest, TranslateLang, TranslateRequest } from '../../src/lib/ai/contract.ts';
import { buildAskPrompt, buildFillPrompt, buildLessonPrompt, buildProposePrompt, buildTranslatePrompt, type PromptParts } from '../../src/lib/ai/prompts.ts';
import {
	parseAskRequest,
	parseFillRequest,
	parseLessonRequest,
	parseModelJson,
	parseProposeRequest,
	parseTranslateRequest,
	validateAskOutput,
	validateFillOutput,
	validateLessonOutput,
	validateProposeOutput,
	validateTranslateOutput,
	type Result
} from '../../src/lib/ai/validate.ts';
import type { Env } from '../env.ts';
import { aiError, json, readJson } from '../http.ts';
import type { Session } from '../auth/passkey.ts';
import { callAnthropic } from './anthropic.ts';
import { sumUsage, usageCost, worstCaseForCall } from './cost.ts';
import { GLOBAL_PER_MIN, rateLimit, settle } from './ledger.ts';
import { reserveFor, startCall } from './managed.ts';
import { callOpenAi, type OpenAiFormat } from './openai.ts';
import type { AdapterResult, UsageEntry } from './types.ts';
import { recordAiCall } from '../beta/routes.ts';
import { visibleText } from '../communityData.ts';

const MAX_BODY = 8 * 1024 * 1024; // screenshots

type Kind = 'propose' | 'fill' | 'lesson' | 'ask' | 'translate';
type Req = ProposeRequest | FillRequest | LessonRequest | AskRequest | TranslateRequest;

export async function handleGenerate(kind: Kind, req: Request, env: Env, ctx: ExecutionContext, session: Session) {
	const body = await readJson(req, kind === 'propose' ? MAX_BODY : 256 * 1024);
	const parsed: Result<Req> =
		kind === 'propose'
			? parseProposeRequest(body)
			: kind === 'fill'
				? parseFillRequest(body)
				: kind === 'lesson'
					? parseLessonRequest(body)
					: kind === 'translate'
						? parseTranslateRequest(body)
						: parseAskRequest(body);
	if (!parsed.ok) return aiError(400, 'bad_request', parsed.error);

	// Translate: the Worker reads the note itself, only what this learner may see
	let source: { text: string; from: TranslateLang } | null = null;
	if (kind === 'translate') {
		const t = parsed.value as TranslateRequest;
		const row = await visibleText(env.DB, session.userId, t.kind, t.id);
		if (!row) return aiError(404, 'bad_request', 'No such note or reply');
		if (row.lang === t.to) return aiError(400, 'bad_request', 'It is already in that language');
		source = { text: row.body, from: row.lang as TranslateLang };
	}

	if (!((await rateLimit(env, `user:${session.userId}`)) && (await rateLimit(env, 'all-users', GLOBAL_PER_MIN))))
		return aiError(429, 'rate_limited', 'Too many AI calls; wait a minute and try again.', { 'retry-after': '60' });

	const parts: PromptParts =
		kind === 'propose'
			? buildProposePrompt(parsed.value as ProposeRequest)
			: kind === 'fill'
				? buildFillPrompt(parsed.value as FillRequest)
				: kind === 'lesson'
					? buildLessonPrompt(parsed.value as LessonRequest)
					: kind === 'translate'
						? buildTranslatePrompt({ ...source!, to: (parsed.value as TranslateRequest).to })
						: buildAskPrompt(parsed.value as AskRequest);
	// lesson packs and Ask AI use the "Suggestions" model
	const feature: Feature = parts.image ? 'vision' : kind === 'fill' ? 'fill' : kind === 'translate' ? 'translate' : 'propose';

	// the package's AI or the learner's own key (worker/ai/managed.ts), worst case reserved
	const started = await startCall(env, ctx, session.userId, feature, (t) => worstCaseForCall(parts, t.provider, t.model, t.price));
	if (!started.ok) return started.res;
	const { target, worst } = started;
	const { model } = target;
	const priced = { price: target.price };
	let apiKey: string;
	try {
		apiKey = await target.key();
	} catch (e) {
		// nothing was sent: release the reservation
		await settle(env, [started.reservation], { status: 'failed', usage: { input: 0, output: 0 }, cost: 0 }).catch(() => {});
		throw e;
	}
	const reservations: number[] = [started.reservation];

	const usage: UsageEntry[] = [];
	let billedUnknown = false;
	const startedAt = Date.now();
	const finish = async (status: 'done' | 'failed') => {
		// Outcome unknown (dropped connection/timeout): keep every reserved worst case.
		const cost = billedUnknown ? null : usageCost(usage, model, priced.price);
		await settle(env, reservations, { status, usage: sumUsage(usage), cost });
		return cost;
	};
	// Beta usage data: the request, the prompt and the reply (only with consent; never the key).
	const record = (status: 'done' | 'failed' | 'invalid', cost: number | null, error: string | null, outputText: string | null, result?: unknown) => {
		const u = sumUsage(usage);
		ctx.waitUntil(
			recordAiCall(env, session.userId, {
				kind,
				feature,
				provider: target.provider,
				model,
				status,
				error,
				startedAt,
				inputTokens: u.input + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0),
				outputTokens: u.output,
				costUsd: cost,
				request: parsed.value,
				system: parts.system,
				user: parts.user,
				outputText,
				result
			})
		);
	};

	try {
		let format: OpenAiFormat | undefined; // remembered so the retry skips a rejected json_schema
		const call = async (retry: boolean): Promise<AdapterResult> => {
			if (target.provider === 'anthropic') return callAnthropic(parts, model, apiKey);
			const r = await callOpenAi(parts, model, target.baseUrl!, apiKey, { retry, format });
			format = r.format ?? format;
			return r;
		};
		const check = (text: string) => {
			const raw = parseModelJson(text);
			switch (kind) {
				case 'propose':
					return validateProposeOutput(raw, parsed.value as ProposeRequest);
				case 'fill':
					return validateFillOutput(raw, parsed.value as FillRequest);
				case 'lesson':
					return validateLessonOutput(raw, parsed.value as LessonRequest);
				case 'translate':
					return validateTranslateOutput(raw, (parsed.value as TranslateRequest).to);
				default:
					return validateAskOutput(raw, parsed.value as AskRequest);
			}
		};

		let result = await call(false);
		usage.push(...result.usage);
		billedUnknown ||= !result.ok && !!result.billedUnknown;
		let validated = result.ok ? check(result.text) : null;

		// OpenAI-compatible: one retry on malformed output, under its own reservation.
		const malformed = (result.ok && validated && !validated.ok) || (!result.ok && result.error === 'invalid_output');
		if (target.provider === 'openai-compatible' && malformed) {
			const again = await reserveFor(env, session.userId, target, feature, worst);
			if (again !== null) {
				reservations.push(again);
				result = await call(true);
				usage.push(...result.usage);
				billedUnknown ||= !result.ok && !!result.billedUnknown;
				validated = result.ok ? check(result.text) : null;
			}
		}

		if (!result.ok) {
			record('failed', await finish('failed'), `${result.error}: ${result.message}`, null);
			return aiError(result.status, result.error, result.message);
		}
		const cost = await finish(validated!.ok ? 'done' : 'failed');
		if (!validated!.ok) {
			record('invalid', cost, validated!.error, result.text);
			return aiError(502, 'invalid_output', `The model's reply was not usable: ${validated!.error}`);
		}
		record('done', cost, null, result.text, validated!.value);
		return json(validated!.value);
	} catch (e) {
		billedUnknown = true;
		await finish('failed').catch(() => {});
		record('failed', null, (e as Error)?.message ?? 'error', null);
		throw e;
	}
}
