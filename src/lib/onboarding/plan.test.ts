import { describe, expect, it } from 'vitest';
import { buildPlan, DEFAULTS, NEW_PER_DAY, sanitize, type Answers } from './plan.ts';

const env = { firstLesson: 'h1', firstUnit: (c: string) => ({ travel: 'basics', friends: 'greetings', japanglish: 'food-drink' })[c], hasPlacement: true, levelReady: (j: string) => j === 'N5' };
const kinds = (a: Answers, e = env) => buildPlan(a, e).map((s) => (s.kind === 'placement' ? `placement:${s.script}` : s.kind));

describe('onboarding plan', () => {
	it('skipping gives a beginner plan at 10 minutes', () => {
		expect(kinds(DEFAULTS)).toEqual(['lesson', 'daily']);
		expect(buildPlan(DEFAULTS, env).at(-1)).toEqual({ kind: 'daily', minutes: 10, newPerDay: 8 });
	});

	it('routes people who know kana to the placement check', () => {
		expect(kinds({ ...DEFAULTS, level: 'some' })).toEqual(['placement:hiragana', 'daily']);
		expect(kinds({ ...DEFAULTS, level: 'kana' })).toEqual(['placement:hiragana', 'placement:katakana', 'daily']);
	});

	it('falls back to lesson 1 when the placement check is not in this build', () => {
		expect(kinds({ ...DEFAULTS, level: 'kana' }, { ...env, hasPlacement: false })).toEqual(['lesson', 'daily']);
	});

	it('suggests the course for the first goal picked', () => {
		const plan = buildPlan({ ...DEFAULTS, goals: ['food', 'travel'] }, env);
		expect(plan[1]).toEqual({ kind: 'course', course: 'japanglish', href: '/learn/course/japanglish/food-drink' });
		expect(buildPlan({ ...DEFAULTS, goals: ['anime'] }, env)[1]).toMatchObject({ course: 'friends' });
	});

	it('takes everyday users past the kana to their level, the phrasebook and the Writing helper', () => {
		const a: Answers = { ...DEFAULTS, level: 'daily', jlpt: 'N3', goals: ['work'] };
		expect(kinds(a)).toEqual(['placement:hiragana', 'placement:katakana', 'level', 'everyday', 'daily']);
		expect(buildPlan(a, env)[2]).toEqual({ kind: 'level', jlpt: 'N3', ready: false, href: '/learn' });
		expect(buildPlan({ ...a, jlpt: 'N5' }, env)[2]).toMatchObject({ ready: true });
		expect(kinds(a, { ...env, hasPlacement: false })).toEqual(['level', 'everyday', 'daily']);
	});

	it('maps daily time to new kana per day', () => {
		expect(NEW_PER_DAY).toEqual({ 5: 5, 10: 8, 20: 10 });
	});

	it('sanitizes stored answers', () => {
		expect(sanitize({ goals: ['travel', 'nope', 'travel'] as never, level: 'x' as never, minutes: 7 as never })).toEqual({ goals: ['travel'], level: 'new', jlpt: 'N3', minutes: 10 });
		expect(sanitize({ level: 'daily', jlpt: 'N9' as never }).jlpt).toBe('N3');
		expect(sanitize({ level: 'daily', jlpt: 'N2' })).toMatchObject({ level: 'daily', jlpt: 'N2' });
		expect(sanitize(null)).toEqual(DEFAULTS);
	});
});
