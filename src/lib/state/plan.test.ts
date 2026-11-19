import { beforeEach, describe, expect, it } from 'vitest';
import type { PromoStatus } from '#lib/promo/contract.ts';

const mem = new Map<string, string>();
globalThis.localStorage = {
	getItem: (k: string) => mem.get(k) ?? null,
	setItem: (k: string, v: string) => void mem.set(k, v),
	removeItem: (k: string) => void mem.delete(k),
	clear: () => mem.clear(),
	key: () => null,
	length: 0
} as Storage;

const { plan, fromCache } = await import('./plan.svelte.ts');

const trial = (endsAt: number | null): PromoStatus => ({ plan: 'pro', planName: 'Pro', grant: { kind: 'trial', endsAt, promoCode: null } });
const offline = () => Promise.reject(new Error('offline'));

describe('package badge store', () => {
	beforeEach(async () => {
		mem.clear();
		await plan.load(null);
	});

	it('shows Free once a cached grant has ended', () => {
		expect(fromCache({ plan: 'pro', planName: 'Pro', endsAt: 1000 }, 999)).toEqual({ plan: 'pro', planName: 'Pro' });
		expect(fromCache({ plan: 'pro', planName: 'Pro', endsAt: 1000 }, 1000)).toEqual({ plan: 'free', planName: 'Free' });
		expect(fromCache({ plan: 'plus', planName: 'Plus', endsAt: null }, Date.now())).toEqual({ plan: 'plus', planName: 'Plus' });
	});

	it('keeps the package and name for an offline launch', async () => {
		await plan.load(7, 'Job Example', () => Promise.resolve(trial(Date.now() + 86_400_000)));
		expect(plan.value?.plan).toBe('pro');
		// a fresh launch: nobody known yet, the server can't be reached
		const saved = mem.get('benkyo.plan');
		await plan.load(null);
		mem.set('benkyo.plan', saved!);
		plan.restore();
		expect(plan.value).toEqual({ plan: 'pro', planName: 'Pro' });
		expect(plan.name).toBe('Job Example');
	});

	it('falls back to Free offline when the cached trial has ended', async () => {
		await plan.load(7, 'Job', () => Promise.resolve(trial(Date.now() - 1)));
		const saved = mem.get('benkyo.plan');
		await plan.load(null);
		mem.set('benkyo.plan', saved!);
		plan.restore();
		expect(plan.value?.plan).toBe('free');
	});

	it('uses the cache for the same account while the request fails, not another account', async () => {
		await plan.load(7, 'Job', () => Promise.resolve(trial(null)));
		const saved = mem.get('benkyo.plan')!;
		await plan.load(null);
		mem.set('benkyo.plan', saved);
		await plan.load(8, 'Someone', offline);
		expect(plan.value).toBeNull();
		await plan.load(7, 'Job', offline);
		expect(plan.value?.plan).toBe('pro');
		expect(plan.loading).toBe(false);
	});

	it('forgets everything when signed out', async () => {
		await plan.load(7, 'Job', () => Promise.resolve(trial(null)));
		await plan.load(null);
		expect(mem.has('benkyo.plan')).toBe(false);
		plan.restore();
		expect(plan.value).toBeNull();
		expect(plan.name).toBe('');
	});
});
