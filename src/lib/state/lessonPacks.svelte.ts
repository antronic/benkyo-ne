/**
 * AI-made lesson packs ("Make a new lesson pack"). Shown in Learn under
 * "✨ My packs" and opened with the same unit screen as the built-in courses.
 * Stored on this device (IndexedDB meta).
 */
import { get, put } from '#lib/db/idb.ts';
import type { Bi } from '#lib/ai/contract.ts';
import { COURSES, type Course, type CourseItem } from '#lib/content/courses.ts';

export interface LessonPack {
	id: string;
	topic: string;
	title: Bi;
	blurb: Bi;
	items: CourseItem[];
	createdAt: number;
}

class LessonPacks {
	list = $state<LessonPack[]>([]);
	loaded = false;

	async load() {
		if (this.loaded) return;
		this.list = (await get<LessonPack[]>('meta', 'lessonPacks')) ?? [];
		this.loaded = true;
	}
	private async persist() {
		await put('meta', $state.snapshot(this.list), 'lessonPacks');
	}
	async add(p: LessonPack) {
		await this.load();
		this.list = [p, ...this.list];
		await this.persist();
	}
	async remove(id: string) {
		this.list = this.list.filter((p) => p.id !== id);
		await this.persist();
	}

	/** Built-in courses plus a "My packs" course when packs exist. */
	courses = $derived.by((): Course[] => {
		if (!this.list.length) return COURSES;
		const mine = {
			id: 'mine',
			title: 'My packs',
			emoji: '✨',
			blurb: 'Lesson packs you made with AI.',
			hue: 285,
			units: this.list.map((p) => ({ id: p.id, title: p.title.en, items: p.items }))
		} as unknown as Course;
		return [mine, ...COURSES];
	});
}

export const lessonPacks = new LessonPacks();
