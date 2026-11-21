import { describe, expect, it } from 'vitest';
import { appName, detectEnv, guideFor, needsSafari, noteFor, oldSafariToolbar, orderedGuides, safariUrl, GUIDES } from './platform.ts';

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
	iphoneInstagram:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.18.84 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 657297468)',
	iphoneFacebook:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/488.0.0.47.106;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]',
	iphoneTikTok:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/TH',
	iphoneGoogleApp:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/350.0.698068302 Mobile/15E148 Safari/604.1',
	iphoneFirefox:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
	iphoneEdge:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.2903.68 Mobile/15E148 Safari/605.1.15',
	ipadChrome:
		'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
	androidLine:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36 Line/14.19.1',
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

describe('Safari toolbar layout', () => {
	const old = (ua: string, touch = 0) => oldSafariToolbar(ua, detectEnv(ua, touch));
	const ios26 =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
	it('uses the Share toolbar steps only for Safari before 26', () => {
		expect(old(UA.iphoneSafari)).toBe(true); // Version/18.1
		expect(old(ios26)).toBe(false);
		expect(old(UA.ipad, 5)).toBe(true);
		expect(old(UA.iphoneChrome)).toBe(false);
		expect(old(UA.androidChrome)).toBe(false);
	});
});

describe('Open in Safari', () => {
	const needs = (ua: string, touch = 0) => needsSafari(detectEnv(ua, touch));
	it('asks on iPhone and iPad outside Safari', () => {
		for (const ua of [UA.iphoneChrome, UA.iphoneLine, UA.iphoneInstagram, UA.iphoneFacebook, UA.iphoneTikTok, UA.iphoneGoogleApp, UA.iphoneFirefox, UA.iphoneEdge, UA.ipadChrome])
			expect(needs(ua), ua).toBe(true);
	});
	it('never asks in Safari or off iOS', () => {
		expect(needs(UA.iphoneSafari)).toBe(false);
		expect(needs(UA.ipad, 5)).toBe(false); // iPad Safari reports as a Mac
		expect(needs(UA.macSafari)).toBe(false);
		expect(needs(UA.macChrome)).toBe(false);
		expect(needs(UA.androidChrome)).toBe(false);
		expect(needs(UA.androidLine)).toBe(false);
	});
	it('names the app or browser', () => {
		expect(appName(UA.iphoneLine)).toBe('LINE');
		expect(appName(UA.iphoneInstagram)).toBe('Instagram');
		expect(appName(UA.iphoneFacebook)).toBe('Facebook');
		expect(appName(UA.iphoneTikTok)).toBe('TikTok');
		expect(appName(UA.iphoneGoogleApp)).toBe('Google');
		expect(appName(UA.iphoneChrome)).toBe('Chrome');
		expect(appName(UA.iphoneEdge)).toBe('Edge');
		expect(appName(UA.iphoneFirefox)).toBe('Firefox');
		expect(appName(UA.iphoneSafari)).toBe(null);
	});
	it('keeps the whole URL in the Safari link', () => {
		expect(safariUrl('https://benkyo.jirachai.me/invite/ABC?ref=X#top')).toBe('x-safari-https://benkyo.jirachai.me/invite/ABC?ref=X#top');
		expect(safariUrl('http://localhost:8787/')).toBe('x-safari-http://localhost:8787/');
	});
});
