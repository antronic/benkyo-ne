import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCALE, lintText, tokenFor } from '../../../scripts/check-spacing.mjs';

describe('spacing lint (scripts/check-spacing.mjs)', () => {
	it('uses the same scale as tokens.css', () => {
		const css = readFileSync('src/lib/design/tokens.css', 'utf8');
		for (const [px, name] of SCALE) {
			expect(css, name).toMatch(new RegExp(`${name}:\\s*${px}px;`));
		}
	});

	it('flags hard-coded padding, margin and gap', () => {
		const { problems } = lintText('.card {\n\tpadding: 14px 16px;\n\tmargin-top: 5px;\n\tgap: 8px;\n}', 'x.css');
		expect(problems.map((p) => `${p.line}:${p.value}`)).toEqual(['2:14px', '2:16px', '3:5px', '4:8px']);
	});

	it('flags Svelte style directives and the stack --gap', () => {
		const { problems } = lintText('<main class="page stack" style:--gap="18px"><span style:margin-top="4px"></span></main>', 'x.svelte');
		expect(problems).toHaveLength(2);
	});

	it('allows tokens, zero, hairlines and ui-ok lines', () => {
		const src = [
			'a { padding: var(--space-4) 0; }',
			'b { margin: 0 auto; border-top: 0.5px solid; padding-top: 1px; }',
			'c { margin: -30px; /* ui-ok: centres the orb */ }',
			'd { width: 120px; top: 8px; }'
		].join('\n');
		expect(lintText(src, 'x.css').problems).toEqual([]);
	});

	it('fixes values to the nearest token, rounding ties up', () => {
		expect(lintText('a { padding: 10px 14px; margin: -8px; }', 'x.css').fixed).toBe(
			'a { padding: var(--space-3) var(--space-4); margin: calc(-1 * var(--space-2)); }'
		);
		expect(tokenFor(3)?.[0]).toBe(4);
		expect(tokenFor(18)?.[0]).toBe(20);
		expect(tokenFor(96)).toBeNull();
	});
});
