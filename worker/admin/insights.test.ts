import { readdirSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../auth/passkey.ts';
import { d1, migratedDb } from '../test/d1.ts';

let session: Session | null = null;
vi.mock('../auth/passkey.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../auth/passkey.ts')>()),
	getSession: async () => session
}));
const { handleAdmin } = await import('./routes.ts');
const { LATEST_MIGRATION, AUDIT_PAGE, fillUsageDays } = await import('./insights.ts');

let db: DatabaseSync;
let env: Record<string, unknown>;
const NOW = Date.now();
const DAY = 86_400_000;

beforeEach(() => {
	db = migratedDb();
	db.exec(`INSERT INTO accounts (id, name, webauthn_user_id, is_admin, created_at) VALUES
		(1, 'Owner', 'h1', 1, 0), (2, 'Mika', 'h2', 0, 0), (3, 'Aoi', 'h3', 0, 0)`);
	db.exec(`INSERT INTO ai_ledger (at, feature, provider, model, status, cost_usd, input_tokens, output_tokens, user_id) VALUES
		(${NOW}, 'fill', 'anthropic', 'haiku', 'done', 0.25, 100, 50, 2),
		(${NOW - DAY}, 'fill', 'anthropic', 'haiku', 'done', 0.5, 200, 80, 2),
		(${NOW}, 'vision', 'anthropic', 'sonnet', 'done', 1.0, 300, 90, 3),
		(${NOW}, 'propose', 'anthropic', 'haiku', 'failed', 0, NULL, NULL, 3),
		(${NOW - 40 * DAY}, 'fill', 'anthropic', 'haiku', 'done', 9, 1, 1, 2),
		(${NOW - 3_600_000}, 'fill', 'anthropic', 'haiku', 'reserved', 0.1, NULL, NULL, 2)`);
	// Mika's first call ran on the Plus package's managed AI
	db.exec(`UPDATE ai_ledger SET source = 'package', plan_id = 'plus' WHERE id = 1`);
	env = { DB: d1(db), DEV_AUTH_BYPASS: '1', CONTENT: { get: async () => null } };
	session = { tokenHash: 't', passkeyId: 'pk1', kind: 'passkey', userId: 1, name: 'Owner', isAdmin: true, appleLinked: false };
});

async function call(path: string, method = 'GET') {
	const url = new URL(`http://localhost:8787${path}`);
	try {
		const res = await handleAdmin(new Request(url, { method }), env as never, url);
		return { status: res.status, body: (await res.json()) as any };
	} catch (e) {
		const h = e as { status: number; body: unknown };
		return { status: h.status, body: h.body as any };
	}
}

describe('usage', () => {
	it('sums finished calls in the window by day, feature, model and account', async () => {
		const r = await call('/api/admin/usage?days=30');
		expect(r.status).toBe(200);
		expect(r.body.byDay).toHaveLength(30);
		expect(r.body.totals).toEqual({ usd: 1.75, calls: 3, failed: 1 });
		expect(r.body.byFeature).toEqual([
			{ feature: 'vision', calls: 1, usd: 1 },
			{ feature: 'fill', calls: 2, usd: 0.75 }
		]);
		expect(r.body.byModel[0]).toMatchObject({ model: 'sonnet', inputTokens: 300, outputTokens: 90 });
		expect(r.body.topAccounts.map((a: any) => [a.name, a.usd])).toEqual([
			['Aoi', 1],
			['Mika', 0.75]
		]);
		expect(r.body.failures).toMatchObject([{ feature: 'propose', name: 'Aoi', accountId: 3 }]);
		expect(r.body.bySource).toEqual([
			{ source: 'own', calls: 2, usd: 1.5 },
			{ source: 'package', calls: 1, usd: 0.25 }
		]);
		expect(r.body.byPackage).toEqual([{ planId: 'plus', name: 'Plus', calls: 1, usd: 0.25, credits: 0, accounts: 1, allowanceCredits: 1500 }]);
	});

	it('takes 90 days and refuses other windows', async () => {
		expect((await call('/api/admin/usage?days=90')).body.totals.usd).toBe(10.75);
		expect((await call('/api/admin/usage?days=12')).status).toBe(400);
	});

	it('is admin only', async () => {
		session = { ...session!, isAdmin: false };
		expect((await call('/api/admin/usage')).status).toBe(403);
		expect((await call('/api/admin/system')).status).toBe(403);
		expect((await call('/api/admin/audit')).status).toBe(403);
	});
});

describe('fillUsageDays', () => {
	it('zero-fills, oldest first', () => {
		const now = Date.UTC(2026, 10, 15, 9);
		expect(fillUsageDays([{ day: '2026-11-15', usd: 2, calls: 1, failed: 0 }], now, 2)).toEqual([
			{ day: '2026-11-14', usd: 0, calls: 0, failed: 0 },
			{ day: '2026-11-15', usd: 2, calls: 1, failed: 0 }
		]);
	});
});

describe('system', () => {
	it('reports checks, table sizes and stuck calls', async () => {
		const r = await call('/api/admin/system');
		expect(r.status).toBe(200);
		expect(r.body.worker).toBeNull();
		expect(r.body.ai.stuckReserved).toBe(1);
		expect(r.body.checks.find((c: any) => c.name === 'AI calls').ok).toBe(false);
		expect(r.body.checks.find((c: any) => c.name === 'Content store (KV)').ok).toBe(true);
		expect(r.body.tables.find((t: any) => t.name === 'accounts').rows).toBe(3);
		// no d1_migrations table in tests
		expect(r.body.migrations).toMatchObject({ applied: null, expected: LATEST_MIGRATION, upToDate: false });
	});

	it('compares the applied migration and shows the Worker version', async () => {
		db.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at TEXT)`);
		db.exec(`INSERT INTO d1_migrations (name, applied_at) VALUES ('0001_init.sql', '2026-11-01 10:00:00'), ('${LATEST_MIGRATION}', '2026-11-15 08:30:00')`);
		env.CF_VERSION_METADATA = { id: 'v-123', tag: '', timestamp: '2026-11-15T08:31:00.000Z' };
		const r = await call('/api/admin/system');
		expect(r.body.migrations).toMatchObject({ applied: LATEST_MIGRATION, upToDate: true, appliedAt: Date.UTC(2026, 10, 15, 8, 30) });
		expect(r.body.worker).toEqual({ id: 'v-123', tag: null, deployedAt: Date.UTC(2026, 10, 15, 8, 31) });
	});

	it('knows the newest migration file', () => {
		const files = readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
		expect(LATEST_MIGRATION).toBe(files.at(-1));
	});
});

describe('audit log', () => {
	it('pages newest first, joins names and filters by action', async () => {
		const stmt = db.prepare(`INSERT INTO admin_audit (at, actor_id, actor_email, action, target_id, detail_json) VALUES (?, 1, 'me@x', ?, ?, ?)`);
		for (let i = 0; i < AUDIT_PAGE + 5; i++) stmt.run(NOW + i, i % 2 ? 'account.disable' : 'invite.create', i % 2 ? 2 : null, JSON.stringify({ i }));
		const r = await call('/api/admin/audit');
		expect(r.body.entries).toHaveLength(AUDIT_PAGE);
		expect(r.body.entries[0].detail).toEqual({ i: AUDIT_PAGE + 4 });
		expect(r.body.next).toBe(AUDIT_PAGE);
		expect(r.body.actions).toEqual(['account.disable', 'invite.create']);
		const p2 = await call(`/api/admin/audit?offset=${AUDIT_PAGE}`);
		expect(p2.body.entries).toHaveLength(5);
		expect(p2.body.next).toBeNull();
		const f = await call('/api/admin/audit?action=account.disable');
		expect(f.body.entries.every((e: any) => e.action === 'account.disable' && e.targetName === 'Mika' && e.actorName === 'Owner')).toBe(true);
	});
});
