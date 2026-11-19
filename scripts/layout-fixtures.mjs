/**
 * Synthetic Fleet console data for scripts/check-layout.mjs, so screens that
 * only show their real layout signed in (lists, forms, the model picker) are
 * checked too. Made-up names and numbers only; never real learner data.
 */
const now = Date.UTC(2026, 10, 19, 12);
const D = 86_400_000;

const plan = (id, name, month, year, allowance, accounts, extra = {}) => ({
	id,
	name,
	priceMonthUsd: month,
	priceYearUsd: year,
	aiAllowanceUsd: allowance,
	blurb: `${name}: example package for the layout check.`,
	available: true,
	accounts,
	updatedAt: now - 2 * D,
	builtin: ['free', 'plus', 'pro'].includes(id),
	models: [],
	...extra
});
const pm = (providerId, model, label, features, inputPerM, outputPerM) => ({ providerId, providerLabel: 'Anthropic (main)', model, label, features, inputPerM, outputPerM });

const providers = {
	providers: [
		{ id: 1, kind: 'anthropic', preset: 'anthropic', label: 'Anthropic (main)', baseUrl: null, last4: 'a1b2', enabled: true, modelCount: 9, checkedAt: now - 3600_000, checkError: null, createdAt: now - 9 * D, updatedAt: now - D, usedBy: ['Plus', 'Pro'] },
		{ id: 2, kind: 'openai', preset: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', last4: 'z9y8', enabled: false, modelCount: 312, checkedAt: now - 2 * D, checkError: 'The key was refused (401). Replace it.', createdAt: now - 5 * D, updatedAt: now - 2 * D, usedBy: [] }
	],
	presets: [
		{ id: 'anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: null, keysUrl: 'https://console.anthropic.com/settings/keys' },
		{ id: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', keysUrl: 'https://openrouter.ai/keys' },
		{ id: 'custom', name: 'Other (OpenAI-compatible)', kind: 'openai', baseUrl: null, keysUrl: null }
	],
	canSaveKeys: true
};
const model = (id, label, ctx, vision, inP, outP, inPackages = []) => ({ providerId: 1, id, label, contextTokens: ctx, maxOutput: 8192, vision, structured: true, inputPerM: inP, outputPerM: outP, priceSource: 'builtin', inPackages });
const models = {
	models: [
		model('example-large-1', 'Example Large', 200_000, true, 3, 15, ['Pro']),
		model('example-small-1', 'Example Small', 200_000, true, 0.8, 4, ['Plus']),
		model('example-mini-1', 'Example Mini with a long display name to wrap', 128_000, false, 0.25, 1.25)
	],
	fetchedAt: now - 1800_000,
	providers: [{ id: 1, label: 'Anthropic (main)' }],
	errors: []
};
const packages = {
	plans: [
		plan('free', 'Free', 0, 0, 0, 7),
		plan('plus', 'Plus', 3.99, 39, 2, 2, { models: [pm(1, 'example-small-1', 'Example Small', ['fill', 'propose', 'vision'], 0.8, 4)] }),
		plan('pro', 'Pro', 8.99, 89, 6, 1, { available: false, models: [pm(1, 'example-large-1', 'Example Large', ['fill', 'propose'], 3, 15), pm(1, 'example-small-1', 'Example Small', ['vision'], 0.8, 4)] })
	],
	grants: [{ id: 1, accountId: 3, accountName: 'Example Learner', plan: 'plus', kind: 'trial', note: 'Beta tester', startsAt: now - 6 * D, endsAt: now + 9 * D, createdAt: now - 6 * D, endedAt: null, live: true }]
};
const promo = (code, state, extra = {}) => ({ code, label: 'Example batch', plan: 'plus', kind: 'trial', days: 30, maxUses: 50, uses: 12, expiresAt: now + 20 * D, disabledAt: null, createdAt: now - 4 * D, state, ...extra });
const promos = {
	promos: [promo('WELCOME30', 'live'), promo('K7Q2M9XPRT', 'disabled', { label: null, plan: 'pro', kind: 'comp', days: null, maxUses: null, disabledAt: now - D }), promo('OLDCODE26', 'expired', { expiresAt: now - D })],
	plans: [
		{ id: 'plus', name: 'Plus' },
		{ id: 'pro', name: 'Pro' }
	]
};
const account = {
	id: 3,
	name: 'Example Learner',
	createdAt: now - 30 * D,
	lastSeenAt: now - 3600_000,
	isAdmin: false,
	disabled: false,
	capUsd: 5,
	passkeys: 1,
	appleLinked: false,
	monthUsd: 0.42,
	consented: true,
	plan: 'plus',
	passkeyList: [{ id: 'pk1', name: 'Example phone', deviceType: 'multiDevice', createdAt: now - 30 * D, lastUsedAt: now - 3600_000 }],
	sessions: [{ kind: 'passkey', createdAt: now - D, expiresAt: now + 29 * D }],
	recoveryCode: 'unused',
	spendByModel: [{ feature: 'fill', provider: 'anthropic', model: 'example-small-1', calls: 12, usd: 0.42 }],
	recentCalls: [{ at: now - 3600_000, feature: 'fill', model: 'example-small-1', status: 'ok', usd: 0.03 }],
	consent: { version: 1, acceptedAt: now - 30 * D, withdrawnAt: null },
	grants: [{ ...packages.grants[0] }]
};

const community = {
	stats: { posts7d: 14, replies7d: 31, openReports: 2, hidden: 1, profiles: 22 },
	queue: [
		{
			kind: 'post', id: 7, postId: 7, subject: 'kanji:日', label: '日', body: 'Buy cheap followers at example dot com, best prices every day', status: 'hidden', createdAt: now - D,
			author: { accountId: 4, handle: 'sample_seller', status: 'active', posts: 3, removed: 1, disabled: false },
			reports: [{ reason: 'spam', detail: '', at: now - D }, { reason: 'spam', detail: 'Same ad on three words', at: now - D / 2 }, { reason: 'other', detail: '', at: now - D / 4 }],
			openReports: 3, firstReportAt: now - D
		},
		{
			kind: 'reply', id: 12, postId: 3, subject: 'word:1358280', label: '食べる', body: 'That is not how this verb works at all.', status: 'published', createdAt: now - 2 * D,
			author: { accountId: 5, handle: 'example_learner', status: 'muted', posts: 9, removed: 0, disabled: false },
			reports: [{ reason: 'wrong', detail: 'It is right, the reply is wrong', at: now - D }],
			openReports: 1, firstReportAt: now - D
		}
	]
};

/** API path → JSON body for the signed-in Fleet pass. */
export const FLEET_FIXTURES = {
	'/api/admin/ai/providers': providers,
	'/api/admin/ai/providers/1/models': models,
	'/api/admin/ai/models': models,
	'/api/admin/packages': packages,
	'/api/admin/promos': promos,
	'/api/admin/accounts': { accounts: [{ ...account, passkeyList: undefined }], next: null },
	'/api/admin/accounts/3': account,
	'/api/admin/community': community,
	'/api/admin/promos/WELCOME30': { ...promos.promos[0], redemptions: [{ accountId: 3, accountName: 'Example Learner', redeemedAt: now - D, grantId: 1, live: true }] }
};

/**
 * Fleet screens checked with data. `open` lists button texts to press first,
 * so forms and pickers that start closed are checked open.
 */
export const FLEET_SCREENS = [
	{ path: '/admin/ai', open: [] },
	{ path: '/admin/ai', open: ['Replace key'], label: 'replace key' },
	{ path: '/admin/ai/1', open: [] },
	{ path: '/admin/packages', open: [] },
	{ path: '/admin/packages', open: ['Edit'], label: 'edit form' },
	{ path: '/admin/packages', open: ['＋ New package'], label: 'new package form' },
	{ path: '/admin/packages', open: ['Change'], label: 'model picker' },
	{ path: '/admin/promos', open: [] },
	{ path: '/admin/community', open: [] },
	{ path: '/admin/accounts/3', open: [] }
];

/**
 * A sample URL for each dynamic Fleet route, for the navigation (flow) pass.
 * A new dynamic page under src/routes/admin needs an entry here and fixtures above.
 */
export const FLEET_SAMPLES = {
	'/admin/accounts/[id]': '/admin/accounts/3',
	'/admin/ai/[id]': '/admin/ai/1'
};
