import { describe, expect, it } from 'vitest';
import { withoutImages } from './routes.ts';

describe('withoutImages', () => {
	it('replaces base64 image payloads with their size', () => {
		const req = { text: 'hi', image: { mediaType: 'image/png', base64: 'A'.repeat(400) } };
		expect(withoutImages(req)).toEqual({ text: 'hi', image: { mediaType: 'image/png', bytes: 300, stored: false } });
	});
	it('leaves other values alone', () => {
		expect(withoutImages({ a: [1, { b: 'c' }] })).toEqual({ a: [1, { b: 'c' }] });
		expect(withoutImages('x')).toBe('x');
	});
});
