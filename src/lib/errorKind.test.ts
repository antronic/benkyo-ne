import { describe, expect, it } from 'vitest';
import { errorKind } from './errorKind.ts';

describe('errorKind', () => {
	it('shows offline before anything else', () => expect(errorKind(500, 'Internal Error', false, false)).toBe('offline'));
	it('maps 404 to not-found', () => expect(errorKind(404, 'Not Found', true, false)).toBe('not-found'));
	it('maps 401 to session', () => expect(errorKind(401, 'x', true, false)).toBe('session'));
	it('maps 403 in Fleet to access, elsewhere to session', () => {
		expect(errorKind(403, 'x', true, true)).toBe('access');
		expect(errorKind(403, 'x', true, false)).toBe('session');
	});
	it('treats a thrown client error as a bug', () => expect(errorKind(500, 'Internal Error', true, false)).toBe('crash'));
	it('treats a server answer as server', () => {
		expect(errorKind(500, 'D1 timeout', true, true)).toBe('server');
		expect(errorKind(503, undefined, true, false)).toBe('server');
	});
	it('shows update when a deploy removed an app file', () =>
		expect(errorKind(500, 'Failed to fetch dynamically imported module: /_app/immutable/x.js', true, false)).toBe('update'));
});
