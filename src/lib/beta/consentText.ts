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
	'Benkyo is in beta. Taking part means sharing how you use the app, so we can find bugs and make learning better. To keep using your account (AI features and anything else that needs sign-in), please read what we collect and agree.';

export const COLLECTED: ConsentSection[] = [
	{
		icon: '📈',
		title: 'Learning progress',
		summary: 'Every answer you grade, lessons you finish, streaks and daily totals.',
		items: [
			'Which card or lesson, the grade you gave, how long you took',
			'How the scheduler changed the card (due date, stability, difficulty)',
			'A daily summary: number of cards, cards due, lessons done, streak and your learning settings'
		]
	},
	{
		icon: '✨',
		title: 'AI requests and replies',
		summary: 'What you send to AI, the full prompt Benkyo builds, and the model’s answer.',
		items: [
			'The words, questions, topics and Ask AI conversations you send',
			'The full prompt sent to the model and the model’s full reply',
			'Which provider and model, tokens used, cost, time taken, and any error',
			'Pictures you attach are not kept: only their type and size'
		]
	},
	{
		icon: '📱',
		title: 'Device and app details',
		summary: 'Browser, system, screen, and whether you use the installed app or a browser tab.',
		items: [
			'Browser and version (user agent), operating system, device type and model when the browser shares it',
			'Screen and window size, pixel ratio, orientation, light or dark mode, reduced motion',
			'Language and time zone, the country Cloudflare estimates from your connection (not your IP address)',
			'Installed app (Home Screen) or browser tab, app version, network type, storage used'
		]
	},
	{
		icon: '🐞',
		title: 'Errors and app events',
		summary: 'Crashes, failed requests, screens you open and features you use.',
		items: [
			'Error messages and where in the app they happened',
			'Failed requests (which address, status and message, never what you typed into a form)',
			'Screens you open, when the app opens or goes to the background, settings you change'
		]
	}
];

export const NEVER_COLLECTED: string[] = [
	'Your AI API keys. They stay encrypted and are never part of usage data',
	'Your passkey or recovery code',
	'Your email, contacts, photos, exact location, or anything outside Benkyo'
];

export const HOW_USED: string[] = [
	'Only to fix problems and improve Benkyo. Never sold, never used for ads.',
	'Seen only by the Benkyo team. Stored with Cloudflare, which may keep it outside your country.',
	'Your AI provider still receives your AI requests, as it does today.',
	'Key-like text (for example something that looks like an API key) is removed automatically before it is saved.'
];

export const RETENTION: string[] = [
	`Usage data is deleted automatically ${RETENTION_DAYS} days after it’s collected.`,
	'Your record of agreeing is kept as long as your account exists, including after you delete it.',
	`Deleting your account closes it rather than erasing it. Your usage data is kept, and is still deleted ${RETENTION_DAYS} days after it’s collected.`,
	'To remove your usage data sooner, delete it in Settings › Beta data before you delete your account, or email us (below) to have your closed account erased.'
];

export const CHOICES: string[] = [
	'In Settings › Beta data you can download your data or delete it at any time.',
	'You can withdraw your agreement there too. Collection stops and your usage data is deleted. Account features stay locked until you agree again; learning offline on this device keeps working.'
];

/** Who is responsible for the data (APPI: business operator; GDPR: controller) and how to reach them. */
export const OPERATOR = { name: 'Jirachai Chansivanon', email: 'jirachai.c@outlook.com' };

export const CONTACT: string[] = [
	`Benkyo is run by ${OPERATOR.name}, who is responsible for this data.`,
	`Questions, or a request to see, correct or delete your data: ${OPERATOR.email}.`
];

export const AGREE_LABEL = 'I’ve read this and agree to share my usage data as described, to take part in the beta.';
