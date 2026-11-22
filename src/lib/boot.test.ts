import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeStorage() {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, String(v)),
		removeItem: (k: string) => void m.delete(k)
	};
}

async function load(storage: ReturnType<typeof fakeStorage>) {
	vi.resetModules();
	vi.stubGlobal('window', globalThis);
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('sessionStorage', fakeStorage());
	return import('./boot.ts');
}

afterEach(() => vi.unstubAllGlobals());

describe('boot', () => {
	it('turns on safe mode after two launches that never finished starting', async () => {
		const s = fakeStorage();
		expect((await load(s)).safeMode).toBe(false);
		expect((await load(s)).safeMode).toBe(false);
		expect((await load(s)).safeMode).toBe(true);
	});

	it('a launch that finishes resets the counter', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('addEventListener', () => {});
		const s = fakeStorage();
		await load(s);
		const b = await load(s);
		b.bootDone();
		vi.advanceTimersByTime(13_000);
		expect((await load(s)).safeMode).toBe(false);
		vi.useRealTimers();
	});

	it('going to the background counts as a good launch (iOS freezes home-screen apps without a pagehide)', async () => {
		vi.stubGlobal('addEventListener', () => {});
		const s = fakeStorage();
		await load(s);
		const b = await load(s);
		let onVis: (() => void) | undefined;
		vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: (_: string, fn: () => void) => (onVis = fn) });
		b.bootDone();
		onVis?.();
		expect((await load(s)).safeMode).toBe(false);
	});

	it('works when storage is blocked', async () => {
		const blocked = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('SecurityError');
			},
			removeItem: () => {}
		};
		expect((await load(blocked as never)).safeMode).toBe(false);
	});

	it('withTimeout rejects a step that never answers', async () => {
		const { withTimeout } = await load(fakeStorage());
		await expect(withTimeout(new Promise(() => {}), 10, 'storage')).rejects.toThrow('storage timed out');
		await expect(withTimeout(Promise.resolve(3), 10, 'x')).resolves.toBe(3);
	});

	it('attempt keeps going when a step throws or rejects', async () => {
		const { attempt } = await load(fakeStorage());
		const report = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(
			attempt(
				'a',
				() => {
					throw new Error('boom');
				},
				report
			)
		).toBeUndefined();
		attempt('b', () => Promise.reject(new Error('later')), report);
		await new Promise((r) => setTimeout(r, 0));
		expect(report.mock.calls.map((c) => c[0])).toEqual(['boot_a', 'boot_b']);
	});
});
