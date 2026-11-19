/**
 * Community deletes shared by worker/community.ts and account erasure
 * (accountDataStatements in worker/ai/credentials.ts). Plain SQL with no
 * imports, so the auth and credentials modules can use it without a cycle.
 */

/**
 * SQL: content row `t` (with author `t.author_id`) is visible to viewer ?1:
 * yours in any state but removed, or published by an active author you haven't blocked.
 */
export const visible = (t: string) => `(
	(${t}.author_id = ?1 AND ${t}.status != 'removed')
	OR (${t}.status = 'published'
	    AND EXISTS (SELECT 1 FROM accounts va WHERE va.id = ${t}.author_id AND va.disabled = 0)
	    AND NOT EXISTS (SELECT 1 FROM community_profiles vp WHERE vp.account_id = ${t}.author_id AND vp.status = 'banned')
	    AND NOT EXISTS (SELECT 1 FROM community_blocks vb WHERE vb.account_id = ?1 AND vb.blocked_id = ${t}.author_id)))`;

/**
 * The body and language of a note or reply the viewer may see, for Translate
 * (worker/ai/run.ts); null when it doesn't exist or is hidden from them.
 */
export async function visibleText(db: D1Database, viewer: number, kind: 'post' | 'reply', id: number) {
	const table = kind === 'post' ? 'community_posts' : 'community_replies';
	return db
		.prepare(`SELECT t.body, t.lang, t.author_id = ?1 AS mine FROM ${table} t WHERE t.id = ?2 AND ${visible('t')}`)
		.bind(viewer, id)
		.first<{ body: string; lang: string; mine: number }>();
}

/** Statements that delete posts matching `where` (bound to ?1) with their replies, likes and reports. */
export function deletePostsStatements(db: D1Database, where: string, arg: number): D1PreparedStatement[] {
	const ids = `SELECT id FROM community_posts WHERE ${where}`;
	return [
		db.prepare(`DELETE FROM community_likes WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE post_id IN (${ids}))`).bind(arg),
		db.prepare(`DELETE FROM community_reports WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE post_id IN (${ids}))`).bind(arg),
		db.prepare(`DELETE FROM community_replies WHERE post_id IN (${ids})`).bind(arg),
		db.prepare(`DELETE FROM community_likes WHERE target_kind = 'post' AND target_id IN (${ids})`).bind(arg),
		db.prepare(`DELETE FROM community_reports WHERE target_kind = 'post' AND target_id IN (${ids})`).bind(arg),
		db.prepare(`DELETE FROM community_posts WHERE ${where}`).bind(arg)
	];
}

/** Every community row of an account, for the fleet console's Delete (accountDataStatements). */
export function communityDataStatements(db: D1Database, accountId: number): D1PreparedStatement[] {
	return [
		...deletePostsStatements(db, 'author_id = ?1', accountId),
		db.prepare(`DELETE FROM community_likes WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE author_id = ?1)`).bind(accountId),
		db.prepare(`DELETE FROM community_reports WHERE target_kind = 'reply' AND target_id IN (SELECT id FROM community_replies WHERE author_id = ?1)`).bind(accountId),
		db.prepare(
			`UPDATE community_posts SET reply_count = MAX(reply_count - (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = community_posts.id AND r.author_id = ?1), 0)
			  WHERE id IN (SELECT post_id FROM community_replies WHERE author_id = ?1)`
		).bind(accountId),
		db.prepare(`DELETE FROM community_replies WHERE author_id = ?1`).bind(accountId),
		db.prepare(`DELETE FROM community_likes WHERE account_id = ?1`).bind(accountId),
		db.prepare(`DELETE FROM community_reports WHERE reporter_id = ?1`).bind(accountId),
		db.prepare(`DELETE FROM community_blocks WHERE account_id = ?1 OR blocked_id = ?1`).bind(accountId),
		db.prepare(`DELETE FROM community_profiles WHERE account_id = ?1`).bind(accountId)
	];
}
