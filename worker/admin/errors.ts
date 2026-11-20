/**
 * Fleet console: Errors (docs/DEBUGGING.md). The app sends caught errors as beta `error`
 * events (src/lib/debug/errors.svelte.ts), so they follow the beta consent, the 180-day
 * retention, the export and account deletion of beta_events. Read-only.
 *
 *   GET /api/admin/errors?days=1|7|30&q=&build=&offset=   groups and occurrences, newest first
 *   GET /api/admin/errors/:id                              one occurrence: stack, breadcrumbs, device, notes
 *
 * `q` matches the error id, message, screen, name or request id.
 */
import { ERROR_WINDOWS, type AdminErrorDetail, type AdminErrorEvent, type AdminErrors, type ErrorWindow } from '../../src/lib/admin/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json } from '../http.ts';
import type { AdminContext } from './routes.ts';

const DAY = 86_400_000;
const PAGE = 50;
const GROUPS = 30;

interface Row {
	id: number;
	at: number;
	accountId: number;
	accountName: string | null;
	name: string;
	route: string | null;
	build: string | null;
	country: string | null;
	data: string | null;
	hasNote: number;
	session: string | null;
}

const parse = (t: string | null): Record<string, unknown> => {
	try {
		const v = t ? JSON.parse(t) : null;
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {};
	}
};
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function toEvent(r: Row): AdminErrorEvent {
	const d = parse(r.data);
	return {
		id: r.id,
		at: r.at,
		accountId: r.accountId,
		accountName: r.accountName,
		name: r.name,
		route: r.route,
		build: r.build,
		country: r.country,
		errorId: str(d.errorId),
		message: str(d.message) ?? '',
		status: typeof d.status === 'number' ? d.status : null,
		requestId: str(d.requestId),
		hasNote: !!r.hasNote
	};
}

/** WHERE for the list and the groups: kind error, not a note, in the window, matching q and build. */
const FILTER = `e.kind = 'error' AND e.name <> 'error_note' AND e.received_at >= ?1
	AND (?2 IS NULL OR instr(lower(COALESCE(e.data_json, '') || ' ' || COALESCE(e.route, '') || ' ' || e.name), lower(?2)) > 0)
	AND (?3 IS NULL OR e.app_version = ?3)`;

const NOTE = `EXISTS (SELECT 1 FROM beta_events n WHERE n.kind = 'error' AND n.name = 'error_note' AND n.user_id = e.user_id
	AND json_extract(n.data_json, '$.errorId') = json_extract(e.data_json, '$.errorId'))`;

const SELECT = `SELECT e.id, e.at, e.user_id AS accountId, a.name AS accountName, e.name, e.route, e.app_version AS build, e.country,
	e.data_json AS data, e.app_session AS session, ${NOTE} AS hasNote
	FROM beta_events e LEFT JOIN accounts a ON a.id = e.user_id`;

export async function listErrors(env: Env, days: ErrorWindow, q: string | null, build: string | null, offset: number, now = Date.now()): Promise<AdminErrors> {
	const since = now - days * DAY;
	const [rows, total, groups, builds] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`${SELECT} WHERE ${FILTER} ORDER BY e.at DESC, e.id DESC LIMIT ?4 OFFSET ?5`).bind(since, q, build, PAGE + 1, offset),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM beta_events e WHERE ${FILTER}`).bind(since, q, build),
		env.DB.prepare(
			`SELECT e.name, COALESCE(json_extract(e.data_json, '$.message'), '') AS message, COUNT(*) AS count, COUNT(DISTINCT e.user_id) AS accounts,
			        MIN(e.at) AS firstAt, MAX(e.at) AS lastAt, MAX(e.app_version) AS lastBuild
			   FROM beta_events e WHERE ${FILTER}
			  GROUP BY e.name, message ORDER BY count DESC, lastAt DESC LIMIT ${GROUPS}`
		).bind(since, q, build),
		env.DB.prepare(
			`SELECT DISTINCT app_version AS build FROM beta_events
			  WHERE kind = 'error' AND received_at >= ?1 AND app_version IS NOT NULL ORDER BY app_version DESC LIMIT 20`
		).bind(since)
	]);
	const list = (rows.results as unknown as Row[]).map(toEvent);
	return {
		days,
		total: (total.results[0] as unknown as { n: number }).n,
		groups: groups.results as unknown as AdminErrors['groups'],
		events: list.slice(0, PAGE),
		next: list.length > PAGE ? offset + PAGE : null,
		builds: (builds.results as unknown as { build: string }[]).map((b) => b.build)
	};
}

export async function errorDetail(env: Env, id: number): Promise<AdminErrorDetail> {
	const row = await env.DB.prepare(`${SELECT} WHERE e.id = ?1 AND e.kind = 'error'`).bind(id).first<Row>();
	if (!row) throw httpError(404, 'bad_request', 'That error isn’t there any more (errors are kept for 180 days)');
	const event = toEvent(row);
	const d = parse(row.data);
	const [device, notes] = await env.DB.batch<Record<string, never>>([
		// the device snapshot of the same launch; else the account's last one before the error
		env.DB.prepare(
			`SELECT data_json AS data FROM beta_events
			  WHERE user_id = ?1 AND kind = 'device' AND (app_session = ?2 OR at <= ?3)
			  ORDER BY (app_session = ?2) DESC, at DESC LIMIT 1`
		).bind(row.accountId, row.session ?? '', row.at),
		env.DB.prepare(
			`SELECT at, json_extract(data_json, '$.note') AS note FROM beta_events
			  WHERE user_id = ?1 AND kind = 'error' AND name = 'error_note' AND json_extract(data_json, '$.errorId') = ?2 ORDER BY at`
		).bind(row.accountId, event.errorId ?? '')
	]);
	const { errorId: _i, message: _m, type, stack, status: _s, requestId: _r, breadcrumbs, ...extra } = d;
	const deviceRow = device.results[0] as unknown as { data: string | null } | undefined;
	return {
		event,
		type: str(type),
		stack: str(stack),
		breadcrumbs: Array.isArray(breadcrumbs)
			? breadcrumbs
					.filter((c): c is { at: number; kind: string; text: string } => !!c && typeof c === 'object')
					.map((c) => ({ at: Number(c.at) || 0, kind: String(c.kind ?? ''), text: String(c.text ?? '') }))
			: [],
		extra,
		device: deviceRow ? parse(deviceRow.data) : null,
		notes: (notes.results as unknown as { at: number; note: string | null }[]).map((n) => ({ at: n.at, note: n.note ?? '' }))
	};
}

export async function handleErrorsAdmin(req: Request, env: Env, url: URL, _ctx: AdminContext): Promise<Response | null> {
	if (req.method !== 'GET') return null;
	const p = url.pathname;
	if (p === '/api/admin/errors') {
		const days = Number(url.searchParams.get('days') ?? 7);
		if (!(ERROR_WINDOWS as readonly number[]).includes(days)) throw httpError(400, 'bad_request', 'days must be 1, 7 or 30');
		const q = url.searchParams.get('q')?.trim().slice(0, 100) || null;
		const build = url.searchParams.get('build')?.slice(0, 40) || null;
		const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') ?? 0)) || 0);
		return json(await listErrors(env, days as ErrorWindow, q, build, offset));
	}
	const m = p.match(/^\/api\/admin\/errors\/(\d+)$/);
	if (m) return json(await errorDetail(env, Number(m[1])));
	return null;
}
