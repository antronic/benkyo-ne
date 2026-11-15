import { describe, expect, it } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import type { Env } from '../env.ts';
import { adminSessionProblem, monthStart, requireAccess } from './routes.ts';

const session = (over: Partial<Session> = {}): Session => ({
	tokenHash: 'h',
	passkeyId: 'p',
	kind: 'passkey',
	userId: 1,
	name: 'Owner',
	isAdmin: true,
	appleLinked: false,
	...over
});
const env = (over: Partial<Env> = {}) => ({ DB: {} as D1Database, CONTENT: {} as KVNamespace, ...over }) as Env;
const prod = new URL('https://benkyo.jirachai.me/api/admin/overview');

describe('admin session rules', () => {
	it('allows only passkey sessions on admin accounts', () => {
		expect(adminSessionProblem(session())).toBeNull();
		expect(adminSessionProblem(null)).toMatch(/Sign in/);
		expect(adminSessionProblem(session({ kind: 'recovery', passkeyId: null }))).toMatch(/with a passkey/);
		expect(adminSessionProblem(session({ kind: 'apple', passkeyId: null }))).toMatch(/with a passkey/);
		expect(adminSessionProblem(session({ isAdmin: false }))).toMatch(/not an admin/);
	});
});

describe('Cloudflare Access gate', () => {
	it('stays closed when Access is not configured', async () => {
		await expect(requireAccess(new Request(prod), env(), prod)).rejects.toMatchObject({ status: 503 });
	});
	it('refuses requests without the Access header', async () => {
		const e = env({ ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud' });
		await expect(requireAccess(new Request(prod), e, prod)).rejects.toMatchObject({ status: 403 });
		const bad = new Request(prod, { headers: { 'cf-access-jwt-assertion': 'not.a.jwt' } });
		await expect(requireAccess(bad, e, prod)).rejects.toMatchObject({ status: 403 });
	});
	it('ignores the dev bypass outside localhost', async () => {
		await expect(requireAccess(new Request(prod), env({ DEV_AUTH_BYPASS: '1' }), prod)).rejects.toMatchObject({ status: 503 });
		const local = new URL('http://localhost:8787/api/admin/overview');
		await expect(requireAccess(new Request(local), env({ DEV_AUTH_BYPASS: '1' }), local)).resolves.toMatchObject({ email: 'dev@localhost' });
	});
});

describe('monthStart', () => {
	it('is the first of the month in UTC', () => {
		expect(new Date(monthStart(Date.UTC(2026, 10, 15, 23, 59))).toISOString()).toBe('2026-11-01T00:00:00.000Z');
	});
});
