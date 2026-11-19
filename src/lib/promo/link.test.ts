import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LINK_TTL_MS, cleanInvite, cleanRef, clearPendingPromo, markPendingTold, pendingPromo, promoLink, savePendingPromo, takeRef } from './link.ts';

describe('promo links', () => {
	beforeEach(() => {
		const m = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => m.get(k) ?? null,
			setItem: (k: string, v: string) => void m.set(k, v),
			removeItem: (k: string) => void m.delete(k)
		});
	});

	it('cleans a code the way the server does', () => {
		expect(cleanRef(' songkran-27 ')).toBe('SONGKRAN27');
		expect(cleanRef('loy_krathong')).toBe('LOY_KRATHONG');
		expect(cleanRef('_bad')).toBeNull();
		expect(cleanRef('<script>')).toBeNull();
		expect(cleanRef('')).toBeNull();
	});

	it('takes ?ref= off the address and keeps the rest', () => {
		expect(takeRef(new URL('https://x.test/?ref=songkran_27'))).toEqual({ code: 'SONGKRAN_27', rest: '/' });
		expect(takeRef(new URL('https://x.test/settings?a=1&ref=ABCDEF#k'))).toEqual({ code: 'ABCDEF', rest: '/settings?a=1#k' });
		expect(takeRef(new URL('https://x.test/?ref=!!'))).toEqual({ code: null, rest: '/' });
		expect(takeRef(new URL('https://x.test/?a=1'))).toBeNull();
	});

	it('takes ?coupon= the same way', () => {
		expect(takeRef(new URL('https://x.test/invite/BK-7KQ2-MX9D?coupon=songkran-27'))).toEqual({ code: 'SONGKRAN27', rest: '/invite/BK-7KQ2-MX9D' });
	});

	it('cleans an invite the way the server does', () => {
		expect(cleanInvite('bk 7kq2 mx9d')).toBe('BK-7KQ2-MX9D');
		expect(cleanInvite('7KQ2MX9D')).toBe('BK-7KQ2-MX9D');
		expect(cleanInvite('vip')).toBe('VIP');
		expect(cleanInvite('songkran_vip')).toBe('SONGKRAN_VIP');
		expect(cleanInvite('x')).toBeNull();
	});

	it('makes the sign-up link with an invite', () => {
		const link = promoLink('SONGKRAN_27', 'https://x.test', 'BK-7KQ2-MX9D');
		expect(link).toBe('https://x.test/invite/BK-7KQ2-MX9D?coupon=SONGKRAN_27');
		expect(takeRef(new URL(link))?.code).toBe('SONGKRAN_27');
	});

	it('makes the link Fleet copies', () => {
		expect(promoLink('SONGKRAN_27', 'https://benkyo.jirachai.me')).toBe('https://benkyo.jirachai.me/?ref=SONGKRAN_27');
		expect(takeRef(new URL(promoLink('SONGKRAN_27', 'https://x.test/')))?.code).toBe('SONGKRAN_27');
	});

	it('keeps the code until it is used, for 30 days at most', () => {
		savePendingPromo('ABCDEF', 1000);
		expect(pendingPromo(2000)).toEqual({ code: 'ABCDEF', at: 1000 });
		markPendingTold();
		expect(pendingPromo(2000)?.told).toBe(true);
		expect(pendingPromo(1000 + LINK_TTL_MS + 1)).toBeNull();
		expect(pendingPromo(2000)).toBeNull();
		savePendingPromo('ABCDEF', 1000);
		clearPendingPromo();
		expect(pendingPromo(2000)).toBeNull();
	});
});
