import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, hello, play, unlock } from './sound.ts';

describe('Kuri sounds', () => {
	it('has every sound the companion uses', () => {
		expect(SOUND_NAMES.sort()).toEqual(['bark', 'encourage', 'happy', 'held', 'intro', 'sleep', 'tap', 'thinking', 'wave', 'yip']);
	});
	it('does nothing where there is no Web Audio', () => {
		expect(unlock()).toBeNull();
		expect(() => (SOUND_NAMES.forEach(play), hello())).not.toThrow();
	});
});
