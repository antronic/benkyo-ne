/**
 * The beta consent text, version CONSENT_VERSION (./contract.ts). Change this
 * wording and bump the version together, so everyone is asked again.
 * docs/BETA-DATA.md mirrors it for reviewers.
 */
import { RETENTION_DAYS } from './contract.ts';

export interface ConsentSection {
	icon: string;
	title: string;
	summary: string;
	items: string[];
}

export const CONSENT_INTRO =
	'Benkyo is in beta. To use your account, please agree to share how you use the app, so we can fix bugs and make learning better.';

export const COLLECTED: ConsentSection[] = [
	{
		icon: '📈',
		title: 'Learning progress',
		summary: 'Your answers, lessons and streaks.',
		items: [
			'Each card or lesson, the grade you gave and how long you took',
			'How the scheduler changed the card, and a daily summary with your learning settings'
		]
	},
	{
		icon: '✨',
		title: 'AI requests and replies',
		summary: 'What you ask AI and what it answers.',
		items: [
			'Your words, questions and chats, the full prompt Benkyo builds and the full reply. Your AI provider receives them as before',
			'Provider, model, tokens, cost, time and errors. Pictures you attach are not kept, only their type and size'
		]
	},
	{
		icon: '📱',
		title: 'Device and app',
		summary: 'Browser, screen, language and app version.',
		items: [
			'Browser, system and device model when the browser shares it, screen size, light or dark mode',
			'Language, time zone, the country Cloudflare estimates (never your IP address), installed app or browser tab, network type, storage used'
		]
	},
	{
		icon: '🐞',
		title: 'Errors and app events',
		summary: 'Crashes, failed requests and screens you open.',
		items: [
			'Error messages and failed requests, never what you typed into a form',
			'Screens you open, settings you change, and the avatar parts you save. Never the photo'
		]
	}
];

export const NEVER_COLLECTED: string[] = ['Your API keys, passkey, recovery code, selfie, or anything outside Benkyo'];

export const GOOD_TO_KNOW: string[] = [
	'Used only to fix and improve Benkyo. Never sold, never used for ads. Stored with Cloudflare, possibly outside your country.',
	`Usage data is deleted after ${RETENTION_DAYS} days. Deleting your account closes it and keeps the data until then.`,
	'Download, delete or withdraw any time in Settings › Beta data. Learning offline always keeps working.'
];

/** Who is responsible for the data (APPI: business operator; GDPR: controller) and how to reach them. */
export const OPERATOR = { name: 'Jirachai Chansivanon', email: 'jirachai.c@outlook.com' };

export const CONTACT: string[] = [`Benkyo is run by ${OPERATOR.name}.`, `Questions or data requests: ${OPERATOR.email}`];

export const AGREE_LABEL = 'I agree to share my usage data as described, to take part in the beta.';
