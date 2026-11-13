import { KANA, type Kana, type Script } from './kana.ts';

export interface Lesson {
	id: string;
	script: Script;
	title: string;
	subtitle: string;
	chars: Kana[];
	/** Short teaching note shown on the intro screen. */
	note?: string;
	/** Hue for the lesson's gradient (0–360). */
	hue: number;
}

const DEFS: [row: string, title: string, note?: string][] = [
	['a', 'Vowels', 'Every Japanese syllable ends in one of these five sounds. Learn them first.'],
	['k', 'K-row'],
	['s', 'S-row', 'し is read “shi”, not “si”.'],
	['t', 'T-row', 'ち is “chi” and つ is “tsu”: the row has two irregulars.'],
	['n', 'N-row'],
	['h', 'H-row', 'ふ sits between “hu” and “fu”: blow gently through your lips.'],
	['m', 'M-row'],
	['y', 'Y-row + W-row + ん', 'を is read “o” and is only used as a particle.'],
	['r', 'R-row', 'The Japanese r is a light tap, halfway to an l.'],
	['g', 'G-row: dakuten ゛', 'Two small strokes (゛) make a consonant voiced: か → が.'],
	['z', 'Z-row'],
	['d', 'D-row', 'ぢ and づ are rare. In most words you will see じ and ず.'],
	['b', 'B-row'],
	['p', 'P-row: handakuten ゜', 'A small circle (゜) turns h into p: は → ぱ.']
];

const groups: Record<string, string[]> = { y: ['y', 'w', 'nn'] };

export const LESSONS: Lesson[] = [];

for (const script of ['hiragana', 'katakana'] as const) {
	DEFS.forEach(([row, title, note], i) => {
		const rows = groups[row] ?? [row];
		const chars = KANA.filter((k) => k.script === script && rows.includes(k.row));
		LESSONS.push({
			id: `${script[0]}${i + 1}`,
			script,
			title,
			subtitle: chars.map((c) => c.char).join(' '),
			chars,
			note:
				script === 'katakana' && i === 0
					? 'Katakana is for loanwords and emphasis. Same sounds as hiragana, sharper shapes.'
					: note,
			hue: (script === 'hiragana' ? 8 : 220) + i * 11
		});
	});
}

export const lessonById = new Map(LESSONS.map((l) => [l.id, l]));

/** Card ids: one recognition card per kana for v0.1. */
export const cardId = (k: Kana) => `kana:${k.char}`;
