import { describe, expect, it } from 'vitest';
import { greetName, greetingFor } from './greeting.ts';

describe('greetingFor', () => {
	it('picks the greeting by local hour', () => {
		expect(greetingFor(7).key).toBe('home.morning');
		expect(greetingFor(10).key).toBe('home.morning');
		expect(greetingFor(11).key).toBe('home.afternoon');
		expect(greetingFor(17).key).toBe('home.afternoon');
		expect(greetingFor(18).key).toBe('home.evening');
		expect(greetingFor(23).key).toBe('home.evening');
	});
	it('says good evening, not good morning, in the small hours', () => {
		expect(greetingFor(1)).toEqual({ jp: 'こんばんは', key: 'home.evening' });
		expect(greetingFor(4).key).toBe('home.morning');
	});
});

describe('greetName', () => {
	it('uses the first word of the name', () => {
		expect(greetName('Jirachai Chansivanon')).toBe('Jirachai');
		expect(greetName('  Job ')).toBe('Job');
		expect(greetName('สมชาย ใจดี')).toBe('สมชาย');
	});
	it('falls back to nothing without a name', () => {
		expect(greetName('')).toBe('');
		expect(greetName(null)).toBe('');
		expect(greetName(undefined)).toBe('');
	});
	it('shortens a very long name', () => {
		expect(greetName('a'.repeat(30))).toBe('a'.repeat(19) + '…');
	});
});
