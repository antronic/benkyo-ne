import { describe, expect, it } from 'vitest';
import { prepare } from './speech.ts';

describe('prepare', () => {
	it('slows single kana and ends with 。 so the vowel is full', () => {
		expect(prepare('あ')).toEqual({ text: 'あ。', rate: 0.55 });
	});
	it('short words get a full stop and a moderate rate', () => {
		expect(prepare('いけ')).toEqual({ text: 'いけ。', rate: 0.7 });
	});
	it('longer text keeps its punctuation and normal pace', () => {
		expect(prepare('いただきます。\nどうぞ。').rate).toBe(0.85);
	});
});
