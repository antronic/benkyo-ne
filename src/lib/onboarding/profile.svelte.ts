/**
 * The learner's onboarding answers, kept on this device (IndexedDB meta
 * 'profile'). Finishing the questionnaire also applies the daily pace to
 * Settings, so everything else in the app keeps reading progress.settings.
 *
 * Optional pieces from other branches are found at build time, so this works
 * whichever of them is merged first:
 * - the interface language (src/lib/i18n, PR #8) adds a language picker;
 * - the placement check (/learn/placement, PR #1) is offered to people who
 *   already know kana.
 */
import { get, put } from '#lib/db/idb.ts';
import { progress } from '#lib/state/progress.svelte.ts';
import { COURSES } from '#lib/content/courses.ts';
import { LESSONS } from '#lib/content/lessons.ts';
import { buildPlan, NEW_PER_DAY, sanitize, type Answers, type Profile, type Step } from './plan.ts';
import { STRINGS, type Lang } from './strings.ts';

interface I18nModule {
	i18n: { locale: string; pref: string; setPref(p: string): void };
	LOCALES: { code: string; name: string }[];
}
const i18nMod = Object.values(import.meta.glob('/src/lib/i18n/index.svelte.ts', { eager: true }))[0] as I18nModule | undefined;
const placementRoutes = import.meta.glob('/src/routes/learn/placement/**/+page.svelte');

export const hasPlacement = Object.keys(placementRoutes).length > 0;
/** interface languages to offer, or [] when this build is English only */
export const LANGS: { code: Lang; name: string }[] = (i18nMod?.LOCALES ?? []).filter((l): l is { code: Lang; name: string } => l.code in STRINGS);

export const lang = {
	get code(): Lang {
		const l = i18nMod?.i18n.locale;
		return l === 'th' ? 'th' : 'en';
	},
	set(code: Lang) {
		i18nMod?.i18n.setPref(code);
	}
};

/** Onboarding copy in the current interface language (reactive). */
export const s = () => STRINGS[lang.code];

export const planFor = (a: Answers): Step[] =>
	buildPlan(a, {
		firstLesson: LESSONS[0].id,
		firstUnit: (c) => COURSES.find((x) => x.id === c)?.units[0]?.id,
		hasPlacement
	});

class ProfileStore {
	loaded = $state(false);
	value = $state<Profile | null>(null);

	async load() {
		if (this.loaded) return this.value;
		const raw = await get<Profile>('meta', 'profile');
		this.value = raw ? { ...raw, ...sanitize(raw) } : null;
		this.loaded = true;
		return this.value;
	}

	/** Save answers and apply the daily pace (skipping leaves Settings alone). */
	async save(a: Answers, skipped = false) {
		const p: Profile = { ...sanitize(a), at: Date.now(), skipped };
		this.value = p;
		this.loaded = true;
		await Promise.all([put('meta', p, 'profile'), skipped ? null : progress.saveSettings({ newPerDay: NEW_PER_DAY[p.minutes] })]);
	}

	async hide() {
		if (!this.value) return;
		this.value = { ...this.value, hidden: true };
		await put('meta', $state.snapshot(this.value), 'profile');
	}
}

export const profile = new ProfileStore();
