/**
 * Review comes in short rounds (docs/PLAN.md §5.4). A session's queue is split into rounds of
 * ROUND_SIZE cards; after each one the learner sees a break and picks "Keep going" or stops.
 * Stopping never hurts the schedule: a card that wasn't reached stays due, and FSRS takes the
 * extra delay into account when it is reviewed later.
 */
export const ROUND_SIZE = 10;

/** How many rounds `n` cards make. */
export const roundsFor = (n: number, size = ROUND_SIZE) => Math.ceil(Math.max(0, n) / size);

/** Take the next round off the front of `rest`: [round, what's left]. */
export function nextRound<T>(rest: T[], size = ROUND_SIZE): [T[], T[]] {
	return [rest.slice(0, size), rest.slice(size)];
}
