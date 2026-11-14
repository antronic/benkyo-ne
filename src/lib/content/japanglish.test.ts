import { describe, expect, it } from 'vitest';
import { japanglish } from './japanglish.ts';

describe('japanglish guess', () => {
	it.each([
		['test', 'テスト'],
		['bus', 'バス'],
		['hotel', 'ホテル'],
		['desk', 'デスク'],
		['milk', 'ミルク'],
		['pen', 'ペン'],
		['bed', 'ベッド'],
		['cup', 'カップ'],
		['game', 'ゲーム'],
		['tape', 'テープ'],
		['time', 'タイム'],
		['home', 'ホーム'],
		['happy', 'ハッピー'],
		['station', 'ステーション']
	])('%s → %s', (en, kata) => {
		expect(japanglish(en).guess).toBe(kata);
	});
	it('explains the rules it used', () => {
		const r = japanglish('bed');
		expect(r.steps.map((s) => s.rule.id)).toContain('small-tsu');
	});
});
