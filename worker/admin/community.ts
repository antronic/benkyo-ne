/**
 * Fleet console: Community moderation (docs/COMMUNITY.md). The learner's side is worker/community.ts.
 *
 *   GET  /api/admin/community                                  counts and the queue of reported posts and replies
 *   POST /api/admin/community/content {kind, id, action}       dismiss | hide | restore, or remove (step-up)
 *   POST /api/admin/community/author {accountId, status}       active, or muted / banned (step-up)
 *
 * The queue holds every post or reply with an open report, oldest report first.
 * Dismissing closes its reports and puts back a note that reports hid; hide and
 * remove close them as actioned. Removed content is purged after 90 days
 * (purgeCommunity). Every action is written to admin_audit.
 */
import type { AdminCommunity, AdminContentAction, AdminReportItem, CommunityStatus, ReportReason, TargetKind } from '../../src/lib/community/contract.ts';
import type { Env } from '../env.ts';
import { httpError, json, readJson } from '../http.ts';
import { audited, requireFresh, type AdminContext } from './routes.ts';

const DAY = 24 * 60 * 60 * 1000;
const QUEUE = 50;

interface QueueRow {
	kind: TargetKind;
	id: number;
	openReports: number;
	firstReportAt: number;
}

async function item(env: Env, q: QueueRow): Promise<AdminReportItem | null> {
	const content =
		q.kind === 'post'
			? await env.DB.prepare(
					`SELECT p.id AS postId, p.subject, p.label, p.body, p.status, p.created_at AS createdAt, p.author_id AS authorId FROM community_posts p WHERE p.id = ?1`
				)
					.bind(q.id)
					.first<{ postId: number; subject: string; label: string; body: string; status: AdminReportItem['status']; createdAt: number; authorId: number }>()
			: await env.DB.prepare(
					`SELECT r.post_id AS postId, p.subject, p.label, r.body, r.status, r.created_at AS createdAt, r.author_id AS authorId
					   FROM community_replies r JOIN community_posts p ON p.id = r.post_id WHERE r.id = ?1`
				)
					.bind(q.id)
					.first<{ postId: number; subject: string; label: string; body: string; status: AdminReportItem['status']; createdAt: number; authorId: number }>();
	if (!content) return null;
	const [author, reports] = await env.DB.batch<Record<string, never>>([
		env.DB.prepare(
			`SELECT pr.handle, pr.status, a.disabled,
			        (SELECT COUNT(*) FROM community_posts WHERE author_id = ?1) + (SELECT COUNT(*) FROM community_replies WHERE author_id = ?1) AS posts,
			        (SELECT COUNT(*) FROM community_posts WHERE author_id = ?1 AND status = 'removed') + (SELECT COUNT(*) FROM community_replies WHERE author_id = ?1 AND status = 'removed') AS removed
			   FROM community_profiles pr JOIN accounts a ON a.id = pr.account_id WHERE pr.account_id = ?1`
		).bind(content.authorId),
		env.DB.prepare(
			`SELECT reason, detail, created_at AS at FROM community_reports WHERE target_kind = ?1 AND target_id = ?2 AND status = 'open' ORDER BY created_at`
		).bind(q.kind, q.id)
	]);
	const a = author.results[0] as unknown as { handle: string; status: CommunityStatus; disabled: number; posts: number; removed: number } | undefined;
	return {
		kind: q.kind,
		id: q.id,
		postId: content.postId,
		subject: content.subject,
		label: content.label,
		body: content.body,
		status: content.status,
		createdAt: content.createdAt,
		author: {
			accountId: content.authorId,
			handle: a?.handle ?? '',
			status: a?.status ?? 'active',
			posts: a?.posts ?? 0,
			removed: a?.removed ?? 0,
			disabled: !!a?.disabled
		},
		reports: reports.results as unknown as { reason: ReportReason; detail: string; at: number }[],
		openReports: q.openReports,
		firstReportAt: q.firstReportAt
	};
}

export async function communityOverview(env: Env, now = Date.now()): Promise<AdminCommunity> {
	const week = now - 7 * DAY;
	const [posts, replies, open, hidden, profiles, queue] = await env.DB.batch<Record<string, number>>([
		env.DB.prepare(`SELECT COUNT(*) AS n FROM community_posts WHERE created_at >= ?1`).bind(week),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM community_replies WHERE created_at >= ?1`).bind(week),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM community_reports WHERE status = 'open'`),
		env.DB.prepare(
			`SELECT (SELECT COUNT(*) FROM community_posts WHERE status = 'hidden') + (SELECT COUNT(*) FROM community_replies WHERE status = 'hidden') AS n`
		),
		env.DB.prepare(`SELECT COUNT(*) AS n FROM community_profiles`),
		env.DB.prepare(
			`SELECT target_kind AS kind, target_id AS id, COUNT(*) AS openReports, MIN(created_at) AS firstReportAt
			   FROM community_reports WHERE status = 'open' GROUP BY target_kind, target_id ORDER BY firstReportAt LIMIT ${QUEUE}`
		)
	]);
	const n = (r: { results: Record<string, number>[] }) => r.results[0]?.n ?? 0;
	const items = await Promise.all((queue.results as unknown as QueueRow[]).map((q) => item(env, q)));
	return {
		stats: { posts7d: n(posts), replies7d: n(replies), openReports: n(open), hidden: n(hidden), profiles: n(profiles) },
		queue: items.filter((i): i is AdminReportItem => i !== null)
	};
}

const TABLE: Record<TargetKind, string> = { post: 'community_posts', reply: 'community_replies' };
const ACTIONS: AdminContentAction[] = ['dismiss', 'hide', 'remove', 'restore'];

async function contentAction(env: Env, ctx: AdminContext, body: unknown) {
	const b = (body ?? {}) as { kind?: unknown; id?: unknown; action?: unknown };
	if ((b.kind !== 'post' && b.kind !== 'reply') || !Number.isInteger(b.id)) throw httpError(400, 'bad_request', 'kind must be post or reply, with an id');
	if (!ACTIONS.includes(b.action as AdminContentAction)) throw httpError(400, 'bad_request', 'action must be dismiss, hide, remove or restore');
	const kind = b.kind as TargetKind;
	const id = b.id as number;
	const action = b.action as AdminContentAction;
	if (action === 'remove') await requireFresh(env, ctx);
	const row = await env.DB.prepare(`SELECT author_id AS author, status FROM ${TABLE[kind]} WHERE id = ?1`).bind(id).first<{ author: number; status: string }>();
	if (!row) throw httpError(404, 'bad_request', 'That post or reply is gone');
	const now = Date.now();
	const close = (status: 'actioned' | 'dismissed') =>
		env.DB.prepare(
			`UPDATE community_reports SET status = ?3, handled_at = ?4, handled_by = ?5 WHERE target_kind = ?1 AND target_id = ?2 AND status = 'open'`
		).bind(kind, id, status, now, ctx.session.userId);
	const set = (status: 'published' | 'hidden' | 'removed') =>
		env.DB.prepare(`UPDATE ${TABLE[kind]} SET status = ?2, removed_at = ?3 WHERE id = ?1`).bind(id, status, status === 'removed' ? now : null);
	const statements =
		action === 'dismiss'
			? // reports were wrong: a note they hid goes back up (one a moderator hid stays hidden)
				[close('dismissed'), ...(row.status === 'hidden' ? [set('published')] : [])]
			: action === 'hide'
				? [set('hidden'), close('actioned')]
				: action === 'remove'
					? [set('removed'), close('actioned')]
					: [set('published'), close('dismissed')];
	await audited(env, ctx, `community.${action}`, row.author, { kind, id }, statements);
	return { ok: true };
}

const STATUSES: CommunityStatus[] = ['active', 'muted', 'banned'];

async function authorStatus(env: Env, ctx: AdminContext, body: unknown) {
	const b = (body ?? {}) as { accountId?: unknown; status?: unknown };
	if (!Number.isInteger(b.accountId)) throw httpError(400, 'bad_request', 'accountId is required');
	if (!STATUSES.includes(b.status as CommunityStatus)) throw httpError(400, 'bad_request', 'status must be active, muted or banned');
	if (b.status !== 'active') await requireFresh(env, ctx);
	const accountId = b.accountId as number;
	const has = await env.DB.prepare(`SELECT 1 AS x FROM community_profiles WHERE account_id = ?1`).bind(accountId).first();
	if (!has) throw httpError(404, 'bad_request', 'This account has no community profile');
	await audited(env, ctx, `community.${b.status === 'active' ? 'unmute' : b.status}`, accountId, { status: b.status }, [
		env.DB.prepare(`UPDATE community_profiles SET status = ?2, updated_at = ?3 WHERE account_id = ?1`).bind(accountId, b.status, Date.now())
	]);
	return { ok: true };
}

export async function handleCommunityAdmin(req: Request, env: Env, url: URL, ctx: AdminContext): Promise<Response | null> {
	const p = url.pathname;
	if (p === '/api/admin/community' && req.method === 'GET') return json(await communityOverview(env));
	if (p === '/api/admin/community/content' && req.method === 'POST') return json(await contentAction(env, ctx, await readJson(req, 1024)));
	if (p === '/api/admin/community/author' && req.method === 'POST') return json(await authorStatus(env, ctx, await readJson(req, 1024)));
	return null;
}
