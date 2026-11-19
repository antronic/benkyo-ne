/**
 * /api/ai/* — every route needs a passkey session (401 otherwise) and the
 * current beta consent (403 consent_required otherwise).
 *
 *   GET    /api/ai/credentials           → CredentialInfo[]
 *   POST   /api/ai/credentials           CredentialInput → CredentialInfo
 *   DELETE /api/ai/credentials/:id       → {ok: true}
 *   GET    /api/ai/models[?credential=]  → ModelInfo[]  (header x-model-errors: JSON per-credential failures)
 *   PUT    /api/ai/prices                {provider, model, inputPerM, outputPerM}
 *   GET    /api/ai/features              → FeatureModel[]
 *   PUT    /api/ai/features              {feature, credentialId, model} → FeatureModel
 *   GET    /api/ai/usage                 → Usage
 *   PUT    /api/ai/cap                   {capUsd} → Usage
 *   GET    /api/ai/managed               → ManagedAi (the package's AI, allowance, which AI is in use)
 *   PUT    /api/ai/managed               {prefer: 'package' | 'own'} → ManagedAi
 *   POST   /api/ai/propose               ProposeRequest → ProposeResponse
 *   POST   /api/ai/fill                  FillRequest → FillResponse
 *   POST   /api/ai/lesson                LessonRequest → LessonResponse
 *   POST   /api/ai/ask                   AskRequest → AskResponse
 *   POST   /api/ai/ask/stream            AskRequest → text/event-stream (see ask.ts)
 */
import type { Env } from '../env.ts';
import { aiError, httpError, json, readJson } from '../http.ts';
import { getSession } from '../auth/passkey.ts';
import { createCredential, deleteCredential, getCredential, listCredentials, toInfo } from './credentials.ts';
import { getUsage, setCap } from './ledger.ts';
import { dropModelCache, featureModels, listAllModels, setFeatureModel, setManualPrice } from './models.ts';
import { handleGenerate } from './run.ts';
import { handleAskStream } from './ask.ts';
import { managedStatus, setPreference } from './managed.ts';
import { requireConsent } from '../beta/routes.ts';

export async function handleAi(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
	const session = await getSession(req, env);
	if (!session) return aiError(401, 'unauthorized', 'Sign in with your passkey first');
	// Beta: account features need the current consent (docs/BETA-DATA.md).
	await requireConsent(env, session.userId);
	const path = url.pathname;
	const m = req.method;
	const uid = session.userId;

	if (path === '/api/ai/credentials') {
		if (m === 'GET') return json((await listCredentials(env, uid)).map(toInfo));
		if (m === 'POST') return json(await createCredential(env, uid, await readJson(req), url), { status: 201 });
	}
	const credMatch = /^\/api\/ai\/credentials\/(\d+)$/.exec(path);
	if (credMatch && m === 'DELETE') {
		const id = Number(credMatch[1]);
		const cred = await getCredential(env, uid, id);
		if (!cred || !(await deleteCredential(env, uid, id))) return aiError(404, 'bad_request', 'No such credential');
		ctx.waitUntil(dropModelCache(cred).catch(() => {}));
		return json({ ok: true });
	}
	if (path === '/api/ai/models' && m === 'GET') {
		const c = url.searchParams.get('credential');
		const only = c === null ? undefined : Number(c);
		if (only !== undefined && !Number.isInteger(only)) throw httpError(400, 'bad_request', 'bad credential');
		const { models, errors } = await listAllModels(env, ctx, uid, only);
		return json(models, errors.length ? { headers: { 'x-model-errors': JSON.stringify(errors) } } : {});
	}
	if (path === '/api/ai/prices' && m === 'PUT') return json(await setManualPrice(env, uid, await readJson(req)));
	if (path === '/api/ai/features') {
		if (m === 'GET') return json(await featureModels(env, uid));
		if (m === 'PUT') return json(await setFeatureModel(env, uid, await readJson(req)));
	}
	if (path === '/api/ai/usage' && m === 'GET') return json(await getUsage(env, uid));
	if (path === '/api/ai/cap' && m === 'PUT') {
		const b = (await readJson(req)) as { capUsd?: unknown };
		const cap = b?.capUsd;
		if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0 || cap > 1000)
			throw httpError(400, 'bad_request', 'capUsd must be a number between 0 and 1000');
		await setCap(env, uid, cap);
		return json(await getUsage(env, uid));
	}
	if (path === '/api/ai/managed') {
		if (m === 'GET') return json(await managedStatus(env, uid));
		if (m === 'PUT') {
			await setPreference(env, uid, await readJson(req));
			return json(await managedStatus(env, uid));
		}
	}
	if (path === '/api/ai/propose' && m === 'POST') return handleGenerate('propose', req, env, ctx, session);
	if (path === '/api/ai/fill' && m === 'POST') return handleGenerate('fill', req, env, ctx, session);
	if (path === '/api/ai/lesson' && m === 'POST') return handleGenerate('lesson', req, env, ctx, session);
	if (path === '/api/ai/ask' && m === 'POST') return handleGenerate('ask', req, env, ctx, session);
	if (path === '/api/ai/ask/stream' && m === 'POST') return handleAskStream(req, env, ctx, session);
	return aiError(404, 'bad_request', 'Not found');
}
