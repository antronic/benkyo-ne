/**
 * FSRS-5 scheduler — an independent TypeScript port of the Free Spaced
 * Repetition Scheduler (https://github.com/open-spaced-repetition).
 *
 * Memory model per card:
 *   D  difficulty      1..10
 *   S  stability       days until recall probability drops to 90 %
 *   R  retrievability  probability of recall now: (1 + F·t/S)^DECAY
 *
 * Pure functions only. No Date objects inside the maths; callers pass ms.
 */

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const Again = 1,
	Hard = 2,
	Good = 3,
	Easy = 4;

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface Card {
	id: string;
	state: CardState;
	due: number; // epoch ms
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	lastReview: number | null; // epoch ms
}

export interface ReviewLog {
	id: string;
	cardId: string;
	grade: Grade;
	reviewedAt: number;
	elapsedDays: number;
	durationMs: number;
}

/** FSRS-5 default parameters (trained on ~20k Anki users). */
export const DEFAULT_W = [
	0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
	1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
const DAY = 86_400_000;
const MIN_S = 0.01;

export interface Params {
	w: readonly number[];
	requestRetention: number; // 0.7 .. 0.97
	maximumInterval: number; // days
	/** Short in-session steps for new / lapsed cards, in minutes. */
	learningSteps: number[];
	relearningSteps: number[];
}

export const defaultParams: Params = {
	w: DEFAULT_W,
	requestRetention: 0.9,
	maximumInterval: 365 * 3,
	learningSteps: [1, 10],
	relearningSteps: [10]
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function retrievability(elapsedDays: number, stability: number): number {
	return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Interval (days) at which R falls to the requested retention. */
export function nextInterval(stability: number, p: Params = defaultParams): number {
	const days = (stability / FACTOR) * (Math.pow(p.requestRetention, 1 / DECAY) - 1);
	return clamp(Math.round(days), 1, p.maximumInterval);
}

export function initStability(g: Grade, w: readonly number[]) {
	return Math.max(w[g - 1], MIN_S);
}

export function initDifficulty(g: Grade, w: readonly number[]) {
	return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
}

export function nextDifficulty(d: number, g: Grade, w: readonly number[]) {
	const delta = -w[6] * (g - 3);
	const damped = d + (delta * (10 - d)) / 9; // linear damping (FSRS-5)
	const reverted = w[7] * initDifficulty(Easy, w) + (1 - w[7]) * damped; // mean reversion
	return clamp(reverted, 1, 10);
}

export function stabilityAfterRecall(d: number, s: number, r: number, g: Grade, w: readonly number[]) {
	const hardPenalty = g === Hard ? w[15] : 1;
	const easyBonus = g === Easy ? w[16] : 1;
	return (
		s *
		(Math.exp(w[8]) *
			(11 - d) *
			Math.pow(s, -w[9]) *
			(Math.exp(w[10] * (1 - r)) - 1) *
			hardPenalty *
			easyBonus +
			1)
	);
}

export function stabilityAfterForget(d: number, s: number, r: number, w: readonly number[]) {
	const sf =
		w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
	return Math.max(MIN_S, Math.min(sf, s));
}

/** Same-day review (learning steps) — FSRS-5 short-term stability. */
export function stabilityShortTerm(s: number, g: Grade, w: readonly number[]) {
	return Math.max(MIN_S, s * Math.exp(w[17] * (g - 3 + w[18])));
}

export function newCard(id: string, now: number): Card {
	return {
		id,
		state: 'new',
		due: now,
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		lastReview: null
	};
}

/**
 * Apply a review and return the updated card.
 * `step` tracks the position inside learning steps; it is derived from reps
 * since the last state change, so we keep it implicit: learning cards that
 * get Good move to the next step; past the last step they graduate.
 */
export function review(card: Card, g: Grade, now: number, p: Params = defaultParams): Card {
	const w = p.w;
	const elapsedDays = card.lastReview === null ? 0 : Math.max(0, (now - card.lastReview) / DAY);
	const c: Card = { ...card, reps: card.reps + 1, lastReview: now };

	if (card.state === 'new') {
		c.stability = initStability(g, w);
		c.difficulty = initDifficulty(g, w);
		return scheduleLearning(c, g, 0, p.learningSteps, now, p);
	}

	const r = retrievability(elapsedDays, card.stability);
	const sameDay = elapsedDays < 1;

	c.difficulty = nextDifficulty(card.difficulty, g, w);
	if (sameDay) {
		c.stability = stabilityShortTerm(card.stability, g, w);
	} else if (g === Again) {
		c.stability = stabilityAfterForget(card.difficulty, card.stability, r, w);
	} else {
		c.stability = stabilityAfterRecall(card.difficulty, card.stability, r, g, w);
	}

	if (card.state === 'learning' || card.state === 'relearning') {
		const steps = card.state === 'learning' ? p.learningSteps : p.relearningSteps;
		return scheduleLearning(c, g, stepIndex(card, steps, now), steps, now, p);
	}

	// review state
	if (g === Again) {
		c.lapses = card.lapses + 1;
		c.state = 'relearning';
		c.due = now + (p.relearningSteps[0] ?? 10) * 60_000;
		return c;
	}
	c.due = now + nextInterval(c.stability, p) * DAY;
	return c;
}

/** Which learning step the card is on, inferred from its current delay. */
function stepIndex(card: Card, steps: number[], _now: number): number {
	if (card.lastReview === null) return 0;
	const delayMin = Math.round((card.due - card.lastReview) / 60_000);
	const i = steps.findIndex((m) => m === delayMin);
	return i < 0 ? 0 : i;
}

function scheduleLearning(
	c: Card,
	g: Grade,
	step: number,
	steps: number[],
	now: number,
	p: Params
): Card {
	const graduate = () => {
		c.state = 'review';
		c.due = now + nextInterval(c.stability, p) * DAY;
		return c;
	};
	if (g === Easy || steps.length === 0) return graduate();
	if (g === Again) {
		c.state = c.state === 'relearning' ? 'relearning' : 'learning';
		c.due = now + steps[0] * 60_000;
		return c;
	}
	if (g === Hard) {
		c.state = c.state === 'new' ? 'learning' : c.state;
		const cur = steps[step] ?? steps[0];
		const nxt = steps[step + 1] ?? cur * 1.5;
		c.due = now + Math.round((cur + nxt) / 2) * 60_000;
		return c;
	}
	// Good
	const next = step + 1;
	if (c.state === 'new') {
		if (steps.length <= 1) return graduate();
		c.state = 'learning';
		c.due = now + steps[1] * 60_000;
		return c;
	}
	if (next >= steps.length) return graduate();
	c.due = now + steps[next] * 60_000;
	return c;
}

/**
 * Infer a grade from behaviour, so beginners don't have to rate themselves.
 * See docs/PLAN.md §5.2.
 */
export function inferGrade(correct: boolean, ms: number, usedHint = false): Grade {
	if (!correct) return Again;
	if (usedHint || ms > 8000) return Hard;
	if (ms < 2000) return Easy;
	return Good;
}

/** Replay a full review log into a card — used to merge synced devices. */
export function replay(id: string, logs: ReviewLog[], p: Params = defaultParams): Card {
	const sorted = logs.filter((l) => l.cardId === id).sort((a, b) => a.reviewedAt - b.reviewedAt);
	let card = newCard(id, sorted[0]?.reviewedAt ?? Date.now());
	for (const l of sorted) card = review(card, l.grade, l.reviewedAt, p);
	return card;
}
