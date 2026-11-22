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
import type { JlptLevel } from '#lib/content/levels/types.ts';

export type Goal = 'travel' | 'anime' | 'people' | 'food' | 'work' | 'fun';
export type Level = 'new' | 'some' | 'kana' | 'daily';
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
	{ id: 'kana', emoji: '📖' },
	{ id: 'daily', emoji: '🗾' }
];

/** Pick your level: the hardest sentence the learner can read sets where Learn opens. */
export const JLPT_PICKS: { id: JlptLevel; sample: string }[] = [
	{ id: 'N5', sample: 'これは わたしの ほん です。' },
	{ id: 'N4', sample: '雨が降ったら、家で映画を見ます。' },
	{ id: 'N3', sample: '会議の資料を事前に共有してもらえますか。' },
	{ id: 'N2', sample: 'ご多忙のところ恐縮ですが、ご確認願います。' },
	{ id: 'N1', sample: '当該案件につき、遺憾ながら見送らせていただきます。' }
];
export const MINUTES: Minutes[] = [5, 10, 20];

export interface Answers {
	/** in the order they were picked; the first one leads the course suggestion */
	goals: Goal[];
	level: Level;
	/** only asked when level is 'daily' */
	jlpt: JlptLevel;
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
export const DEFAULTS: Answers = { goals: [], level: 'new', jlpt: 'N3', minutes: 10 };

/** New kana per day for each daily-time answer (lessons are ~5 kana). */
export const NEW_PER_DAY: Record<Minutes, number> = { 5: 5, 10: 8, 20: 10 };

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
	/** Learn at the picked level; `ready` is false while its units are still being written */
	| { kind: 'level'; jlpt: JlptLevel; ready: boolean; href: string }
	/** the phrasebook and the Writing helper */
	| { kind: 'everyday'; href: string }
	| { kind: 'daily'; minutes: Minutes; newPerDay: number };

export interface PlanEnv {
	/** first kana lesson id (e.g. 'h1') */
	firstLesson: string;
	/** first unit id of each topic course */
	firstUnit: (course: Course['id']) => string | undefined;
	/** whether the placement check screen is available in this build */
	hasPlacement: boolean;
	/** whether the learner can open units of this level now */
	levelReady: (jlpt: JlptLevel) => boolean;
}

/** Turn answers into a short, ordered plan (two to five steps). */
export function buildPlan(a: Answers, env: PlanEnv): Step[] {
	const steps: Step[] = [];
	const lesson: Step = { kind: 'lesson', href: `/learn/${env.firstLesson}` };
	if (a.level === 'daily') {
		// kana are a 2-minute test-out, so words saved from photos aren't parked; then straight to their level
		if (env.hasPlacement)
			steps.push(
				{ kind: 'placement', script: 'hiragana', href: '/learn/placement/hiragana' },
				{ kind: 'placement', script: 'katakana', href: '/learn/placement/katakana' }
			);
		steps.push({ kind: 'level', jlpt: a.jlpt, ready: env.levelReady(a.jlpt), href: '/learn' });
		steps.push({ kind: 'everyday', href: '/words' });
		steps.push({ kind: 'daily', minutes: a.minutes, newPerDay: NEW_PER_DAY[a.minutes] });
		return steps;
	}
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
	const jlpt = JLPT_PICKS.some((j) => j.id === raw?.jlpt) ? (raw!.jlpt as JlptLevel) : DEFAULTS.jlpt;
	return { goals, level, jlpt, minutes };
}
