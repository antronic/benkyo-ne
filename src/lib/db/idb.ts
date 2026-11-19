/**
 * Tiny promise wrapper over IndexedDB. IndexedDB is the source of truth on
 * the device (local-first); the server only stores a copy for sync.
 */
const DB_NAME = 'benkyo';
const VERSION = 3;

export type StoreName = 'cards' | 'logs' | 'meta' | 'userCards' | 'packs' | 'outbox' | 'notes';

let dbp: Promise<IDBDatabase> | null = null;

/** How long to wait for the database before giving up (Safari can hang here). */
const OPEN_TIMEOUT_MS = 6000;

function open(): Promise<IDBDatabase> {
	dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
		let req: IDBOpenDBRequest;
		try {
			req = indexedDB.open(DB_NAME, VERSION);
		} catch (e) {
			return reject(e); // storage blocked (some private modes, disabled cookies)
		}
		const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), OPEN_TIMEOUT_MS);
		req.onupgradeneeded = (e) => {
			const db = req.result;
			const from = e.oldVersion;
			if (from < 1) {
				db.createObjectStore('cards', { keyPath: 'id' });
				const logs = db.createObjectStore('logs', { keyPath: 'id' });
				logs.createIndex('synced', 'synced');
				db.createObjectStore('meta');
			}
			if (from < 2) {
				// word/phrase card content (docs/AI-PLAN.md §4b), reading packs, offline AI outbox
				db.createObjectStore('userCards', { keyPath: 'id' });
				db.createObjectStore('packs', { keyPath: 'id' });
				db.createObjectStore('outbox', { keyPath: 'id' });
			}
			if (from < 3) {
				// personal notes, one per study item (docs/NOTES.md)
				db.createObjectStore('notes', { keyPath: 'subject' });
			}
		};
		req.onsuccess = () => {
			clearTimeout(timer);
			const db = req.result;
			// another tab upgrading, or Safari dropping the connection: open afresh next time
			db.onversionchange = () => {
				db.close();
				dbp = null;
			};
			db.onclose = () => (dbp = null);
			resolve(db);
		};
		req.onerror = () => {
			clearTimeout(timer);
			reject(req.error);
		};
	}).catch((e) => {
		dbp = null; // let the next call try again instead of failing forever
		throw e;
	});
	return dbp;
}

const wrap = <T>(req: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

export async function getAll<T>(store: StoreName): Promise<T[]> {
	const db = await open();
	return wrap(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
	const db = await open();
	return wrap(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function put(store: StoreName, value: unknown, key?: IDBValidKey) {
	const db = await open();
	return wrap(db.transaction(store, 'readwrite').objectStore(store).put(value, key));
}

/** Write many records in one transaction. */
export async function putMany(store: StoreName, values: unknown[]) {
	const db = await open();
	const tx = db.transaction(store, 'readwrite');
	const os = tx.objectStore(store);
	for (const v of values) os.put(v);
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function del(store: StoreName, key: IDBValidKey) {
	const db = await open();
	return wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

const ALL: StoreName[] = ['cards', 'logs', 'meta', 'userCards', 'packs', 'outbox', 'notes'];

export async function clearAll() {
	const db = await open();
	const tx = db.transaction(ALL, 'readwrite');
	for (const s of ALL) tx.objectStore(s).clear();
	return new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
}
