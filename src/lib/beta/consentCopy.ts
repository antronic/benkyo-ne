/** The beta consent text in the interface language (English unless a translation exists). */
import * as en from './consentText.ts';
import * as th from './consentText.th.ts';
import type { ConsentSection } from './consentText.ts';

export interface ConsentCopy {
	CONSENT_INTRO: string;
	COLLECTED: ConsentSection[];
	NEVER_COLLECTED: string[];
	HOW_USED: string[];
	RETENTION: string[];
	CHOICES: string[];
	CONTACT: string[];
	AGREE_LABEL: string;
}

const COPY: Record<string, ConsentCopy> = { en, th };

export const consentCopy = (locale: string): ConsentCopy => COPY[locale] ?? en;
