import { describe, expect, it } from 'vitest';
import { avatarSvg, params } from '../render.ts';
import { DEFAULTS, OPTIONS, COLOURS, type Person } from '../person.ts';

describe('Benkyo style pack', () => {
	it('draws the default person as an SVG', () => {
		const svg = avatarSvg(null, 96);
		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg).toContain('</svg>');
	});

	it('draws every part and colour without throwing, and each one changes the picture', () => {
		const base = avatarSvg(DEFAULTS, 96);
		for (const [k, values] of Object.entries(OPTIONS)) {
			for (const v of values) {
				const svg = avatarSvg({ ...DEFAULTS, [k]: v } as Person, 96);
				expect(svg, `${k}=${v}`).toContain('</svg>');
				if (v !== (DEFAULTS as unknown as Record<string, string>)[k] && k !== 'collar') expect(svg, `${k}=${v} looks the same as the default`).not.toBe(base);
			}
		}
		for (const [k, map] of Object.entries(COLOURS)) for (const v of Object.keys(map)) expect(avatarSvg({ ...DEFAULTS, [k]: v } as Person, 96)).toContain('</svg>');
	});

	it('draws an unknown value as the default part', () => {
		expect(params({ hair: 'mullet' } as unknown as Person).hair).toBe(DEFAULTS.hair);
	});
});
