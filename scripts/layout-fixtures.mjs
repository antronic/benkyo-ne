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
	aiCredits: allowance * 1000,
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
	grants: [{ id: 1, accountId: 3, accountName: 'Example Learner', plan: 'plus', kind: 'trial', note: 'Beta tester', startsAt: now - 6 * D, endsAt: now + 9 * D, createdAt: now - 6 * D, endedAt: null, live: true }],
	rates: [
		{ providerId: 1, providerLabel: 'Anthropic (main)', model: 'example-small-1', label: 'Example Small', inputPerM: 0.8, outputPerM: 4, packages: ['Plus', 'Pro'], rate: { unit: 1000, inputCredits: 1, outputCredits: 5 }, updatedAt: now - D },
		{ providerId: 1, providerLabel: 'Anthropic (main)', model: 'example-large-1', label: 'Example Large', inputPerM: 3, outputPerM: 15, packages: ['Pro'], rate: null, updatedAt: null }
	],
	creditsPerUsd: 1000
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

const feedback = {
	up: 41, down: 6, open: 2,
	subjects: [
		{ subject: 'grammar:n5-16-te-kudasai', label: '〜てください', up: 3, down: 2, open: 1 },
		{ subject: 'word:1358280', label: '食べる', up: 5, down: 1, open: 1 },
		{ subject: 'unit:n5-01', label: 'Greetings', up: 12, down: 0, open: 0 }
	],
	reports: [
		{ id: 1, subject: 'grammar:n5-16-te-kudasai', label: '〜てください', reason: 'translation', detail: 'The Thai example says the opposite of the Japanese one, I think it should be กรุณา', locale: 'th', createdAt: now - D },
		{ id: 2, subject: 'word:1358280', label: '食べる', reason: 'audio', detail: '', locale: 'en', createdAt: now - D / 2 }
	]
};

const INK = { aspect: 2.4, strokes: [[[0.1, 0.5, 0], [0.3, 0.3, 120], [0.5, 0.6, 240], [0.7, 0.3, 360], [0.9, 0.5, 480]]] };
const invites = {
	invites: [
		{ code: 'VIP', label: 'Friends from the meetup', maxUses: 50, uses: 12, expiresAt: null, createdAt: now - 3 * D, revokedAt: null, coupon: 'WELCOME30', couponUses: 12, couponMaxUses: 100, usedUp: null, card: { note: 'Saved you a seat. Start with kana, I’ll check in on Friday.', from: 'Job', ink: INK } },
		{ code: 'NEWYEAR27', label: null, maxUses: 100, uses: 0, expiresAt: now + 30 * D, createdAt: now - D, revokedAt: null, coupon: null, couponUses: null, couponMaxUses: null, usedUp: null, card: { note: 'Happy new year. Ten minutes a day.', from: 'Job', ink: null } },
		{ code: 'MEETUP_26', label: 'Bangkok meetup', maxUses: 30, uses: 10, expiresAt: null, createdAt: now - 2 * D, revokedAt: null, coupon: 'MEETUP10', couponUses: 10, couponMaxUses: 10, usedUp: 'coupon', card: { note: 'Thanks for coming. A month of Plus, on me.', from: 'Job', ink: null } },
		{ code: 'BK-7KQ2-MX9D', label: 'Example Learner', maxUses: 1, uses: 0, expiresAt: now + 14 * D, createdAt: now - D, revokedAt: null, coupon: null, couponUses: null, couponMaxUses: null, usedUp: null, card: null },
		{ code: 'BK-OLD0-CODE', label: null, maxUses: 1, uses: 1, expiresAt: null, createdAt: now - 20 * D, revokedAt: null, coupon: null, couponUses: null, couponMaxUses: null, usedUp: 'invite', card: null }
	]
};

const BUILD = '1795157326824';
const errorEvents = [
	{ id: 7, at: now - D / 24, accountId: 3, accountName: 'Example Learner', name: 'kit', route: '/admin/packages', build: BUILD, country: 'TH', errorId: 'E-7F3K2Q', message: "Cannot read properties of undefined (reading 'creditsPerUsd')", status: 500, requestId: null, hasNote: true },
	{ id: 6, at: now - D / 12, accountId: 3, accountName: 'Example Learner', name: 'api_error', route: '/admin/packages', build: BUILD, country: 'TH', errorId: 'E-R2D2C3', message: 'PUT /api/admin/credit-rates answered 500', status: 500, requestId: '8f1a2b3c4d5e6f70', hasNote: false },
	{ id: 5, at: now - D, accountId: 5, accountName: 'Another Learner', name: 'unhandled_rejection', route: '/learn/level/n5-01', build: '1795070926824', country: 'JP', errorId: 'E-0Q9W8E', message: 'The operation was aborted because it took too long to open saved progress on this very slow device', status: null, requestId: null, hasNote: false }
];
const errors = {
	days: 7, total: 3, next: null, builds: [BUILD, '1795070926824'],
	groups: [
		{ name: 'kit', message: errorEvents[0].message, count: 4, accounts: 2, firstAt: now - 2 * D, lastAt: errorEvents[0].at, lastBuild: BUILD },
		{ name: 'api_error', message: errorEvents[1].message, count: 1, accounts: 1, firstAt: errorEvents[1].at, lastAt: errorEvents[1].at, lastBuild: BUILD },
		{ name: 'unhandled_rejection', message: errorEvents[2].message, count: 1, accounts: 1, firstAt: errorEvents[2].at, lastAt: errorEvents[2].at, lastBuild: '1795070926824' }
	],
	events: errorEvents
};
const errorDetail = {
	event: errorEvents[0],
	type: 'TypeError',
	stack: "TypeError: Cannot read properties of undefined (reading 'creditsPerUsd')\n    at rateFor (https://benkyo.jirachai.me/_app/immutable/nodes/23.BxQk1.js:1:2405)\n    at Array.map (<anonymous>)",
	breadcrumbs: [
		{ at: now - D / 24 - 9000, kind: 'nav', text: '/admin' },
		{ at: now - D / 24 - 6000, kind: 'nav', text: '/admin/packages' },
		{ at: now - D / 24 - 5800, kind: 'api', text: 'GET /api/admin/packages → 200 in 182 ms (8f1a2b3c4d5e6f6f)' },
		{ at: now - D / 24 - 900, kind: 'console', text: 'warn: rate field changed before models loaded' }
	],
	extra: { online: true, viewport: '1180x820', debug: false, routeId: '/admin/packages', kind: 'unknown' },
	device: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 27_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.3 Mobile/15E148 Safari/604.1', platform: 'iPad', displayMode: 'standalone', viewport: { width: 1180, height: 820 }, pixelRatio: 2, languages: ['th-TH', 'en'], timeZone: 'Asia/Bangkok', online: true, serviceWorker: true, colorScheme: 'dark' },
	notes: [{ at: now - D / 24 + 60_000, note: 'I typed 0.5 in the rate and the whole page went white.' }]
};

/** API path → JSON body for the signed-in Fleet pass. */
export const FLEET_FIXTURES = {
	'/api/admin/ai/providers': providers,
	'/api/admin/ai/providers/1/models': models,
	'/api/admin/ai/models': models,
	'/api/admin/packages': packages,
	'/api/admin/promos': promos,
	'/api/admin/invites': invites,
	'/api/admin/accounts': { accounts: [{ ...account, passkeyList: undefined }], next: null },
	'/api/admin/accounts/3': account,
	'/api/admin/community': community,
	'/api/admin/feedback': feedback,
	'/api/admin/errors': errors,
	'/api/admin/errors/7': errorDetail,
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
	{ path: '/admin/packages', open: ['Set rate'], label: 'credit rate form' },
	{ path: '/admin/promos', open: [] },
	{ path: '/admin/invitations', open: [] },
	{ path: '/admin/invitations', open: ['＋ New VIP'], label: 'new VIP' },
	{ path: '/admin/invitations', open: ['Edit'], label: 'edit VIP' },
	{ path: '/admin/community', open: [] },
	{ path: '/admin/feedback', open: [] },
	{ path: '/admin/errors', open: [] },
	{ path: '/admin/errors/7', open: [] },
	{ path: '/admin/accounts/3', open: [] }
];

/**
 * A sample URL for each dynamic Fleet route, for the navigation (flow) pass.
 * A new dynamic page under src/routes/admin needs an entry here and fixtures above.
 */
export const FLEET_SAMPLES = {
	'/admin/accounts/[id]': '/admin/accounts/3',
	'/admin/ai/[id]': '/admin/ai/1',
	'/admin/errors/[id]': '/admin/errors/7'
};

/**
 * A signed-in learner with no avatar yet, so Today shows the one-time "Make your avatar" prompt
 * (avatarAsked false) and the avatar setup can be opened from it. Beta consent is up to date,
 * so no consent sheet covers it. Made-up account.
 */
export const SIGNED_IN_ME = {
	signedIn: true,
	account: { id: 4242, name: 'Layout Check', isAdmin: false, recovery: false, via: 'passkey', appleLinked: false, avatar: null, avatarAsked: false },
	signupOpen: true,
	appleEnabled: false,
	beta: null
};

/** Answers /api/* for a signed-in learner: /api/auth/me from SIGNED_IN_ME, everything else 404. */
export function signedInRoute(route) {
	const path = new URL(route.request().url()).pathname;
	if (path === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIGNED_IN_ME) });
	return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
}
