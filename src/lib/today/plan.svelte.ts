/**
 * The plan from the first-run questions, as steps, and whether each is done
 * (moved here from the old Today plan card; Today's next step reads it).
 */
import { LESSONS } from '#lib/content/lessons.ts';
import { courseTag, COURSES } from '#lib/content/courses.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import { words } from '#lib/state/words.svelte.ts';
import type { Step } from '#lib/onboarding/plan.ts';
import { planFor, profile } from '#lib/onboarding/profile.svelte.ts';

/** The plan's steps (without the daily-minutes line), or none when the questions were skipped. */
export function planSteps(): Step[] {
	const p = profile.value;
	return p && !p.skipped ? planFor(p).filter((x) => x.kind !== 'daily') : [];
}

export function stepDone(x: Step): boolean {
	if (x.kind === 'lesson') return progress.completed.includes(x.href.split('/').pop()!);
	if (x.kind === 'placement') return LESSONS.some((l) => l.script === x.script && progress.completed.includes(l.id));
	if (x.kind === 'course') {
		const units = COURSES.find((c) => c.id === x.course)?.units ?? [];
		return words.list.some((c) => units.some((u) => c.tags.includes(courseTag(x.course, u.id))));
	}
	// everyday learners: a unit of their level done, and a word met in a photo, look-up or message
	if (x.kind === 'level') return progress.completed.some((id) => id.startsWith(`${x.jlpt.toLowerCase()}-`));
	if (x.kind === 'everyday') return words.list.some((c) => (c.seen?.count ?? 0) > 0);
	return false;
}

/**
 * Where a new learner goes right after the first run (docs/UX-FLOW.md): the plan's own first
 * step for someone who already reads kana (a placement check, their level), otherwise the next
 * kana lesson. The same choice as Today's next-step card, without the reviews.
 */
export function firstStepHref(): string {
	const s = planSteps().find((x) => !stepDone(x));
	if (s && (s.kind === 'placement' || s.kind === 'level' || s.kind === 'everyday')) return s.href;
	const l = LESSONS.find((x) => !progress.completed.includes(x.id));
	return l ? `/learn/${l.id}` : '/';
}
