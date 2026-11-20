/**
 * Browser client for the community API (worker/community.ts). Errors carry the
 * server's `problem`, so screens can say what happened in the learner's language.
 */
import { translate as aiTranslate } from '#lib/ai/client.ts';
import type { TranslateLang } from '#lib/ai/contract.ts';
import type { Blocked, CommunityError, CommunityProblem, Feed, FeedSort, Lang, Me, Post, Reply, ReportReason, SubjectNotes, TargetKind, Thread } from './contract.ts';

export class CommunityRequestError extends Error {
	constructor(
		public status: number,
		/** 'offline' and 'network' come from the browser, the rest from the server */
		public problem: CommunityProblem | 'offline' | 'network' | 'signed_out' | 'other',
		message: string
	) {
		super(message);
	}
}

async function call<T>(method: string, path: string, json?: unknown): Promise<T> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) throw new CommunityRequestError(0, 'offline', 'offline');
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: json === undefined ? undefined : { 'content-type': 'application/json' },
			body: json === undefined ? undefined : JSON.stringify(json)
		});
	} catch {
		throw new CommunityRequestError(0, 'network', 'network');
	}
	const body = (await res.json().catch(() => null)) as unknown;
	if (!res.ok) {
		const e = body as Partial<CommunityError> | null;
		throw new CommunityRequestError(res.status, e?.problem ?? (res.status === 401 ? 'signed_out' : 'other'), e?.message ?? `HTTP ${res.status}`);
	}
	return body as T;
}

export const communityMe = () => call<Me>('GET', '/api/community/me');
export const setProfile = (handle: string, guidelines: number) => call<Me>('PUT', '/api/community/profile', { handle, guidelines });
export const subjectNotes = (subject: string) => call<SubjectNotes>('GET', `/api/community/subject?s=${encodeURIComponent(subject)}`);
export const shareNote = (subject: string, label: string, body: string, lang: Lang) => call<Post>('POST', '/api/community/posts', { subject, label, body, lang });
export const getFeed = (sort: FeedSort, before = 0) => call<Feed>('GET', `/api/community/feed?sort=${sort}${before ? `&before=${before}` : ''}`);
export const getThread = (id: number) => call<Thread>('GET', `/api/community/posts/${id}`);
export const deletePost = (id: number) => call<{ ok: true }>('DELETE', `/api/community/posts/${id}`);
export const postReply = (postId: number, body: string, lang: Lang) => call<Reply>('POST', `/api/community/posts/${postId}/replies`, { body, lang });
export const deleteReply = (id: number) => call<{ ok: true }>('DELETE', `/api/community/replies/${id}`);
export const setLike = (kind: TargetKind, id: number, on: boolean) => call<{ liked: boolean; likes: number }>('POST', '/api/community/like', { kind, id, on });
export const report = (kind: TargetKind, id: number, reason: ReportReason, detail: string) => call<{ ok: true }>('POST', '/api/community/report', { kind, id, reason, detail });
export const block = (kind: TargetKind, id: number) => call<{ ok: true }>('POST', '/api/community/block', { kind, id });
export const listBlocks = () => call<Blocked[]>('GET', '/api/community/blocks');
export const unblock = (handle: string) => call<{ ok: true }>('DELETE', `/api/community/blocks/${encodeURIComponent(handle)}`);

/** Everything the community screens call, as one object so /design can pass a fake. */
/** Translate a note or reply into `to` with the learner's AI (POST /api/ai/translate). */
const translate = async (kind: TargetKind, id: number, to: TranslateLang): Promise<string> => (await aiTranslate({ kind, id, to })).text;

export const communityApi = { getFeed, subjectNotes, shareNote, getThread, deletePost, postReply, deleteReply, setLike, report, block, setProfile, communityMe, translate };
export type CommunityApi = typeof communityApi;

/** What to tell the learner when a call fails, as a message key. */
export function problemKey(e: unknown): `community.err.${string}` {
	const p = e instanceof CommunityRequestError ? e.problem : 'other';
	return `community.err.${p}`;
}
