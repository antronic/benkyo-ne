import { describe, expect, it } from 'vitest';
import * as en from './consentText.ts';
import * as th from './consentText.th.ts';
import { OPERATOR } from './consentText.ts';
import { RETENTION_DAYS } from './contract.ts';

describe('Thai beta consent text', () => {
	it('has the same sections and points as English', () => {
		expect(th.COLLECTED.map((s) => [s.icon, s.items.length])).toEqual(en.COLLECTED.map((s) => [s.icon, s.items.length]));
		for (const k of ['NEVER_COLLECTED', 'GOOD_TO_KNOW', 'CONTACT'] as const) expect(th[k].length, k).toBe(en[k].length);
	});
	it('names the same operator, contact and retention period', () => {
		expect(th.CONTACT.join(' ')).toContain(OPERATOR.name);
		expect(th.CONTACT[1]).toContain(OPERATOR.email);
		expect(th.GOOD_TO_KNOW[1]).toContain(String(RETENTION_DAYS));
		expect(en.GOOD_TO_KNOW[1]).toContain(String(RETENTION_DAYS));
	});
});
