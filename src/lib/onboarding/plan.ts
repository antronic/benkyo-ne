/**
 * First-run questionnaire → starting plan.
 *
 * Three light questions (why, how much you know, how much time a day), all
 * optional: skipping one keeps its default. The answers pick where to start
 * (lesson 1, or the placement check for people who already read kana), which
 * topic course to suggest, and the daily budget of new kana.
 *
 * Pure functions only, so the mapping is easy to test and to tweak.
 */
import type { Course } from '#lib/content/courses.ts';

export type Goal = 'travel' | 'anime' | 'people' | 'food' | 'work' | 'fun';
export type Level = 'new' | 'some' | 'kana';
export type Minutes = 5 | 10 | 20;

export const GOALS: { id: Goal; emoji: string }[] = [
	{ id: 'travel', emoji: '✈️' },
	{ id: 'anime', emoji: '🎮' },
	{ id: 'people', emoji: '💬' },
	{ id: 'food', emoji: '🍣' },
	{ id: 'work', emoji: '💼' },
	{ id: 'fun', emoji: '✨' }
];
export const LEVELS: { id: Level; emoji: string }[] = [
	{ id: 'new', emoji: '🌱' },
	{ id: 'some', emoji: '🔤' },
	{ id: 'kana', emoji: '📖' }
];
export const MINUTES: Minutes[] = [5, 10, 20];

export interface Answers {
	/** in the order they were picked; the first one leads the course suggestion */
	goals: Goal[];
	level: Level;
	minutes: Minutes;
}

export interface Profile extends Answers {
	/** when the questionnaire was finished (or skipped) */
	at: number;
	/** true when the person skipped straight past the questions */
	skipped: boolean;
	/** the Today plan card was dismissed */
	hidden?: boolean;
}

/** What you get by tapping Skip: a beginner's plan at the recommended pace. */
export const DEFAULTS: Answers = { goals: [], level: 'new', minutes: 10 };

/** New kana per day for each daily-time answer (lessons are ~5 kana). */
export const NEW_PER_DAY: Record<Minutes, number> = { 5: 5, 10: 10, 20: 15 };

/** Topic course that fits each goal best. */
export const GOAL_COURSE: Record<Goal, Course['id']> = {
	travel: 'travel',
	anime: 'friends', // casual speech you hear in shows and games
	people: 'friends',
	work: 'friends', // self-introduction and small talk come first
	food: 'japanglish', // menus are full of loanwords
	fun: 'japanglish'
};

export type Step =
	| { kind: 'lesson'; href: string }
	| { kind: 'placement'; script: 'hiragana' | 'katakana'; href: string }
	| { kind: 'course'; course: Course['id']; href: string }
	| { kind: 'daily'; minutes: Minutes; newPerDay: number };

export interface PlanEnv {
	/** first kana lesson id (e.g. 'h1') */
	firstLesson: string;
	/** first unit id of each topic course */
	firstUnit: (course: Course['id']) => string | undefined;
	/** whether the placement check screen is available in this build */
	hasPlacement: boolean;
}

/** Turn answers into a short, ordered plan (two to four steps). */
export function buildPlan(a: Answers, env: PlanEnv): Step[] {
	const steps: Step[] = [];
	const lesson: Step = { kind: 'lesson', href: `/learn/${env.firstLesson}` };
	if (a.level === 'new' || !env.hasPlacement) steps.push(lesson);
	else {
		steps.push({ kind: 'placement', script: 'hiragana', href: '/learn/placement/hiragana' });
		if (a.level === 'kana') steps.push({ kind: 'placement', script: 'katakana', href: '/learn/placement/katakana' });
	}
	const course = a.goals.length ? GOAL_COURSE[a.goals[0]] : undefined;
	const unit = course && env.firstUnit(course);
	if (course && unit) steps.push({ kind: 'course', course, href: `/learn/course/${course}/${unit}` });
	steps.push({ kind: 'daily', minutes: a.minutes, newPerDay: NEW_PER_DAY[a.minutes] });
	return steps;
}

/** Keep only valid answers from stored data (older or hand-edited records). */
export function sanitize(raw: Partial<Answers> | null | undefined): Answers {
	const goals = (raw?.goals ?? []).filter((g, i, all): g is Goal => GOALS.some((x) => x.id === g) && all.indexOf(g) === i);
	const level = LEVELS.some((l) => l.id === raw?.level) ? (raw!.level as Level) : DEFAULTS.level;
	const minutes = MINUTES.includes(raw?.minutes as Minutes) ? (raw!.minutes as Minutes) : DEFAULTS.minutes;
	return { goals, level, minutes };
}
