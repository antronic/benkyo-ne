/**
 * Content feedback from learners (docs/FEEDBACK.md). Signed in only.
 *
 *   GET  /api/feedback/mine                                   → {votes: {subject: 1 | -1}}
 *   POST /api/feedback/vote {subject, label, vote}            1 up, -1 down, 0 takes your vote back
 *   POST /api/feedback/report {subject, label, reason, detail, locale}
 *
 * One vote per account per subject, one open report per account per subject.
 * Job reads both in Fleet (worker/admin/feedback.ts). Handled reports are
 * deleted after REPORT_KEEP_DAYS (purgeFeedback, from the daily cron).
 */
import {
	FEEDBACK_DETAIL_MAX,
	FEEDBACK_LABEL_MAX,
	FEEDBACK_REASONS,
	FEEDBACK_SUBJECT_RE,
	type MyVotes
} from '../src/lib/feedback/contract.ts';
import { rateLimit } from './ai/ledger.ts';
import { getSession, type Session } from './auth/passkey.ts';
import type { Env } from './env.ts';
import { HttpError, httpError, json, readJson } from './http.ts';

const DAY = 24 * 60 * 60 * 1000;
/** per account per day */
export const FEEDBACK_LIMITS = { votes: 500, reports: 30 } as const;
export const REPORT_KEEP_DAYS = 180;
const MINE_MAX = 5000;

const subjectOf = (raw: unknown) => {
	const s = typeof raw === 'string' ? raw.trim() : '';
	if (!FEEDBACK_SUBJECT_RE.test(s)) throw httpError(400, 'bad_request', 'Unknown content');
	return s;
};
const labelOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().slice(0, FEEDBACK_LABEL_MAX) : '');

async function limited(env: Env, s: Session, what: keyof typeof FEEDBACK_LIMITS, now: number) {
	if (!(await rateLimit(env, `feedback:${what}:${s.userId}`, FEEDBACK_LIMITS[what], now, 1440)))
		throw httpError(429, 'rate_limited', 'That’s a lot for one day. Try again tomorrow');
}

export async function myVotes(env: Env, accountId: number): Promise<MyVotes> {
	const { results } = await env.DB.prepare(`SELECT subject, vote FROM content_votes WHERE account_id = ?1 ORDER BY updated_at DESC LIMIT ${MINE_MAX}`)
		.bind(accountId)
		.all<{ subject: string; vote: 1 | -1 }>();
	return { votes: Object.fromEntries(results.map((r) => [r.subject, r.vote])) };
}

export async function vote(env: Env, s: Session, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as { subject?: unknown; label?: unknown; vote?: unknown };
	const subject = subjectOf(b.subject);
	if (b.vote !== 1 && b.vote !== -1 && b.vote !== 0) throw httpError(400, 'bad_request', 'A vote is 1, -1 or 0');
	await limited(env, s, 'votes', now);
	if (b.vote === 0) await env.DB.prepare(`DELETE FROM content_votes WHERE subject = ?1 AND account_id = ?2`).bind(subject, s.userId).run();
	else
		await env.DB.prepare(
			`INSERT INTO content_votes (subject, account_id, vote, label, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
			 ON CONFLICT (subject, account_id) DO UPDATE SET vote = excluded.vote, label = excluded.label, updated_at = excluded.updated_at`
		)
			.bind(subject, s.userId, b.vote, labelOf(b.label), now)
			.run();
	return { vote: b.vote };
}

export async function report(env: Env, s: Session, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as { subject?: unknown; label?: unknown; reason?: unknown; detail?: unknown; locale?: unknown };
	const subject = subjectOf(b.subject);
	if (!FEEDBACK_REASONS.includes(b.reason as never)) throw httpError(400, 'bad_request', 'Pick a reason');
	const detail = typeof b.detail === 'string' ? b.detail.trim().slice(0, FEEDBACK_DETAIL_MAX) : '';
	const locale = typeof b.locale === 'string' && /^[a-z]{2}$/.test(b.locale) ? b.locale : '';
	const open = await env.DB.prepare(`SELECT 1 AS x FROM content_reports WHERE subject = ?1 AND account_id = ?2 AND status = 'open'`)
		.bind(subject, s.userId)
		.first();
	if (open) throw new HttpError(409, { error: 'bad_request', message: 'You already reported this', problem: 'already_reported' } as never);
	await limited(env, s, 'reports', now);
	await env.DB.prepare(
		`INSERT INTO content_reports (subject, label, account_id, reason, detail, locale, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
	)
		.bind(subject, labelOf(b.label), s.userId, b.reason, detail, locale, now)
		.run();
	return { ok: true };
}

/** Daily: forget reports Job handled more than REPORT_KEEP_DAYS ago. */
export async function purgeFeedback(env: Env, now = Date.now()) {
	const r = await env.DB.prepare(`DELETE FROM content_reports WHERE status != 'open' AND handled_at < ?1`).bind(now - REPORT_KEEP_DAYS * DAY).run();
	return r.meta.changes ?? 0;
}

export async function handleFeedback(req: Request, env: Env, url: URL): Promise<Response | null> {
	const p = url.pathname;
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	if (p === '/api/feedback/mine' && req.method === 'GET') return json(await myVotes(env, s.userId));
	if (p === '/api/feedback/vote' && req.method === 'POST') return json(await vote(env, s, await readJson(req, 1024)));
	if (p === '/api/feedback/report' && req.method === 'POST') return json(await report(env, s, await readJson(req, 4096)));
	return null;
}
