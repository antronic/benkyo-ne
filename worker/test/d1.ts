/** A tiny D1 shim over node:sqlite with the repo's migrations applied (tests only). */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function migratedDb() {
	const db = new DatabaseSync(':memory:');
	const dir = new URL('../migrations/', import.meta.url);
	for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
	return db;
}

export function d1(db: DatabaseSync) {
	const stmt = (sql: string, args: unknown[] = []) => ({
		bind: (...a: unknown[]) => stmt(sql, a),
		first: async <T>() => (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
		all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
		run: async () => {
			const r = db.prepare(sql).run(...(args as never[]));
			return { meta: { changes: Number(r.changes) } };
		},
		exec: () => {
			// like D1's batch: rows for reads (and RETURNING), changes for writes
			if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) return { results: db.prepare(sql).all(...(args as never[])), meta: { changes: 0 } };
			const r = db.prepare(sql).run(...(args as never[]));
			return { results: [], meta: { changes: Number(r.changes) } };
		}
	});
	return {
		prepare: (sql: string) => stmt(sql),
		batch: async (stmts: ReturnType<typeof stmt>[]) => {
			db.exec('BEGIN');
			try {
				const out = stmts.map((s) => s.exec());
				db.exec('COMMIT');
				return out;
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		}
	} as unknown as D1Database;
}
