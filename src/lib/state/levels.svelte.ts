/**
 * Level course units, loaded on demand per level (lib/content/levels).
 * The data is part of the build, so loading works offline once the app is installed.
 */
import { LEVELS, type JlptLevel, type LevelUnit } from '#lib/content/levels/index.ts';

class Levels {
	units = $state<Partial<Record<JlptLevel, LevelUnit[]>>>({});
	failed = $state<Partial<Record<JlptLevel, string>>>({});

	async load(id: JlptLevel): Promise<LevelUnit[]> {
		const have = this.units[id];
		if (have) return have;
		const info = LEVELS.find((l) => l.id === id);
		if (!info) return [];
		try {
			const units = await info.load();
			this.units[id] = units;
			delete this.failed[id];
			return units;
		} catch (e) {
			this.failed[id] = e instanceof Error ? e.message : String(e);
			return [];
		}
	}

	unit(id: string): LevelUnit | undefined {
		for (const list of Object.values(this.units)) {
			const u = list?.find((x) => x.id === id);
			if (u) return u;
		}
		return undefined;
	}
}

export const levels = new Levels();
