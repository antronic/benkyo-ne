import { describe, expect, it } from 'vitest';
import { stepsFor } from './steps.ts';
import { detectEnv, guideFor, oldSafariToolbar } from './platform.ts';

const firstArt = (ua: string, touch: number) => {
	const env = detectEnv(ua, touch);
	return stepsFor(guideFor(env), oldSafariToolbar(ua, env))[0].art;
};

describe('iPhone / iPad install steps', () => {
	const iphone26 =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
	// iPad, or an iPhone showing the desktop site: Safari says "Macintosh"
	const desktopSite26 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
	const iphone18 =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
	const ipad18 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

	it('starts at the ☰ page menu on Safari 26+', () => {
		expect(firstArt(iphone26, 5)).toBe('ios-menu');
		expect(firstArt(desktopSite26, 5)).toBe('ios-menu');
	});
	it('starts at the Share button on older Safari', () => {
		expect(firstArt(iphone18, 5)).toBe('ios-share');
		expect(firstArt(ipad18, 5)).toBe('ipad-share');
	});
});
