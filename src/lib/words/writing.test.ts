import { describe, expect, it } from 'vitest';
import { markChanges, politeGap } from './writing.ts';

const why = { en: 'x', second: null };

describe('markChanges', () => {
	it('strikes out the old text and inserts the new, in place', () => {
		const text = '部長\n資料を送ります。\n見てください。';
		const parts = markChanges(text, [
			{ from: '送ります', to: 'お送りします', why },
			{ from: '見てください', to: 'ご確認いただけますと幸いです', why }
		]);
		expect(parts).toEqual([
			{ text: '部長\n資料を' },
			{ text: '送ります', kind: 'del' },
			{ text: 'お送りします', kind: 'add' },
			{ text: '。\n' },
			{ text: '見てください', kind: 'del' },
			{ text: 'ご確認いただけますと幸いです', kind: 'add' },
			{ text: '。' }
		]);
		// reading only the plain and struck parts gives back the message
		expect(parts.filter((p) => p.kind !== 'add').map((p) => p.text).join('')).toBe(text);
	});

	it('shows an addition next to the text it was anchored on', () => {
		expect(markChanges('部長\n明日', [{ from: '部長\n', to: '部長\nお疲れ様です。\n', why }])).toEqual([
			{ text: '部長\n' },
			{ text: 'お疲れ様です。\n', kind: 'add' },
			{ text: '明日' }
		]);
	});

	it('skips a change it cannot place', () => {
		expect(markChanges('よろしく', [{ from: 'ありがとう', to: 'ありがとうございます', why }])).toEqual([{ text: 'よろしく' }]);
	});
});

describe('politeGap', () => {
	it('names the gap', () => {
		expect(politeGap(0.2, 0.78, false)).toBe('tooCasual');
		expect(politeGap(0.95, 0.1, false)).toBe('tooFormal');
		expect(politeGap(0.7, 0.78, false)).toBe('fits');
		expect(politeGap(0.2, 0.78, true)).toBe('fits');
	});
});
