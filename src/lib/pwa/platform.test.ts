import { describe, expect, it } from 'vitest';
import { detectEnv, guideFor, noteFor, orderedGuides, GUIDES } from './platform.ts';

const UA = {
	iphoneSafari:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
	iphoneChrome:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
	iphoneLine:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.19.0',
	ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	winEdge:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
	winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.81 Mobile Safari/537.36',
	androidSamsung:
		'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
	androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
	chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

const guide = (ua: string, touch = 0) => guideFor(detectEnv(ua, touch));

describe('install guide detection', () => {
	it('picks the guide for each platform', () => {
		expect(guide(UA.iphoneSafari)).toBe('iphone');
		expect(guide(UA.iphoneChrome)).toBe('iphone');
		expect(guide(UA.ipad, 5)).toBe('ipad');
		expect(guide(UA.macSafari, 0)).toBe('mac');
		expect(guide(UA.macChrome)).toBe('desktop');
		expect(guide(UA.winEdge)).toBe('desktop');
		expect(guide(UA.winFirefox)).toBe('firefox');
		expect(guide(UA.androidChrome)).toBe('android');
		expect(guide(UA.androidSamsung)).toBe('android');
		expect(guide(UA.androidFirefox)).toBe('firefox');
		expect(guide(UA.chromebook)).toBe('desktop');
	});

	it('recognises browsers', () => {
		expect(detectEnv(UA.winEdge).browser).toBe('edge');
		expect(detectEnv(UA.macSafari).browser).toBe('safari');
		expect(detectEnv(UA.androidSamsung).browser).toBe('samsung');
		expect(detectEnv(UA.iphoneLine).browser).toBe('inapp');
	});

	it('adds a note where the browser needs one', () => {
		expect(noteFor(detectEnv(UA.iphoneSafari))).toBe(null);
		expect(noteFor(detectEnv(UA.iphoneChrome))).toBe('ios-other');
		expect(noteFor(detectEnv(UA.iphoneLine))).toBe('inapp');
		expect(noteFor(detectEnv(UA.androidSamsung))).toBe('samsung');
		expect(noteFor(detectEnv(UA.winEdge))).toBe(null);
	});

	it('puts the detected guide first and keeps every guide', () => {
		const o = orderedGuides('android');
		expect(o[0]).toBe('android');
		expect([...o].sort()).toEqual([...GUIDES].sort());
	});
});
