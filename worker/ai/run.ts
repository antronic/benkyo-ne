/**
 * POST /api/ai/propose and /api/ai/fill.
 *
 * auth (caller) → rate limit → resolve feature model ('vision' when an image
 * is attached) → price known? (409 no_price) → reserve worst case under the cap
 * (402 cap_reached) → call provider → settle ledger with actual usage →
 * validate output (502 invalid_output) → respond.
 */
import type { AskRequest, Feature, FillRequest, LessonRequest, ProposeRequest } from '../../src/lib/ai/contract.ts';
import { buildAskPrompt, buildFillPrompt, buildLessonPrompt, buildProposePrompt, type PromptParts } from '../../src/lib/ai/prompts.ts';
import {
	parseAskRequest,
	parseFillRequest,
	parseLessonRequest,
	parseModelJson,
	parseProposeRequest,
	validateAskOutput,
	validateFillOutput,
	validateLessonOutput,
	validateProposeOutput,
	type Result
} from '../../src/lib/ai/validate.ts';
import type { Env } from '../env.ts';
import { aiError, json, readJson } from '../http.ts';
import type { Session } from '../auth/passkey.ts';
import { callAnthropic } from './anthropic.ts';
import { sumUsage, usageCost, worstCaseForCall } from './cost.ts';
import { decryptKey } from './credentials.ts';
import { getUsage, rateLimit, reserve, settle } from './ledger.ts';
import { priceFor, resolveFeature } from './models.ts';
import { callOpenAi, type OpenAiFormat } from './openai.ts';
import type { AdapterResult, UsageEntry } from './types.ts';

const MAX_BODY = 8 * 1024 * 1024; // screenshots

type Kind = 'propose' | 'fill' | 'lesson' | 'ask';
type Req = ProposeRequest | FillRequest | LessonRequest | AskRequest;

export async function handleGenerate(kind: Kind, req: Request, env: Env, ctx: ExecutionContext, session: Session) {
	const body = await readJson(req, kind === 'propose' ? MAX_BODY : 256 * 1024);
	const parsed: Result<Req> =
		kind === 'propose'
			? parseProposeRequest(body)
			: kind === 'fill'
				? parseFillRequest(body)
				: kind === 'lesson'
					? parseLessonRequest(body)
					: parseAskRequest(body);
	if (!parsed.ok) return aiError(400, 'bad_request', parsed.error);

	if (!(await rateLimit(env, session.tokenHash)))
		return aiError(429, 'rate_limited', 'Too many AI calls; wait a minute and try again.', { 'retry-after': '60' });

	const parts: PromptParts =
		kind === 'propose'
			? buildProposePrompt(parsed.value as ProposeRequest)
			: kind === 'fill'
				? buildFillPrompt(parsed.value as FillRequest)
				: kind === 'lesson'
					? buildLessonPrompt(parsed.value as LessonRequest)
					: buildAskPrompt(parsed.value as AskRequest);
	// lesson packs and Ask AI use the "Suggestions" model
	const feature: Feature = parts.image ? 'vision' : kind === 'fill' ? 'fill' : 'propose';

	const target = await resolveFeature(env, feature);
	if (!target) return aiError(409, 'no_model', `No model is set for "${feature}". Add an API key in Settings.`);
	const { cred, model } = target;

	const priced = await priceFor(env, ctx, cred, model);
	if (!priced) return aiError(409, 'no_price', `Set a price for ${model} to use it under the spend cap.`);

	const apiKey = await decryptKey(env, cred);
	const worst = worstCaseForCall(parts, cred.provider, model, priced.price);
	const reservations: number[] = [];
	const first = await reserve(env, { feature, provider: cred.provider, model, worstUsd: worst });
	if (first === null) {
		const u = await getUsage(env);
		return aiError(
			402,
			'cap_reached',
			`Monthly AI cap reached ($${u.spentUsd.toFixed(3)} of $${u.capUsd.toFixed(2)} used; this call could cost up to $${worst.toFixed(3)}).`
		);
	}
	reservations.push(first);

	const usage: UsageEntry[] = [];
	let billedUnknown = false;
	const finish = async (status: 'done' | 'failed') => {
		// Outcome unknown (dropped connection/timeout): keep every reserved worst case.
		const cost = billedUnknown ? null : usageCost(usage, model, priced.price);
		await settle(env, reservations, { status, usage: sumUsage(usage), cost });
	};

	try {
		let format: OpenAiFormat | undefined; // remembered so the retry skips a rejected json_schema
		const call = async (retry: boolean): Promise<AdapterResult> => {
			if (cred.provider === 'anthropic') return callAnthropic(parts, model, apiKey);
			const r = await callOpenAi(parts, model, cred.base_url!, apiKey, { retry, format });
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
		if (cred.provider === 'openai-compatible' && malformed) {
			const again = await reserve(env, { feature, provider: cred.provider, model, worstUsd: worst });
			if (again !== null) {
				reservations.push(again);
				result = await call(true);
				usage.push(...result.usage);
				billedUnknown ||= !result.ok && !!result.billedUnknown;
				validated = result.ok ? check(result.text) : null;
			}
		}

		if (!result.ok) {
			await finish('failed');
			return aiError(result.status, result.error, result.message);
		}
		await finish(validated!.ok ? 'done' : 'failed');
		if (!validated!.ok) return aiError(502, 'invalid_output', `The model's reply was not usable: ${validated!.error}`);
		return json(validated!.value);
	} catch (e) {
		billedUnknown = true;
		await finish('failed').catch(() => {});
		throw e;
	}
}
