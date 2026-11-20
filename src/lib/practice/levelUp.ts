/**
 * Moving up a level (docs/LEVELS.md, docs/EVERYDAY.md): no quiz gate. Once a
 * learner has finished 80% of the units they can see in their hardest level,
 * Today suggests the next one.
 */
import type { JlptLevel } from '#lib/content/levels/types.ts';

export const ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const LEVEL_UP_AT = 0.8;

export interface LevelUp {
	from: JlptLevel;
	to: JlptLevel;
	/** share of `from`'s units done (0..1) */
	done: number;
	/** the next level has units to open now */
	ready: boolean;
}

/**
 * `units[level]` lists the unit ids the learner can see (loaded levels only);
 * `completed` is progress.completed.
 */
export function levelUp(units: Partial<Record<JlptLevel, readonly string[]>>, completed: readonly string[]): LevelUp | null {
	const done = new Set(completed);
	// the hardest level the learner has finished a unit in
	const from = [...ORDER].reverse().find((l) => units[l]?.some((id) => done.has(id)));
	if (!from) return null;
	const to = ORDER[ORDER.indexOf(from) + 1];
	if (!to) return null;
	const mine = units[from]!;
	const share = mine.filter((id) => done.has(id)).length / mine.length;
	if (share < LEVEL_UP_AT) return null;
	return { from, to, done: share, ready: (units[to]?.length ?? 0) > 0 };
}
