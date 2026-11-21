import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, hello, isIOS, play, unlock } from './sound.ts';

describe('Kuri sounds', () => {
	it('has every sound the companion uses', () => {
		expect(SOUND_NAMES.sort()).toEqual(['bark', 'dizzy', 'encourage', 'happy', 'held', 'intro', 'sleep', 'tap', 'thinking', 'wave', 'yip']);
	});
	it('does nothing where there is no Web Audio', () => {
		expect(unlock()).toBeNull();
		expect(() => (SOUND_NAMES.forEach(play), hello())).not.toThrow();
	});
});

describe('iPhone and iPad only for ambient audio', () => {
	const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
	it('treats iPhone and iPad (which reports a Mac with touch) as iOS', () => {
		expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', maxTouchPoints: 5 })).toBe(true);
		expect(isIOS({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
	});
	it('leaves a Mac and other desktops on normal audio', () => {
		expect(isIOS({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
		expect(isIOS({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0', maxTouchPoints: 0 })).toBe(false);
	});
});
