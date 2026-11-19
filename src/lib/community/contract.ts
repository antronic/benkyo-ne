/**
 * Community (phase 2 of docs/NOTES.md, design in docs/COMMUNITY.md): shared notes on a study item,
 * replies, likes, reports and blocks. Shared by the app and the Worker (worker/community.ts).
 */

/** Bump when the community guidelines text changes: everyone accepts again before their next post. */
export const GUIDELINES_VERSION = 1;

export const POST_MAX = 4000;
export const REPLY_MAX = 1000;
export const REPORT_DETAIL_MAX = 500;
/** a handle: 3 to 20 lowercase letters, digits, dots and underscores, starting with a letter */
export const HANDLE_RE = /^[a-z][a-z0-9._]{2,19}$/;
/** distinct open reports that hide a post or reply until it is reviewed */
export const AUTO_HIDE_REPORTS = 3;
/** links allowed in one post; replies get links only once the account is a week old */
export const MAX_LINKS = 2;

export const LANGS = ['en', 'th', 'ja'] as const;
export type Lang = (typeof LANGS)[number];
export const REPORT_REASONS = ['spam', 'harassment', 'wrong', 'sexual', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type TargetKind = 'post' | 'reply';
export type ContentStatus = 'published' | 'hidden' | 'removed';
export type CommunityStatus = 'active' | 'muted' | 'banned';

export interface Profile {
	handle: string;
	guidelinesVersion: number;
	status: CommunityStatus;
}

export interface Me {
	profile: Profile | null;
	guidelinesVersion: number;
	/** false: write a handle and accept the guidelines first */
	canPost: boolean;
}

export interface Post {
	id: number;
	type: 'note';
	subject: string;
	label: string;
	body: string;
	lang: Lang;
	handle: string;
	mine: boolean;
	liked: boolean;
	likes: number;
	replies: number;
	/** only the author sees anything but 'published' */
	status: ContentStatus;
	createdAt: number;
	editedAt: number | null;
}

export interface Reply {
	id: number;
	postId: number;
	body: string;
	lang: Lang;
	handle: string;
	mine: boolean;
	liked: boolean;
	likes: number;
	status: ContentStatus;
	createdAt: number;
}

export interface SubjectNotes {
	subject: string;
	/** others' notes, most liked first, then newest */
	posts: Post[];
	/** your own shared note on this item, in any status */
	mine: Post | null;
	total: number;
}

export interface Thread {
	post: Post;
	replies: Reply[];
}

export interface Blocked {
	handle: string;
	at: number;
}

export type CommunityProblem =
	| 'needs_profile'
	| 'handle_taken'
	| 'bad_handle'
	| 'muted'
	| 'banned'
	| 'rate_limited'
	| 'blocked_words'
	| 'too_many_links'
	| 'links_new_account'
	| 'too_long'
	| 'empty'
	| 'not_found'
	| 'already_reported';

export interface CommunityError {
	error: string;
	message: string;
	problem?: CommunityProblem;
}

/** Count links in text: http(s) URLs and bare www. addresses. */
export function countLinks(text: string): number {
	return (text.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? []).length;
}

/** Best guess at a text's language, for the tag on a new post: Thai or Japanese script, else English. */
export function guessLang(text: string): Lang {
	const thai = (text.match(/[฀-๿]/g) ?? []).length;
	const ja = (text.match(/[぀-ヿ一-鿿]/g) ?? []).length;
	const latin = (text.match(/[A-Za-z]/g) ?? []).length;
	if (thai > 0 && thai >= latin / 2) return 'th';
	// a note about a Japanese word is mostly in the learner's language: Japanese only when it dominates
	if (ja > latin && ja > thai) return 'ja';
	return 'en';
}

// ---------------------------------------------------------------- fleet ----

export interface AdminReportItem {
	kind: TargetKind;
	id: number;
	/** the post a reply belongs to, or the post itself */
	postId: number;
	subject: string;
	label: string;
	body: string;
	status: ContentStatus;
	createdAt: number;
	author: { accountId: number; handle: string; status: CommunityStatus; posts: number; removed: number; disabled: boolean };
	reports: { reason: ReportReason; detail: string; at: number }[];
	openReports: number;
	firstReportAt: number;
}

export interface AdminCommunity {
	stats: { posts7d: number; replies7d: number; openReports: number; hidden: number; profiles: number };
	queue: AdminReportItem[];
}

export type AdminContentAction = 'dismiss' | 'hide' | 'remove' | 'restore';
