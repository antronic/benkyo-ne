/**
 * Placement check ("I already know some kana"): a short quiz that lets a
 * returning learner test out of the kana lessons they already know, instead
 * of sitting through MEET → TRACE for characters they can read.
 *
 * Each lesson not yet completed gets a few sampled questions, in curriculum
 * order. A lesson passes only when every sampled question is right. After two
 * failed lessons in a row the check stops: the rest is probably new, and the
 * normal lessons are the better teacher from there.
 *
 * Passing a lesson marks it completed and seeds FSRS for its kana:
 *   tested and right → graded from speed (fast answers may be Easy, so known
 *                      kana start with a long first interval)
 *   not sampled      → Good (short learning steps, so a review soon confirms it)
 * Failed or untested lessons record nothing: the lesson teaches them as usual.
 */
import type { Kana, Script } from '#lib/content/kana.ts';
import { cardId, LESSONS, type Lesson } from '#lib/content/lessons.ts';
import { Good, inferGrade, type Grade } from '#lib/srs/fsrs.ts';

export const PER_LESSON = 3;
export const STOP_AFTER_FAILS = 2;

export interface PlacementBlock {
	lesson: Lesson;
	questions: Kana[];
}

export interface Answer {
	correct: boolean;
	ms: number;
}

function sample<T>(a: T[], n: number, rand: () => number): T[] {
	const r = [...a];
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r.slice(0, n);
}

/** Lessons of a script still to test (not completed), each with sampled kana. */
export function buildPlacement(script: Script, completed: readonly string[] = [], rand = Math.random, perLesson = PER_LESSON): PlacementBlock[] {
	return LESSONS.filter((l) => l.script === script && !completed.includes(l.id)).map((lesson) => ({
		lesson,
		questions: sample(lesson.chars, perLesson, rand)
	}));
}

/** Pass (true), fail (false) or not finished (null) for one block. */
export function blockResult(b: PlacementBlock, answers: Record<string, Answer>): boolean | null {
	const got = b.questions.map((k) => answers[k.char]);
	if (got.some((a) => a && !a.correct)) return false;
	if (got.some((a) => !a)) return null;
	return true;
}

/** True once the learner has failed STOP_AFTER_FAILS finished lessons in a row. */
export function shouldStop(blocks: PlacementBlock[], answers: Record<string, Answer>): boolean {
	let run = 0;
	for (const b of blocks) {
		const r = blockResult(b, answers);
		if (r === null) break;
		run = r ? 0 : run + 1;
		if (run >= STOP_AFTER_FAILS) return true;
	}
	return false;
}

export interface PlacementOutcome {
	passed: string[];
	failed: string[];
	/** FSRS first reviews to record, by card id. */
	grades: [id: string, grade: Grade, ms: number][];
}

/**
 * Turn answers into lessons to complete and first reviews to record.
 * `seen` holds card ids that already have FSRS state: they are left alone.
 */
export function scorePlacement(blocks: PlacementBlock[], answers: Record<string, Answer>, seen: ReadonlySet<string> = new Set()): PlacementOutcome {
	const out: PlacementOutcome = { passed: [], failed: [], grades: [] };
	for (const b of blocks) {
		const r = blockResult(b, answers);
		if (r === false) out.failed.push(b.lesson.id);
		if (r !== true) continue;
		out.passed.push(b.lesson.id);
		for (const k of b.lesson.chars) {
			const id = cardId(k);
			if (seen.has(id)) continue;
			const a = answers[k.char];
			out.grades.push(a ? [id, inferGrade(true, a.ms), a.ms] : [id, Good, 0]);
		}
	}
	return out;
}
