import { describe, expect, it } from 'vitest';
import { jmdictIdOf, politeFits, politenessFromMarks, politeStep } from './politeness.ts';

describe('word politeness', () => {
	it('reads the level from JMdict marks, strongest first', () => {
		expect(politenessFromMarks(['hon'])).toBe('respectful'); // いらっしゃる
		expect(politenessFromMarks(['hum', 'pol', 'uk'])).toBe('humble'); // いただく
		expect(politenessFromMarks(['uk', 'pol'])).toBe('polite'); // すみません
		expect(politenessFromMarks(['fam', 'male'])).toBe('casual'); // お前
		expect(politenessFromMarks(['sl'])).toBe('slang');
		expect(politenessFromMarks(['form'])).toBe('formal');
	});

	it('treats a word with no politeness mark as neutral', () => {
		expect(politenessFromMarks([])).toBe('any'); // 食べる
		expect(politenessFromMarks(['uk', 'abbr', 'food'])).toBe('any');
		expect(politenessFromMarks(undefined)).toBe('any');
		// everyday お/ご nouns are marked pol, but friends say them too
		expect(politenessFromMarks(['pol'], 'お茶')).toBe('any');
		expect(politenessFromMarks(['hum'], 'お願いします')).toBe('humble');
		expect(politeStep('any')).toBeNull();
	});

	it('places each level on the four steps', () => {
		expect(politeStep('casual')).toBe(0);
		expect(politeStep('polite')).toBe(1);
		expect(politeStep('humble')).toBe(2);
		expect(politeStep('formal')).toBe(3);
	});

	it('says who you can use it with', () => {
		expect(politeFits('casual')).toEqual({ friend: 'yes', colleague: 'careful', boss: 'no', customer: 'no' });
		expect(politeFits('respectful').boss).toBe('yes');
		expect(Object.values(politeFits('any'))).toEqual(['yes', 'yes', 'yes', 'yes']);
	});

	it('finds the dictionary id in a card id', () => {
		expect(jmdictIdOf('word:1358280')).toBe(1358280);
		expect(jmdictIdOf('phrase:2028920')).toBe(2028920);
		expect(jmdictIdOf('word:custom:abc')).toBeNull();
	});
});
