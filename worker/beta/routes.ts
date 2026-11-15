/**
 * Beta consent + usage data (docs/BETA-DATA.md). Every route needs a session;
 * the account always comes from the session, never from the request.
 *
 *   GET    /api/beta/status            → BetaStatus
 *   POST   /api/beta/consent {version} → BetaStatus   agree to the current version
 *   DELETE /api/beta/consent           → BetaStatus   withdraw: stop collecting and delete usage data
 *   POST   /api/beta/events {events}   → {stored}     needs current consent (403 consent_required)
 *   GET    /api/beta/export            → JSON download of this account's consent history and usage data
 *   DELETE /api/beta/data              → {ok}         delete usage data, keep consent
 *
 * AI calls are recorded server side (recordAiCall, from worker/ai/run.ts and
 * ask.ts) so prompts and replies are captured exactly as sent and received.
 */
import { CONSENT_VERSION, RETENTION_DAYS, parseEvents, type BetaStatus } from '../../src/lib/beta/contract.ts';
import { scrub, scrubText } from '../../src/lib/beta/scrub.ts';
import type { Session } from '../auth/passkey.ts';
import { getSession } from '../auth/passkey.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { rateLimit } from '../ai/ledger.ts';

const DAY = 86_400_000;
/** cap on each stored text field of an AI call (D1 rows top out at 2 MB) */
const MAX_TEXT = 48 * 1024;
/** export reads in pages of this many rows, until everything is read */
const EXPORT_PAGE = 5_000;
/** request ceiling for one events batch: 100 events × 8 KiB data, plus room */
const MAX_EVENTS_BODY = 1024 * 1024;

// --------------------------------------------------------------- consent ----

export async function betaStatus(env: Env, userId: number): Promise<BetaStatus> {
	const row = await env.DB.prepare(
		`SELECT version, accepted_at AS acceptedAt FROM beta_consents
		  WHERE user_id = ?1 AND withdrawn_at IS NULL ORDER BY accepted_at DESC, id DESC LIMIT 1`
	)
		.bind(userId)
		.first<{ version: number; acceptedAt: number }>();
	return {
		version: CONSENT_VERSION,
		acceptedVersion: row?.version ?? null,
		acceptedAt: row?.acceptedAt ?? null,
		retentionDays: RETENTION_DAYS
	};
}

export async function hasConsent(env: Env, userId: number): Promise<boolean> {
	return (await betaStatus(env, userId)).acceptedVersion === CONSENT_VERSION;
}

/** Throws 403 consent_required unless the account agreed to the current version. */
export async function requireConsent(env: Env, userId: number) {
	if (!(await hasConsent(env, userId)))
		throw httpError(403, 'consent_required', 'Please review and agree to the beta terms to keep using your account.');
}

async function accept(req: Request, env: Env, s: Session) {
	const body = (await readJson(req)) as { version?: unknown };
	if (body?.version !== CONSENT_VERSION)
		throw httpError(409, 'bad_request', 'The beta terms changed. Reload the app to see the latest version.');
	const ua = (req.headers.get('user-agent') ?? '').slice(0, 400) || null;
	await env.DB.prepare(`INSERT INTO beta_consents (user_id, version, accepted_at, user_agent) VALUES (?1, ?2, ?3, ?4)`)
		.bind(s.userId, CONSENT_VERSION, Date.now(), ua)
		.run();
	return json(await betaStatus(env, s.userId));
}

/** Delete usage data (events + AI calls); consent records stay. */
export async function deleteUsageData(env: Env, userId: number) {
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM beta_events WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM beta_ai_calls WHERE user_id = ?1`).bind(userId)
	]);
}

/** Statements that delete everything beta-related for an account (account deletion). */
export function deleteBetaStatements(env: Env, userId: number) {
	return [
		env.DB.prepare(`DELETE FROM beta_events WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM beta_ai_calls WHERE user_id = ?1`).bind(userId),
		env.DB.prepare(`DELETE FROM beta_consents WHERE user_id = ?1`).bind(userId)
	];
}

async function withdraw(env: Env, s: Session) {
	await env.DB.batch([
		env.DB.prepare(`UPDATE beta_consents SET withdrawn_at = ?1 WHERE user_id = ?2 AND withdrawn_at IS NULL`).bind(Date.now(), s.userId),
		env.DB.prepare(`DELETE FROM beta_events WHERE user_id = ?1`).bind(s.userId),
		env.DB.prepare(`DELETE FROM beta_ai_calls WHERE user_id = ?1`).bind(s.userId)
	]);
	return json(await betaStatus(env, s.userId));
}

// ---------------------------------------------------------------- events ----

async function ingest(req: Request, env: Env, s: Session) {
	await requireConsent(env, s.userId);
	// generous: the app batches, so this only stops a runaway loop
	if (!(await rateLimit(env, `beta:${s.userId}`, 60)))
		throw httpError(429, 'rate_limited', 'Too many usage reports; try again in a minute');
	const events = parseEvents(await readJson(req, MAX_EVENTS_BODY));
	if (!events.length) return json({ stored: 0 });
	const now = Date.now();
	const country = (req as Request & { cf?: { country?: string } }).cf?.country ?? null;
	const stmt = env.DB.prepare(
		`INSERT INTO beta_events (user_id, received_at, at, app_session, kind, name, route, app_version, country, data_json)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
	);
	await env.DB.batch(
		events.map((e) =>
			stmt.bind(s.userId, now, e.at, e.sid || null, e.kind, e.name, e.route ?? null, e.appVersion ?? null, country, e.data ? JSON.stringify(e.data) : null)
		)
	);
	return json({ stored: events.length });
}

// ---------------------------------------------------------------- AI ----

export interface AiCallRecord {
	kind: 'propose' | 'fill' | 'lesson' | 'ask' | 'ask_stream';
	feature?: string;
	provider?: string;
	model?: string;
	status: 'done' | 'failed' | 'invalid' | 'stopped';
	error?: string | null;
	startedAt: number;
	inputTokens?: number;
	outputTokens?: number;
	costUsd?: number | null;
	/** the parsed request from the app; an attached image is reduced to its type and size */
	request: unknown;
	system?: string;
	user?: string;
	outputText?: string | null;
	result?: unknown;
}

const clip = (s: string | null | undefined) => (s == null ? null : scrubText(s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…[truncated]` : s));

/** Replace base64 image payloads with their size so screenshots aren't stored. */
export function withoutImages(v: unknown, depth = 0): unknown {
	if (!v || typeof v !== 'object' || depth > 5) return v;
	if (Array.isArray(v)) return v.map((x) => withoutImages(x, depth + 1));
	const o = v as Record<string, unknown>;
	if (typeof o.base64 === 'string')
		return { mediaType: o.mediaType ?? null, bytes: Math.floor((o.base64.length * 3) / 4), stored: false };
	return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, withoutImages(x, depth + 1)]));
}

const jsonOrNull = (v: unknown) => (v === undefined || v === null ? null : clip(JSON.stringify(scrub(withoutImages(v)))));

/** Record one AI call if the account has consented. Never throws. */
export async function recordAiCall(env: Env, userId: number, r: AiCallRecord) {
	try {
		if (!(await hasConsent(env, userId))) return;
		await env.DB.prepare(
			`INSERT INTO beta_ai_calls (user_id, at, kind, feature, provider, model, status, error, latency_ms, input_tokens, output_tokens,
			                            cost_usd, request_json, prompt_system, prompt_user, output_text, result_json)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
		)
			.bind(
				userId,
				r.startedAt,
				r.kind,
				r.feature ?? null,
				r.provider ?? null,
				r.model ?? null,
				r.status,
				r.error ? scrubText(r.error.slice(0, 500)) : null,
				Date.now() - r.startedAt,
				r.inputTokens ?? null,
				r.outputTokens ?? null,
				r.costUsd ?? null,
				jsonOrNull(r.request),
				clip(r.system),
				clip(r.user),
				clip(r.outputText),
				jsonOrNull(r.result)
			)
			.run();
	} catch (e) {
		console.error('beta: recordAiCall failed', e);
	}
}

// ---------------------------------------------------------------- export ----

/** Every row of a query, read EXPORT_PAGE at a time (keyset on id). */
async function allRows<T extends { id: number }>(env: Env, sql: string, userId: number): Promise<T[]> {
	const out: T[] = [];
	let after = 0;
	for (;;) {
		const { results } = await env.DB.prepare(sql).bind(userId, after, EXPORT_PAGE).all<T>();
		out.push(...results);
		if (results.length < EXPORT_PAGE) return out;
		after = results[results.length - 1].id;
	}
}

async function exportData(env: Env, s: Session) {
	const [consents, events, aiCalls] = await Promise.all([
		env.DB.prepare(`SELECT version, accepted_at AS acceptedAt, withdrawn_at AS withdrawnAt, user_agent AS userAgent FROM beta_consents WHERE user_id = ?1 ORDER BY accepted_at`)
			.bind(s.userId)
			.all(),
		allRows<{ id: number; data: string | null } & Record<string, unknown>>(
			env,
			`SELECT id, at, received_at AS receivedAt, app_session AS appSession, kind, name, route, app_version AS appVersion, country, data_json AS data
			   FROM beta_events WHERE user_id = ?1 AND id > ?2 ORDER BY id LIMIT ?3`,
			s.userId
		),
		allRows<{ id: number; request: string | null; result: string | null } & Record<string, unknown>>(
			env,
			`SELECT id, at, kind, feature, provider, model, status, error, latency_ms AS latencyMs, input_tokens AS inputTokens, output_tokens AS outputTokens,
			        cost_usd AS costUsd, request_json AS request, prompt_system AS promptSystem, prompt_user AS promptUser,
			        output_text AS outputText, result_json AS result
			   FROM beta_ai_calls WHERE user_id = ?1 AND id > ?2 ORDER BY id LIMIT ?3`,
			s.userId
		)
	]);
	const parse = (t: string | null) => {
		try {
			return t ? JSON.parse(t) : null;
		} catch {
			return t;
		}
	};
	const body = {
		exportedAt: new Date().toISOString(),
		account: { id: s.userId, name: s.name },
		retentionDays: RETENTION_DAYS,
		consents: consents.results,
		events: events.map(({ id: _id, ...e }) => ({ ...e, data: parse(e.data) })),
		aiCalls: aiCalls.map(({ id: _id, ...a }) => ({ ...a, request: parse(a.request), result: parse(a.result) }))
	};
	return json(body, { headers: { 'content-disposition': `attachment; filename="benkyo-beta-data-${new Date().toISOString().slice(0, 10)}.json"` } });
}

// ------------------------------------------------------------- retention ----

/** Daily cron: delete usage data older than RETENTION_DAYS. */
export async function purgeOld(env: Env, now = Date.now()) {
	const cutoff = now - RETENTION_DAYS * DAY;
	const [a, b] = await env.DB.batch([
		env.DB.prepare(`DELETE FROM beta_events WHERE received_at < ?1`).bind(cutoff),
		env.DB.prepare(`DELETE FROM beta_ai_calls WHERE at < ?1`).bind(cutoff)
	]);
	return { events: a.meta.changes ?? 0, aiCalls: b.meta.changes ?? 0 };
}

// ---------------------------------------------------------------- router ----

export async function handleBeta(req: Request, env: Env, path: string): Promise<Response | null> {
	if (!path.startsWith('/api/beta/')) return null;
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	const m = req.method;
	if (path === '/api/beta/status' && m === 'GET') return json(await betaStatus(env, s.userId));
	if (path === '/api/beta/consent' && m === 'POST') return accept(req, env, s);
	if (path === '/api/beta/consent' && m === 'DELETE') return withdraw(env, s);
	if (path === '/api/beta/events' && m === 'POST') return ingest(req, env, s);
	if (path === '/api/beta/export' && m === 'GET') return exportData(env, s);
	if (path === '/api/beta/data' && m === 'DELETE') {
		await deleteUsageData(env, s.userId);
		return json({ ok: true });
	}
	return null;
}
