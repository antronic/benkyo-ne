/**
 * Content feedback (docs/FEEDBACK.md): a thumb up or down and "Report a problem"
 * on every lesson, unit, grammar point, kanji and word the app teaches. Shared by
 * the app and the Worker (worker/feedback.ts, worker/admin/feedback.ts).
 *
 * A piece of content is named by its `subject`, the same ids notes use
 * (lib/notes/contract.ts) plus grammar points:
 *   word:… / phrase:…   a word or phrase card (the card id)
 *   kana:あ / kanji:日   a kana or kanji
 *   lesson:<id>         a kana or kanji lesson
 *   unit:<id>           a course unit or a level unit
 *   grammar:<id>        a grammar point of a level unit
 */
export const FEEDBACK_SUBJECT_RE = /^(word|phrase|kana|kanji|lesson|unit|grammar):\S{1,200}$/;
export const FEEDBACK_LABEL_MAX = 80;
export const FEEDBACK_DETAIL_MAX = 500;
export const FEEDBACK_REASONS = ['wrong', 'translation', 'audio', 'confusing', 'other'] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
export type Vote = -1 | 0 | 1;
export type FeedbackReportStatus = 'open' | 'fixed' | 'dismissed';

export interface MyVotes {
	/** subject → your vote; subjects you haven't voted on are absent */
	votes: Record<string, 1 | -1>;
}

export interface AdminFeedbackSubject {
	subject: string;
	label: string;
	up: number;
	down: number;
	open: number;
}
export interface AdminFeedbackReport {
	id: number;
	subject: string;
	label: string;
	reason: FeedbackReason;
	detail: string;
	locale: string;
	createdAt: number;
}
export interface AdminFeedback {
	up: number;
	down: number;
	open: number;
	/** most reported, then most thumbs down, at most 100 */
	subjects: AdminFeedbackSubject[];
	/** open reports, oldest first, at most 100 */
	reports: AdminFeedbackReport[];
}
