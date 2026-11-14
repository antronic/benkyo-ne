import { describe, expect, it } from 'vitest';
import { buildAskStreamPrompt, finishAskText, parseAskText } from './askStream.ts';
import { searchThreads, sectionOf, titleFor, type AskThread } from './threads.ts';

const req = { turns: [{ role: 'user' as const, text: 'hi' }], knownKana: [], secondLang: 'th' };

describe('ask stream format', () => {
	const full = 'は marks the topic.\n\nが marks the subject.\n[[second]]\nคำตอบ\n[[examples]]\n私は学生です | わたしはがくせいです | I am a student.\n- 猫がいる | ねこがいる | There is a cat.\nbad line\n水 | mizu | water';
	it('splits answer, translation and examples', () => {
		const p = parseAskText(full);
		expect(p.answer).toBe('は marks the topic.\n\nが marks the subject.');
		expect(p.answer2).toBe('คำตอบ');
		expect(p.examples).toEqual([
			{ jp: '私は学生です', reading: 'わたしはがくせいです', en: 'I am a student.' },
			{ jp: '猫がいる', reading: 'ねこがいる', en: 'There is a cat.' }
		]);
	});
	it('hides a marker that is still arriving', () => {
		expect(parseAskText('Hello there\n[[sec', true).answer).toBe('Hello there');
		expect(parseAskText('Hello [[ok]] there', true).answer).toBe('Hello [[ok]] there');
		expect(parseAskText('A\n[[second]]\nB\n[[exa', true).answer2).toBe('B');
	});
	it('ignores the unfinished last example while streaming', () => {
		expect(parseAskText('A\n[[examples]]\n猫 | ねこ | cat\n犬 | いぬ', true).examples).toHaveLength(1);
	});
	it('works without sections', () => {
		expect(finishAskText('Just text', { ...req, secondLang: null })).toEqual({ answer: 'Just text', answer2: null, examples: [] });
		expect(finishAskText('  ', req)).toBeNull();
	});
	it('drops the translation when no second language', () => {
		expect(finishAskText('A\n[[second]]\nB', { ...req, secondLang: null })!.answer2).toBeNull();
	});
	it('prompt asks for plain text', () => {
		const p = buildAskStreamPrompt(req);
		expect(p.plain).toBe(true);
		expect(p.user).toContain('Second language: th');
	});
});

describe('threads', () => {
	const t = (id: string, title: string, text: string, updatedAt = 1): AskThread => ({
		id,
		title,
		createdAt: 1,
		updatedAt,
		msgs: [
			{ role: 'user', text: title },
			{ role: 'assistant', text }
		]
	});
	it('titles from the first question', () => {
		expect(titleFor([{ role: 'user', text: '  What is   は? ' }])).toBe('What is は?');
		expect(titleFor([{ role: 'user', text: 'x'.repeat(80) }])).toHaveLength(58);
		expect(titleFor([])).toBe('New chat');
	});
	it('searches titles and messages', () => {
		const list = [t('a', 'Particles', 'は and が'), t('b', 'Greetings', 'Say こんにちは in the day')];
		expect(searchThreads(list, '').map((r) => r.thread.id)).toEqual(['a', 'b']);
		expect(searchThreads(list, 'greet').map((r) => r.thread.id)).toEqual(['b']);
		const hit = searchThreads(list, 'こんにちは');
		expect(hit.map((r) => r.thread.id)).toEqual(['b']);
		expect(hit[0].snippet).toContain('こんにちは');
		expect(searchThreads(list, 'zzz')).toEqual([]);
	});
	it('groups by day', () => {
		const now = new Date(2026, 10, 14, 12).getTime();
		expect(sectionOf(now - 3_600_000, now)).toBe('Today');
		expect(sectionOf(now - 86_400_000, now)).toBe('Yesterday');
		expect(sectionOf(now - 4 * 86_400_000, now)).toBe('Previous 7 Days');
		expect(sectionOf(now - 20 * 86_400_000, now)).toBe('Previous 30 Days');
	});
});
