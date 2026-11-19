/**
 * Fleet console: Content feedback (docs/FEEDBACK.md). The learner's side is worker/feedback.ts.
 *
 *   GET  /api/admin/feedback                         totals, the most reported and down-voted content, open reports
 *   POST /api/admin/feedback/report {id, status}     fixed | dismissed | open (reopen)
 *
 * Every change is written to admin_audit.
 */
import type { AdminFeedback, AdminFeedbackReport, AdminFeedbackSubject, FeedbackReportStatus } from '../../src/lib/feedback/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { audited, type AdminContext } from './routes.ts';

const LIST = 100;
const STATUSES: FeedbackReportStatus[] = ['open', 'fixed', 'dismissed'];

export async function feedbackOverview(env: Env): Promise<AdminFeedback> {
	const [totals, open, subjects, reports] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(`SELECT COALESCE(SUM(vote = 1), 0) AS up, COALESCE(SUM(vote = -1), 0) AS down FROM content_votes`),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM content_reports WHERE status = 'open'`),
		env.DB.prepare(
			`WITH v AS (SELECT subject, MAX(label) AS label, SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM content_votes GROUP BY subject),
			      r AS (SELECT subject, MAX(label) AS label, COUNT(*) AS open FROM content_reports WHERE status = 'open' GROUP BY subject),
			      s AS (SELECT subject FROM v UNION SELECT subject FROM r)
			 SELECT s.subject, COALESCE(r.label, v.label, '') AS label, COALESCE(v.up, 0) AS up, COALESCE(v.down, 0) AS down, COALESCE(r.open, 0) AS open
			   FROM s LEFT JOIN v ON v.subject = s.subject LEFT JOIN r ON r.subject = s.subject
			  ORDER BY open DESC, down DESC, up ASC, s.subject LIMIT ${LIST}`
		),
		env.DB.prepare(
			`SELECT id, subject, label, reason, detail, locale, created_at AS createdAt FROM content_reports WHERE status = 'open' ORDER BY created_at, id LIMIT ${LIST}`
		)
	]);
	const t = totals.results[0] as unknown as { up: number; down: number };
	return {
		up: t.up,
		down: t.down,
		open: (open.results[0] as unknown as { n: number }).n,
		subjects: subjects.results as unknown as AdminFeedbackSubject[],
		reports: reports.results as unknown as AdminFeedbackReport[]
	};
}

export async function setReportStatus(env: Env, ctx: AdminContext, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as { id?: unknown; status?: unknown };
	if (typeof b.id !== 'number' || !Number.isInteger(b.id)) throw httpError(400, 'bad_request', 'Which report?');
	if (!STATUSES.includes(b.status as never)) throw httpError(400, 'bad_request', 'Status is open, fixed or dismissed');
	const row = await env.DB.prepare(`SELECT subject FROM content_reports WHERE id = ?1`).bind(b.id).first<{ subject: string }>();
	if (!row) throw httpError(404, 'bad_request', 'That report isn’t there any more');
	await audited(env, ctx, `feedback.${b.status}`, b.id, { subject: row.subject }, [
		env.DB.prepare(`UPDATE content_reports SET status = ?2, handled_at = ?3 WHERE id = ?1`).bind(b.id, b.status, b.status === 'open' ? null : now)
	]);
	return { ok: true };
}

export async function handleFeedbackAdmin(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	if (p === '/api/admin/feedback' && req.method === 'GET') return json(await feedbackOverview(env));
	if (p === '/api/admin/feedback/report' && req.method === 'POST') return json(await setReportStatus(env, ctx, await readJson(req, 1024)));
	return null;
}
