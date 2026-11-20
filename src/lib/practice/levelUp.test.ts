import { describe, expect, it } from 'vitest';
import { levelUp } from './levelUp.ts';

const ids = (lvl: string, n: number) => Array.from({ length: n }, (_, i) => `${lvl}-${String(i + 1).padStart(2, '0')}`);

describe('level up', () => {
	const n5 = ids('n5', 10);
	it('waits until 80% of the level is done', () => {
		expect(levelUp({ N5: n5 }, [])).toBeNull();
		expect(levelUp({ N5: n5 }, n5.slice(0, 7))).toBeNull();
		expect(levelUp({ N5: n5 }, n5.slice(0, 8))).toEqual({ from: 'N5', to: 'N4', done: 0.8, ready: false });
	});
	it('says whether the next level has units yet', () => {
		expect(levelUp({ N5: n5, N4: ids('n4', 3) }, n5.slice(0, 9))?.ready).toBe(true);
	});
	it('goes by the hardest level you have started', () => {
		const n4 = ids('n4', 10);
		expect(levelUp({ N5: n5, N4: n4 }, [...n5, n4[0]])).toBeNull();
		expect(levelUp({ N5: n5, N4: n4 }, [...n4.slice(0, 8)])).toEqual({ from: 'N4', to: 'N3', done: 0.8, ready: false });
	});
	it('stops at N1', () => {
		const n1 = ids('n1', 2);
		expect(levelUp({ N1: n1 }, n1)).toBeNull();
	});
});
