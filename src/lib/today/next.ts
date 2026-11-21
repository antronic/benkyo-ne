/**
 * Today's one next step (docs/UX-FLOW.md): the card at the top of Today says what to do now.
 * Order: reviews that are due (they're timed, so they go first), then the plan's own first step
 * for learners who already read kana (a placement check, their level, everyday Japanese), then
 * the next kana lesson while today's new-kana budget lasts, then new words, then rest.
 */
import type { Step } from '#lib/onboarding/plan.ts';

export type Next =
	| { kind: 'review'; n: number }
	| { kind: 'plan'; step: Extract<Step, { kind: 'placement' | 'level' | 'everyday' }> }
	| { kind: 'lesson'; id: string }
	| { kind: 'words'; n: number }
	/** today's new kana are done and nothing is due: come back tomorrow */
	| { kind: 'rest'; id: string }
	| { kind: 'allDone' };

export interface NextInput {
	/** cards due for review now */
	due: number;
	/** new word cards waiting to be learned */
	newWords: number;
	/** the plan's first step that isn't done yet (from the first-run questions) */
	planStep?: Step;
	/** the next kana lesson not completed yet */
	lessonId?: string;
	/** new kana still allowed today */
	budgetLeft: number;
}

export function pickNext(i: NextInput): Next {
	if (i.due > 0) return { kind: 'review', n: i.due };
	const s = i.planStep;
	if (s && (s.kind === 'placement' || s.kind === 'level' || s.kind === 'everyday')) return { kind: 'plan', step: s };
	if (i.lessonId && i.budgetLeft > 0) return { kind: 'lesson', id: i.lessonId };
	if (i.newWords > 0) return { kind: 'words', n: i.newWords };
	if (i.lessonId) return { kind: 'rest', id: i.lessonId };
	return { kind: 'allDone' };
}
