/**
 * Personal notes (docs/NOTES.md): one private note per study item, kept in
 * IndexedDB and synced to your account with /api/sync (last write wins).
 * An emptied note becomes a tombstone so the delete reaches other devices.
 */
import { browser } from '$app/env';
import { getAll, put } from '#lib/db/idb.ts';
import { NOTE_MAX, type Note } from '#lib/notes/contract.ts';

class Notes {
	ready = $state(false);
	all = $state<Record<string, Note>>({});
	private loading: Promise<void> | null = null;

	/** Live notes, newest edit first. */
	list = $derived(
		Object.values(this.all)
			.filter((n) => !n.deleted && n.body.trim())
			.sort((a, b) => b.updatedAt - a.updatedAt)
	);

	load(): Promise<void> {
		if (!browser) return Promise.resolve();
		this.loading ??= getAll<Note>('notes')
			.then((rows) => {
				this.all = Object.fromEntries(rows.map((n) => [n.subject, n]));
			})
			.catch(() => {})
			.finally(() => (this.ready = true));
		return this.loading;
	}

	/** The note's text for a study item, or '' when there is none. */
	text(subject: string): string {
		const n = this.all[subject];
		return n && !n.deleted ? n.body : '';
	}

	/** Save a note; an empty body deletes it. Returns false when nothing changed. */
	async save(subject: string, label: string, body: string): Promise<boolean> {
		await this.load();
		const text = body.slice(0, NOTE_MAX);
		const prev = this.all[subject];
		const empty = !text.trim();
		if (!prev && empty) return false;
		if (prev && !prev.deleted && prev.body === text && prev.label === label) return false;
		if (prev?.deleted && empty) return false;
		const now = Date.now();
		const next: Note = {
			subject,
			label,
			body: empty ? '' : text,
			createdAt: prev && !prev.deleted ? prev.createdAt : now,
			updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
			deleted: empty
		};
		this.all[subject] = next;
		await put('notes', $state.snapshot(next));
		return true;
	}

	/** Notes changed on this device after `since` (for sync). */
	async changedSince(since: number): Promise<Note[]> {
		await this.load();
		return Object.values($state.snapshot(this.all)).filter((n) => n.updatedAt > since);
	}

	/** Merge notes from another device (last write wins). */
	async merge(remote: Note[]) {
		await this.load();
		for (const r of remote) {
			const l = this.all[r.subject];
			if (!l || r.updatedAt > l.updatedAt) {
				this.all[r.subject] = r;
				await put('notes', r);
			}
		}
	}

	/** Forget every note on this device (Reset progress). */
	clearLocal() {
		this.all = {};
	}
}

export const notes = new Notes();
