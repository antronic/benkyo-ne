/**
 * Community, the learner's side (docs/COMMUNITY.md). Signed in only, during the beta.
 *
 *   GET    /api/community/me                       your handle and whether you can post
 *   PUT    /api/community/profile {handle, guidelines}   pick or change your handle, accept the guidelines
 *   GET    /api/community/feed?sort=new|top&before=<n>   the Community home → Feed
 *   GET    /api/community/subject?s=<subject>      shared notes on one study item → SubjectNotes
 *   POST   /api/community/posts {subject, label, body, lang}   share your note (or update the shared copy)
 *   GET    /api/community/posts/:id                a note with its replies → Thread
 *   DELETE /api/community/posts/:id                delete your shared note (and its replies)
 *   POST   /api/community/posts/:id/replies {body, lang}       reply (one level)
 *   DELETE /api/community/replies/:id              delete your reply
 *   POST   /api/community/like {kind, id, on}      heart or un-heart a post or reply
 *   POST   /api/community/report {kind, id, reason, detail}    report; 3 people hide it until reviewed
 *   POST   /api/community/block {kind, id}         block the author of a post or reply (only for you)
 *   GET    /api/community/blocks                   people you blocked
 *   DELETE /api/community/blocks/:handle           unblock
 *
 * Others only see published content by accounts that are not disabled and not
 * banned from the community, minus people they blocked. A closed account
 * ("Delete account" disables it, Job 2026-11-19) keeps its rows, so its posts
 * are hidden, not deleted. Moderation lives in worker/admin/community.ts.
 */
import {
	AUTO_HIDE_REPORTS,
	countLinks,
	FEED_PAGE,
	GUIDELINES_VERSION,
	HANDLE_RE,
	LANGS,
	MAX_LINKS,
	POST_MAX,
	REPLY_MAX,
	REPORT_DETAIL_MAX,
	REPORT_REASONS,
	TOP_DAYS,
	type Blocked,
	type CommunityProblem,
	type Feed,
	type FeedSort,
	type Lang,
	type Me,
	type Post,
	type Profile,
	type Reply,
	type SubjectNotes,
	type TargetKind,
	type Thread
} from '../src/lib/community/contract.ts';
import { SUBJECT_RE } from '../src/lib/notes/contract.ts';
import { rateLimit } from './ai/ledger.ts';
import { parseAvatar } from './avatar.ts';
import { getSession, type Session } from './auth/passkey.ts';
import { deletePostsStatements, visible } from './communityData.ts';
import { hasBlockedWords } from './communityWords.ts';
import type { Env } from './env.ts';
import { HttpError, httpError, json, readJson } from './http.ts';

const DAY = 24 * 60 * 60 * 1000;
/** per account per day; accounts younger than NEW_ACCOUNT_DAYS get the lower number */
export const LIMITS = { posts: [10, 3], replies: [30, 10], reports: [20, 20], profile: [5, 5] } as const;
export const NEW_ACCOUNT_DAYS = 3;
export const REPLY_LINK_DAYS = 7;
const PAGE = 50;

const PROBLEMS: Record<CommunityProblem, [number, string]> = {
	needs_profile: [403, 'Pick a handle and accept the community guidelines first'],
	handle_taken: [409, 'That handle is taken'],
	bad_handle: [400, 'A handle is 3 to 20 lowercase letters, digits, dots or underscores, starting with a letter'],
	muted: [403, 'You can read the community but not post for now'],
	banned: [403, 'You can’t post in the community'],
	rate_limited: [429, 'That’s a lot for one day. Try again tomorrow'],
	blocked_words: [400, 'This contains words the community doesn’t allow'],
	too_many_links: [400, `At most ${MAX_LINKS} links`],
	links_new_account: [400, `Links in replies are allowed once your account is ${REPLY_LINK_DAYS} days old`],
	too_long: [400, 'That’s too long'],
	empty: [400, 'Write something first'],
	not_found: [404, 'That isn’t there any more'],
	already_reported: [409, 'You already reported this']
};
export const communityError = (problem: CommunityProblem) =>
	new HttpError(PROBLEMS[problem][0], {
		error: problem === 'rate_limited' ? 'rate_limited' : 'bad_request',
		message: PROBLEMS[problem][1],
		problem
	} as never);

// ------------------------------------------------------------ visibility ----

const POST_COLS = `p.id, p.type, p.subject, p.label, p.body, p.lang, p.status, p.like_count AS likes, p.reply_count AS replies,
	p.created_at AS createdAt, p.edited_at AS editedAt, pr.handle, pa.avatar AS avatar, p.author_id = ?1 AS mine,
	EXISTS (SELECT 1 FROM community_likes l WHERE l.target_kind = 'post' AND l.target_id = p.id AND l.account_id = ?1) AS liked`;
const POST_FROM = `FROM community_posts p JOIN community_profiles pr ON pr.account_id = p.author_id JOIN accounts pa ON pa.id = p.author_id`;

type Row<T> = Omit<T, 'mine' | 'liked' | 'avatar'> & { mine: number; liked: number; avatar: string | null };
const toPost = (r: Row<Post>): Post => ({ ...r, mine: !!r.mine, liked: !!r.liked, avatar: parseAvatar(r.avatar) });
const toReply = (r: Row<Reply>): Reply => ({ ...r, mine: !!r.mine, liked: !!r.liked, avatar: parseAvatar(r.avatar) });

// --------------------------------------------------------------- profile ----

async function profileOf(env: Env, accountId: number): Promise<Profile | null> {
	return env.DB.prepare(
		`SELECT handle, guidelines_version AS guidelinesVersion, status FROM community_profiles WHERE account_id = ?1`
	)
		.bind(accountId)
		.first<Profile>();
}

export async function me(env: Env, accountId: number): Promise<Me> {
	const profile = await profileOf(env, accountId);
	return {
		profile,
		guidelinesVersion: GUIDELINES_VERSION,
		canPost: !!profile && profile.guidelinesVersion >= GUIDELINES_VERSION && profile.status === 'active'
	};
}

export function parseHandle(raw: unknown): string {
	const h = typeof raw === 'string' ? raw.trim().replace(/^@/, '').toLowerCase() : '';
	if (!HANDLE_RE.test(h)) throw communityError('bad_handle');
	return h;
}

async function limited(env: Env, s: Session, what: keyof typeof LIMITS, now: number) {
	const created = await env.DB.prepare(`SELECT created_at AS at FROM accounts WHERE id = ?1`).bind(s.userId).first<{ at: number }>();
	const young = !created || now - created.at < NEW_ACCOUNT_DAYS * DAY;
	const limit = LIMITS[what][young ? 1 : 0];
	if (!(await rateLimit(env, `community:${what}:${s.userId}`, limit, now, 1440))) throw communityError('rate_limited');
	return created?.at ?? now;
}

export async function setProfile(env: Env, s: Session, body: unknown, now = Date.now()): Promise<Me> {
	const b = (body ?? {}) as { handle?: unknown; guidelines?: unknown };
	const handle = parseHandle(b.handle);
	if (b.guidelines !== GUIDELINES_VERSION) throw httpError(400, 'bad_request', 'Accept the community guidelines first');
	if (hasBlockedWords(handle)) throw communityError('blocked_words');
	const taken = await env.DB.prepare(`SELECT account_id AS id FROM community_profiles WHERE handle = ?1`).bind(handle).first<{ id: number }>();
	if (taken && taken.id !== s.userId) throw communityError('handle_taken');
	await limited(env, s, 'profile', now);
	await env.DB.prepare(
		`INSERT INTO community_profiles (account_id, handle, guidelines_version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)
		 ON CONFLICT (account_id) DO UPDATE SET handle = ?2, guidelines_version = ?3, updated_at = ?4`
	)
		.bind(s.userId, handle, GUIDELINES_VERSION, now)
		.run();
	return me(env, s.userId);
}

/** The author may write: a current profile, not muted or banned. */
async function requirePoster(env: Env, accountId: number) {
	const p = await profileOf(env, accountId);
	if (!p || p.guidelinesVersion < GUIDELINES_VERSION) throw communityError('needs_profile');
	if (p.status === 'muted') throw communityError('muted');
	if (p.status === 'banned') throw communityError('banned');
	return p;
}

function cleanText(raw: unknown, max: number): string {
	const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim() : '';
	if (!text) throw communityError('empty');
	if (text.length > max) throw communityError('too_long');
	if (hasBlockedWords(text)) throw communityError('blocked_words');
	return text;
}

const parseLang = (raw: unknown): Lang => (LANGS.includes(raw as Lang) ? (raw as Lang) : 'en');

// ----------------------------------------------------------------- reads ----

export async function subjectNotes(env: Env, viewer: number, subject: string): Promise<SubjectNotes> {
	if (!SUBJECT_RE.test(subject) || subject.length > 200) throw httpError(400, 'bad_request', 'bad subject');
	const [others, total, mine] = await env.DB.batch<Row<Post> & { n?: number }>([
		env.DB.prepare(
			`SELECT ${POST_COLS} ${POST_FROM}
			  WHERE p.subject = ?2 AND p.type = 'note' AND p.author_id != ?1 AND ${visible('p')}
			  ORDER BY p.like_count DESC, p.created_at DESC LIMIT ${PAGE}`
		).bind(viewer, subject),
		env.DB.prepare(
			`SELECT COUNT(*) AS n FROM community_posts p WHERE p.subject = ?2 AND p.type = 'note' AND p.author_id != ?1 AND ${visible('p')}`
		).bind(viewer, subject),
		env.DB.prepare(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.subject = ?2 AND p.type = 'note' AND p.author_id = ?1`).bind(viewer, subject)
	]);
	const m = mine.results[0];
	return {
		subject,
		posts: others.results.map(toPost),
		mine: m ? toPost(m) : null,
		total: (total.results[0] as { n: number } | undefined)?.n ?? 0
	};
}

/**
 * The Community home: everyone's shared notes on every item, yours included.
 * `new` pages by offset of newest first; `top` is the most liked of the last
 * TOP_DAYS days. Hidden, removed, banned, closed and blocked authors are left
 * out by `visible`, like everywhere else.
 */
export async function feed(env: Env, viewer: number, url: URL, now = Date.now()): Promise<Feed> {
	const sort: FeedSort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
	const offset = Math.max(0, Math.min(500, Number(url.searchParams.get('before')) || 0));
	const where = sort === 'top' ? `AND p.created_at >= ${now - TOP_DAYS * 86_400_000}` : '';
	const order = sort === 'top' ? 'p.like_count DESC, p.created_at DESC' : 'p.created_at DESC, p.id DESC';
	const { results } = await env.DB.prepare(
		`SELECT ${POST_COLS} ${POST_FROM}
		  WHERE p.type = 'note' AND (p.author_id != ?1 OR p.status = 'published') AND ${visible('p')} ${where}
		  ORDER BY ${order} LIMIT ${FEED_PAGE + 1} OFFSET ?2`
	)
		.bind(viewer, offset)
		.all<Row<Post>>();
	const more = results.length > FEED_PAGE;
	return { posts: results.slice(0, FEED_PAGE).map(toPost), next: more ? offset + FEED_PAGE : null };
}

async function visiblePost(env: Env, viewer: number, id: number): Promise<Post> {
	const r = await env.DB.prepare(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.id = ?2 AND ${visible('p')}`).bind(viewer, id).first<Row<Post>>();
	if (!r) throw communityError('not_found');
	return toPost(r);
}

export async function thread(env: Env, viewer: number, id: number): Promise<Thread> {
	const post = await visiblePost(env, viewer, id);
	const { results } = await env.DB.prepare(
		`SELECT r.id, r.post_id AS postId, r.body, r.lang, r.status, r.like_count AS likes, r.created_at AS createdAt,
		        pr.handle, ra.avatar AS avatar, r.author_id = ?1 AS mine,
		        EXISTS (SELECT 1 FROM community_likes l WHERE l.target_kind = 'reply' AND l.target_id = r.id AND l.account_id = ?1) AS liked
		   FROM community_replies r JOIN community_profiles pr ON pr.account_id = r.author_id JOIN accounts ra ON ra.id = r.author_id
		  WHERE r.post_id = ?2 AND ${visible('r')}
		  ORDER BY r.created_at LIMIT 200`
	)
		.bind(viewer, id)
		.all<Row<Reply>>();
	return { post, replies: results.map(toReply) };
}

// ---------------------------------------------------------------- writes ----

export async function shareNote(env: Env, s: Session, body: unknown, now = Date.now()): Promise<Post> {
	const b = (body ?? {}) as { subject?: unknown; label?: unknown; body?: unknown; lang?: unknown };
	await requirePoster(env, s.userId);
	const subject = typeof b.subject === 'string' ? b.subject : '';
	if (!SUBJECT_RE.test(subject) || subject.length > 200) throw httpError(400, 'bad_request', 'bad subject');
	const label = typeof b.label === 'string' ? b.label.trim().slice(0, 120) : '';
	const text = cleanText(b.body, POST_MAX);
	if (countLinks(text) > MAX_LINKS) throw communityError('too_many_links');
	await limited(env, s, 'posts', now);
	// an update keeps the status a moderator gave it: editing doesn't bring back a hidden note
	await env.DB.prepare(
		`INSERT INTO community_posts (author_id, type, subject, label, body, lang, created_at) VALUES (?1, 'note', ?2, ?3, ?4, ?5, ?6)
		 ON CONFLICT (author_id, subject) WHERE type = 'note' DO UPDATE SET label = ?3, body = ?4, lang = ?5, edited_at = ?6`
	)
		.bind(s.userId, subject, label, text, parseLang(b.lang), now)
		.run();
	const r = await env.DB.prepare(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.author_id = ?1 AND p.subject = ?2 AND p.type = 'note'`)
		.bind(s.userId, subject)
		.first<Row<Post>>();
	return toPost(r!);
}

async function deletePost(env: Env, s: Session, id: number) {
	const own = await env.DB.prepare(`SELECT id FROM community_posts WHERE id = ?1 AND author_id = ?2`).bind(id, s.userId).first();
	if (!own) throw communityError('not_found');
	await env.DB.batch(deletePostsStatements(env.DB, 'id = ?1', id));
	return { ok: true };
}

export async function reply(env: Env, s: Session, postId: number, body: unknown, now = Date.now()): Promise<Reply> {
	const b = (body ?? {}) as { body?: unknown; lang?: unknown };
	await requirePoster(env, s.userId);
	const post = await visiblePost(env, s.userId, postId);
	if (post.status !== 'published') throw communityError('not_found');
	const text = cleanText(b.body, REPLY_MAX);
	const links = countLinks(text);
	if (links > MAX_LINKS) throw communityError('too_many_links');
	const createdAt = await limited(env, s, 'replies', now);
	if (links > 0 && now - createdAt < REPLY_LINK_DAYS * DAY) throw communityError('links_new_account');
	const [ins] = await env.DB.batch<{ id: number }>([
		env.DB.prepare(`INSERT INTO community_replies (post_id, author_id, body, lang, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id`).bind(
			postId,
			s.userId,
			text,
			parseLang(b.lang),
			now
		),
		env.DB.prepare(`UPDATE community_posts SET reply_count = reply_count + 1 WHERE id = ?1`).bind(postId)
	]);
	const id = ins.results[0].id;
	const profile = await profileOf(env, s.userId);
	return { id, postId, body: text, lang: parseLang(b.lang), handle: profile!.handle, avatar: parseAvatar(s.avatar), mine: true, liked: false, likes: 0, status: 'published', createdAt: now };
}

async function deleteReply(env: Env, s: Session, id: number) {
	const r = await env.DB.prepare(`SELECT post_id AS postId FROM community_replies WHERE id = ?1 AND author_id = ?2`).bind(id, s.userId).first<{ postId: number }>();
	if (!r) throw communityError('not_found');
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM community_likes WHERE target_kind = 'reply' AND target_id = ?1`).bind(id),
		env.DB.prepare(`DELETE FROM community_reports WHERE target_kind = 'reply' AND target_id = ?1`).bind(id),
		env.DB.prepare(`DELETE FROM community_replies WHERE id = ?1`).bind(id),
		env.DB.prepare(`UPDATE community_posts SET reply_count = MAX(reply_count - 1, 0) WHERE id = ?1`).bind(r.postId)
	]);
	return { ok: true };
}

const TABLE: Record<TargetKind, string> = { post: 'community_posts', reply: 'community_replies' };

function parseTarget(b: { kind?: unknown; id?: unknown }): { kind: TargetKind; id: number } {
	if ((b.kind !== 'post' && b.kind !== 'reply') || !Number.isInteger(b.id)) throw httpError(400, 'bad_request', 'kind must be post or reply, with an id');
	return { kind: b.kind, id: b.id as number };
}

/** The target exists and the viewer may see it; returns its author. */
async function targetAuthor(env: Env, viewer: number, kind: TargetKind, id: number): Promise<number> {
	const r = await env.DB.prepare(`SELECT t.author_id AS author FROM ${TABLE[kind]} t WHERE t.id = ?2 AND ${visible('t')}`)
		.bind(viewer, id)
		.first<{ author: number }>();
	if (!r) throw communityError('not_found');
	return r.author;
}

export async function like(env: Env, s: Session, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as { kind?: unknown; id?: unknown; on?: unknown };
	const { kind, id } = parseTarget(b);
	await targetAuthor(env, s.userId, kind, id);
	const write =
		b.on === false
			? env.DB.prepare(`DELETE FROM community_likes WHERE target_kind = ?1 AND target_id = ?2 AND account_id = ?3`).bind(kind, id, s.userId)
			: env.DB.prepare(`INSERT OR IGNORE INTO community_likes (target_kind, target_id, account_id, created_at) VALUES (?1, ?2, ?3, ?4)`).bind(kind, id, s.userId, now);
	const [, , count] = await env.DB.batch<{ n: number }>([
		write,
		env.DB.prepare(`UPDATE ${TABLE[kind]} SET like_count = (SELECT COUNT(*) FROM community_likes WHERE target_kind = ?1 AND target_id = ?2) WHERE id = ?2`).bind(kind, id),
		env.DB.prepare(`SELECT like_count AS n FROM ${TABLE[kind]} WHERE id = ?1`).bind(id)
	]);
	return { liked: b.on !== false, likes: count.results[0]?.n ?? 0 };
}

export async function report(env: Env, s: Session, body: unknown, now = Date.now()) {
	const b = (body ?? {}) as { kind?: unknown; id?: unknown; reason?: unknown; detail?: unknown };
	const { kind, id } = parseTarget(b);
	if (!REPORT_REASONS.includes(b.reason as never)) throw httpError(400, 'bad_request', 'Pick a reason');
	const detail = typeof b.detail === 'string' ? b.detail.trim().slice(0, REPORT_DETAIL_MAX) : '';
	const author = await targetAuthor(env, s.userId, kind, id);
	if (author === s.userId) throw httpError(400, 'bad_request', 'You can’t report your own post');
	const already = await env.DB.prepare(`SELECT 1 AS x FROM community_reports WHERE target_kind = ?1 AND target_id = ?2 AND reporter_id = ?3`)
		.bind(kind, id, s.userId)
		.first();
	if (already) throw communityError('already_reported');
	await limited(env, s, 'reports', now);
	await env.DB.batch([
		env.DB.prepare(
			`INSERT OR IGNORE INTO community_reports (target_kind, target_id, reporter_id, reason, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
		).bind(kind, id, s.userId, b.reason, detail, now),
		// enough different people: hidden until Job reviews it in the fleet console
		env.DB.prepare(
			`UPDATE ${TABLE[kind]} SET status = 'hidden'
			  WHERE id = ?2 AND status = 'published'
			    AND (SELECT COUNT(*) FROM community_reports WHERE target_kind = ?1 AND target_id = ?2 AND status = 'open') >= ?3`
		).bind(kind, id, AUTO_HIDE_REPORTS)
	]);
	return { ok: true };
}

export async function block(env: Env, s: Session, body: unknown, now = Date.now()) {
	const { kind, id } = parseTarget((body ?? {}) as { kind?: unknown; id?: unknown });
	const author = await targetAuthor(env, s.userId, kind, id);
	if (author === s.userId) throw httpError(400, 'bad_request', 'You can’t block yourself');
	await env.DB.prepare(`INSERT OR IGNORE INTO community_blocks (account_id, blocked_id, created_at) VALUES (?1, ?2, ?3)`).bind(s.userId, author, now).run();
	return { ok: true };
}

export async function blocks(env: Env, accountId: number): Promise<Blocked[]> {
	const { results } = await env.DB.prepare(
		`SELECT pr.handle, b.created_at AS at FROM community_blocks b JOIN community_profiles pr ON pr.account_id = b.blocked_id
		  WHERE b.account_id = ?1 ORDER BY b.created_at DESC LIMIT 500`
	)
		.bind(accountId)
		.all<Blocked>();
	return results;
}

async function unblock(env: Env, accountId: number, handle: string) {
	await env.DB.prepare(
		`DELETE FROM community_blocks WHERE account_id = ?1 AND blocked_id = (SELECT account_id FROM community_profiles WHERE handle = ?2)`
	)
		.bind(accountId, handle)
		.run();
	return { ok: true };
}

// ----------------------------------------------------------------- purge ----

/** content a moderator removed is kept this long for an appeal, then deleted */
export const REMOVED_KEEP_DAYS = 90;
/** handled reports are kept as long as beta data */
export const REPORT_KEEP_DAYS = 180;

/** Daily cron: purge removed content and old handled reports. */
export async function purgeCommunity(env: Env, now = Date.now()) {
	const removedBefore = now - REMOVED_KEEP_DAYS * DAY;
	const res = await env.DB.batch([
		...deletePostsStatements(env.DB, `status = 'removed' AND removed_at < ?1`, removedBefore),
		env.DB.prepare(`DELETE FROM community_likes WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE status = 'removed' AND removed_at < ?1)`).bind(removedBefore),
		env.DB.prepare(`DELETE FROM community_reports WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE status = 'removed' AND removed_at < ?1)`).bind(removedBefore),
		env.DB.prepare(`DELETE FROM community_replies WHERE status = 'removed' AND removed_at < ?1`).bind(removedBefore),
		env.DB.prepare(`DELETE FROM community_reports WHERE status != 'open' AND handled_at < ?1`).bind(now - REPORT_KEEP_DAYS * DAY)
	]);
	return { posts: res[5].meta.changes ?? 0, replies: res[8].meta.changes ?? 0, reports: res[9].meta.changes ?? 0 };
}

// ---------------------------------------------------------------- routes ----

async function signedIn(req: Request, env: Env) {
	const s = await getSession(req, env);
	if (!s) throw httpError(401, 'unauthorized', 'Sign in first');
	return s;
}

const MAX_BODY = 16 * 1024;

export async function handleCommunity(req: Request, env: Env, url: URL): Promise<Response | null> {
	const p = url.pathname;
	const m = req.method;
	const s = await signedIn(req, env);
	if (p === '/api/community/me' && m === 'GET') return json(await me(env, s.userId));
	if (p === '/api/community/profile' && m === 'PUT') return json(await setProfile(env, s, await readJson(req, 1024)));
	if (p === '/api/community/feed' && m === 'GET') return json(await feed(env, s.userId, url));
	if (p === '/api/community/subject' && m === 'GET') return json(await subjectNotes(env, s.userId, url.searchParams.get('s') ?? ''));
	if (p === '/api/community/posts' && m === 'POST') return json(await shareNote(env, s, await readJson(req, MAX_BODY)));
	let r = /^\/api\/community\/posts\/(\d+)$/.exec(p);
	if (r && m === 'GET') return json(await thread(env, s.userId, Number(r[1])));
	if (r && m === 'DELETE') return json(await deletePost(env, s, Number(r[1])));
	r = /^\/api\/community\/posts\/(\d+)\/replies$/.exec(p);
	if (r && m === 'POST') return json(await reply(env, s, Number(r[1]), await readJson(req, MAX_BODY)));
	r = /^\/api\/community\/replies\/(\d+)$/.exec(p);
	if (r && m === 'DELETE') return json(await deleteReply(env, s, Number(r[1])));
	if (p === '/api/community/like' && m === 'POST') return json(await like(env, s, await readJson(req, 1024)));
	if (p === '/api/community/report' && m === 'POST') return json(await report(env, s, await readJson(req, 4096)));
	if (p === '/api/community/block' && m === 'POST') return json(await block(env, s, await readJson(req, 1024)));
	if (p === '/api/community/blocks' && m === 'GET') return json(await blocks(env, s.userId));
	r = /^\/api\/community\/blocks\/([a-z0-9._]{1,20})$/.exec(p);
	if (r && m === 'DELETE') return json(await unblock(env, s.userId, r[1]));
	return null;
}
