/**
 * Tiny promise wrapper over IndexedDB. IndexedDB is the source of truth on
 * the device (local-first); the server only stores a copy for sync.
 */
const DB_NAME = 'benkyo';
const VERSION = 1;

export type StoreName = 'cards' | 'logs' | 'meta';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	dbp ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			db.createObjectStore('cards', { keyPath: 'id' });
			const logs = db.createObjectStore('logs', { keyPath: 'id' });
			logs.createIndex('synced', 'synced');
			db.createObjectStore('meta');
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
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

export async function clearAll() {
	const db = await open();
	const tx = db.transaction(['cards', 'logs', 'meta'], 'readwrite');
	for (const s of ['cards', 'logs', 'meta'] as const) tx.objectStore(s).clear();
	return new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
}
