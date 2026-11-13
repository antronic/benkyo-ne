/**
 * Shared contract between the PWA and the Worker for AI features
 * (docs/AI-PLAN.md). Imported by both sides; keep it dependency-free.
 */

export type ProviderKind = 'anthropic' | 'openai-compatible';

/** Features that each pick their own model (D13/D14). */
export type Feature = 'fill' | 'propose' | 'vision';

/** Bilingual text: English plus the optional second language (D22). */
export interface Bi {
	en: string;
	second: string | null;
}

// ---------------------------------------------------------------- auth ----

export interface Me {
	signedIn: boolean;
	/** True once a passkey exists; registration then needs a session. */
	registered: boolean;
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
	error: 'unauthorized' | 'cap_reached' | 'rate_limited' | 'no_model' | 'no_price' | 'provider' | 'invalid_output' | 'bad_request';
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
