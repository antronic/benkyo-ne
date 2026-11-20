import { beforeEach, describe, expect, it, vi } from 'vitest';

const tracked: { kind: string; name: string; data: Record<string, unknown> }[] = [];
vi.mock('#lib/beta/telemetry.svelte.ts', () => ({
	telemetry: {
		enabled: false,
		track: (kind: string, name: string, data: Record<string, unknown>) => tracked.push({ kind, name, data }),
		flush: async () => {}
	}
}));
const { telemetry } = await import('#lib/beta/telemetry.svelte.ts');
const { ERROR_ID_RE, breadcrumbs, crumb, debug, errorDetails, instrumentFetch, lastErrorId, newErrorId, reportError, sendErrorNote, setRoute } = await import(
	'./errors.svelte.ts'
);

const on = (v: boolean) => ((telemetry as { enabled: boolean }).enabled = v);

beforeEach(() => {
	tracked.length = 0;
	on(false);
});

describe('error ids', () => {
	it('are E- and six Crockford base32 characters', () => {
		for (let i = 0; i < 200; i++) expect(newErrorId()).toMatch(ERROR_ID_RE);
		expect(newErrorId(() => new Uint8Array([0, 1, 31, 32, 255, 18]))).toBe('E-01Z0ZJ');
	});
	it('never use I, L, O or U', () => {
		const ids = Array.from({ length: 500 }, () => newErrorId()).join('');
		expect(ids.slice(2)).not.toMatch(/[ILOU]/);
	});
});

describe('reportError', () => {
	it('keeps the error on the device with an id and the screen, and sends nothing without consent', () => {
		setRoute('/learn/kana');
		const id = reportError(new TypeError('x is undefined'), { name: 'screen_crash' });
		expect(id).toMatch(ERROR_ID_RE);
		expect(lastErrorId()).toBe(id);
		expect(debug.log[0]).toMatchObject({ id, name: 'screen_crash', message: 'x is undefined', type: 'TypeError', route: '/learn/kana' });
		expect(tracked).toHaveLength(0);
	});

	it('sends a beta error event with the id and breadcrumbs when the account agreed', () => {
		on(true);
		setRoute('/admin/packages');
		crumb('api', 'PUT /api/admin/credit-rates → 500 in 40 ms');
		const id = reportError(new Error('boom 1'), { name: 'kit', status: 500 });
		expect(tracked).toHaveLength(1);
		const ev = tracked[0];
		expect(ev).toMatchObject({ kind: 'error', name: 'kit' });
		expect(ev.data).toMatchObject({ errorId: id, message: 'boom 1', status: 500 });
		const trail = ev.data.breadcrumbs as { kind: string; text: string }[];
		expect(trail.map((c) => c.text)).toContain('/admin/packages');
		expect(trail.at(-1)?.text).toContain('credit-rates');
	});

	it('reports the same failure once when it repeats right away (a render loop)', () => {
		on(true);
		const a = reportError(new Error('loop'));
		const b = reportError(new Error('loop'));
		expect(b).toBe(a);
		expect(tracked).toHaveLength(1);
	});

	it('scrubs key-like text from the message', () => {
		reportError(new Error('bad key sk-ant-api03-abcdefghijklmnopqrstuvwxyz'));
		expect(debug.log[0].message).toBe('bad key [redacted]');
	});

	it('never throws, whatever it is given', () => {
		expect(reportError(undefined)).toMatch(ERROR_ID_RE);
		expect(reportError({ message: 'plain object' })).toMatch(ERROR_ID_RE);
		expect(debug.log[0].message).toBe('plain object');
	});
});

describe('errorDetails', () => {
	it('gives the id, build, screen and message for Copy details', () => {
		const id = reportError(new Error('details please'), { route: '/settings' });
		const text = errorDetails(id);
		expect(text).toContain(`Error: ${id}`);
		expect(text).toMatch(/Build: \S+/);
		expect(text).toContain('Screen: /settings');
		expect(text).toContain('Message: error: details please');
	});
});

describe('sendErrorNote', () => {
	it('is refused without consent, so the screen can offer Copy instead', async () => {
		expect(await sendErrorNote('E-ABCDEF', 'I tapped save')).toBe(false);
		expect(tracked).toHaveLength(0);
	});
	it('sends the note for that error id', async () => {
		on(true);
		expect(await sendErrorNote('E-ABCDEF', 'I tapped save')).toBe(true);
		expect(tracked[0]).toMatchObject({ kind: 'error', name: 'error_note', data: { errorId: 'E-ABCDEF', note: 'I tapped save' } });
	});
});

describe('instrumentFetch', () => {
	const target = (status: number, headers: Record<string, string> = {}) => ({
		fetch: (async () => new Response('{}', { status, headers })) as typeof fetch
	});

	it('adds a breadcrumb per API call, without the query string', async () => {
		const t = target(200, { 'x-request-id': 'abc123' });
		instrumentFetch(t);
		await t.fetch('http://localhost/api/admin/accounts?q=secret-name');
		const last = breadcrumbs().at(-1)!;
		expect(last.kind).toBe('api');
		expect(last.text).toMatch(/^GET \/api\/admin\/accounts → 200 in \d+ ms \(abc123\)$/);
		expect(last.text).not.toContain('secret-name');
	});

	it('reports a 5xx answer as an error with the request id', async () => {
		on(true);
		const t = target(500, { 'x-request-id': 'ray42' });
		instrumentFetch(t);
		const res = await t.fetch('http://localhost/api/admin/credit-rates', { method: 'PUT' });
		expect(res.status).toBe(500);
		expect(tracked[0]).toMatchObject({ name: 'api_error', data: { status: 500, requestId: 'ray42', method: 'PUT', path: '/api/admin/credit-rates' } });
	});

	it('treats a network failure as a breadcrumb, not an error', async () => {
		on(true);
		const t = { fetch: (async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch };
		instrumentFetch(t);
		await expect(t.fetch('http://localhost/api/sync', { method: 'POST' })).rejects.toThrow();
		expect(breadcrumbs().at(-1)?.text).toMatch(/POST \/api\/sync → failed/);
		expect(tracked).toHaveLength(0);
	});

	it('does not log the upload of the log itself', async () => {
		const t = target(200);
		instrumentFetch(t);
		crumb('nav', '/before');
		await t.fetch('http://localhost/api/beta/events', { method: 'POST' });
		expect(breadcrumbs().at(-1)?.text).toBe('/before');
	});
});
