/**
 * Shared contract between the PWA and the Worker for AI features
 * (docs/AI-PLAN.md). Imported by both sides; keep it dependency-free.
 */

import type { BetaStatus } from '../beta/contract.ts';
import type { Person } from '../avatar/person.ts';

export type ProviderKind = 'anthropic' | 'openai-compatible';

/** Features that each pick their own model (D13/D14). */
export type Feature = 'fill' | 'propose' | 'vision' | 'translate';

/** Bilingual text: English plus the optional second language (D22). */
export interface Bi {
	en: string;
	second: string | null;
}

// ---------------------------------------------------------------- auth ----

export interface Me {
	signedIn: boolean;
	account: {
		id: number;
		name: string;
		isAdmin: boolean;
		/** signed in with a recovery code: add a passkey before anything else */
		recovery: boolean;
		/** how this session signed in */
		via: 'passkey' | 'recovery' | 'apple' | 'dev';
		/** an Apple ID is connected to this account */
		appleLinked: boolean;
		/** the avatar's parts (only the changes from the defaults), or null for none (docs/AVATAR.md) */
		avatar?: Partial<Person> | null;
		/** the one-time "Make your avatar" prompt was answered (saved, or "Not now") */
		avatarAsked?: boolean;
	} | null;
	/** anyone can create an account (passkey or Apple) */
	signupOpen: boolean;
	/** sign-ups are invite-only: a passkey account can be created with an invite code */
	signupInvite?: boolean;
	/** Sign in with Apple is configured on the server */
	appleEnabled: boolean;
	/** beta consent for the signed-in account (GET /api/auth/me only; see src/lib/beta/contract.ts) */
	beta?: BetaStatus | null;
}

export interface PasskeyInfo {
	id: string;
	name: string | null;
	deviceType: string | null;
	backedUp: boolean;
	createdAt: number;
	lastUsedAt: number | null;
	/** the passkey this session signed in with */
	current: boolean;
}

// ----------------------------------------------------------- credentials ----

export interface CredentialInfo {
	id: number;
	provider: ProviderKind;
	label: string;
	baseUrl: string | null;
	last4: string;
	createdAt: number;
}

export interface CredentialInput {
	provider: ProviderKind;
	label: string;
	/** Required for openai-compatible (e.g. https://openrouter.ai/api/v1). */
	baseUrl?: string;
	apiKey: string;
}

// ---------------------------------------------------------------- models ----

export interface Price {
	inputPerM: number;
	outputPerM: number;
}

export type PriceSource = 'provider' | 'builtin' | 'manual';

export interface ModelInfo {
	id: string;
	label: string;
	provider: ProviderKind;
	/** credential id for Worker-proxied models; 0 for browser-direct local models */
	credentialId: number;
	contextTokens: number | null;
	maxOutput: number | null;
	/** null = provider didn't say */
	vision: boolean | null;
	structured: boolean | null;
	price: Price | null;
	priceSource: PriceSource | null;
}

export interface FeatureModel {
	feature: Feature;
	credentialId: number;
	model: string;
}

export interface Usage {
	month: string; // YYYY-MM (UTC)
	spentUsd: number;
	capUsd: number;
	calls: number;
}

// ------------------------------------------------------------ managed AI ----

/** Whose AI a call runs on: the learner's own key, or the package's (the operator's keys). */
export type AiSource = 'own' | 'package';

/**
 * GET /api/ai/managed: the package's AI for the signed-in account.
 * Provider keys never appear here; only package, model names and allowance.
 */
export interface ManagedAi {
	/** the live paid package with AI, null on Free or a package without AI */
	plan: { id: string; name: string; endsAt: number | null } | null;
	/** what each feature runs on under the package (only features it covers) */
	models: { feature: Feature; label: string; model: string }[];
	/** which AI each feature runs on now (with "My own key", a feature their key can't do still uses the package) */
	byFeature: { feature: Feature; source: AiSource | null }[];
	month: string; // YYYY-MM (UTC)
	allowanceUsd: number;
	spentUsd: number;
	calls: number;
	/** first moment of next month (UTC): when the allowance starts again */
	resetsAt: number;
	/** which AI the learner prefers when both exist */
	prefer: AiSource;
	/** the AI in use now: the preferred one when any feature uses it, else the other; null: none */
	active: AiSource | null;
	/** the package AI can't be used right now, and why */
	blocked: 'allowance' | null;
	/** the latest package that ended in the last 30 days, while there's no live one */
	ended: { name: string; endedAt: number } | null;
}

// ------------------------------------------------------- card generation ----

export type CardKind = 'word' | 'phrase';

/**
 * propose: turn free input into candidate items.
 *   english    → `candidates` (from the dictionary) are ranked & explained
 *   scenario   → the model proposes 6–10 useful words/phrases
 *   screenshot → the model extracts words/phrases from `image`
 */
export interface ProposeRequest {
	mode: 'english' | 'scenario' | 'screenshot';
	input: string;
	image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; base64: string };
	candidates?: { text: string; reading: string; gloss: string }[];
	secondLang: string | null;
}

export interface ProposedItem {
	/** Japanese as written (may contain kanji) */
	text: string;
	/** reading in hiragana/katakana */
	reading: string;
	kind: CardKind;
	/** short English gloss */
	gloss: string;
	/** why this one / how it differs from the alternatives */
	note: Bi | null;
}

export interface ProposeResponse {
	items: ProposedItem[];
	/** scenario/screenshot: a short suggested pack name (used as the cards' tag) */
	packName: Bi | null;
}

// ---------------------------------------------------------- lesson pack ----

/** "Make a new lesson pack": the AI designs a unit around a topic. */
export interface LessonRequest {
	topic: string;
	knownKana: string[];
	secondLang: string | null;
}

export interface LessonResponse {
	title: Bi;
	blurb: Bi;
	items: ProposedItem[];
}

// ---------------------------------------------------------------- ask AI ----

export interface AskTurn {
	role: 'user' | 'assistant';
	text: string;
}

export interface AskRequest {
	/** the conversation so far, oldest first; the last turn is the question */
	turns: AskTurn[];
	knownKana: string[];
	secondLang: string | null;
}

export interface AskResponse {
	answer: string;
	/** the same answer in the second language, when set */
	answer2: string | null;
	/** Japanese examples mentioned in the answer */
	examples: { jp: string; reading: string; en: string }[];
}

// ------------------------------------------------------------- translate ----

/** Languages a community note or reply is written in or translated into. */
export type TranslateLang = 'en' | 'th' | 'ja';

/** POST /api/ai/translate: the Worker reads the text itself, so only ids travel. */
export interface TranslateRequest {
	kind: 'post' | 'reply';
	id: number;
	to: TranslateLang;
}

/** What the prompt is built from, after the Worker loaded the text. */
export interface TranslateSource {
	text: string;
	from: TranslateLang;
	to: TranslateLang;
}

export interface TranslateResponse {
	text: string;
	to: TranslateLang;
}

/**
 * fill: write the learning content for verified items. Used by the card maker
 * and by "Words you can read" packs (`theme: true`).
 */
export interface FillRequest {
	items: { key: string; text: string; reading: string; kind: CardKind; gloss: string }[];
	/** kana the learner can read; examples must only use these (+ kanji shown with reading) */
	knownKana: string[];
	allowExamples: boolean;
	secondLang: string | null;
	theme: boolean;
}

export interface FilledItem {
	key: string;
	/** gloss in the second language, translated from the English gloss */
	gloss2: string | null;
	hook: Bi;
	/** phrases: when to say it */
	usage: Bi | null;
	/** words: one sentence; phrases: a two-line mini dialogue joined with "\n" */
	example: { jp: string; reading: string; en: string; second: string | null } | null;
}

export interface FillResponse {
	theme: Bi | null;
	items: FilledItem[];
}

export interface AiError {
	error:
		| 'unauthorized'
		| 'consent_required'
		| 'cap_reached'
		/** the package's monthly AI allowance is used up (and there's no own key to fall back on) */
		| 'allowance_reached'
		/** the package that gave managed AI has ended (and there's no own key) */
		| 'package_ended'
		| 'rate_limited' | 'no_model' | 'no_price' | 'provider' | 'invalid_output' | 'bad_request';
	message: string;
}

// ------------------------------------------------------- user cards sync ----

/** Card content for word/phrase cards (scheduling stays in the review log). */
export interface UserCard {
	id: string; // word:<jmdict id> | word:custom:<uuid> | phrase:<jmdict id> | phrase:custom:<uuid>
	kind: CardKind;
	front: string; // kana reading shown on the front (D17)
	kanji: string | null; // written form shown on the back
	gloss: string;
	gloss2: string | null;
	usage: Bi | null;
	hook: Bi | null;
	example: FilledItem['example'];
	verified: boolean;
	source: 'user' | 'pack' | 'scenario';
	tags: string[];
	createdAt: number;
	updatedAt: number;
	deleted: boolean;
}
