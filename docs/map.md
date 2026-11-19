# Map: screens, API routes, D1 tables and client stores

A small index for looking up **what else a change touches**. Read it before each task. The source
of truth is the code: routes in `worker/index.ts` and each module's routes, tables in
`worker/migrations/`, client stores in `src/lib/db/idb.ts`, config in `worker/env.ts` and
`wrangler.jsonc`.

**Keep it current.** A PR that adds or changes a route, table, store, screen, shared component or
setting updates the matching row here in the same PR. If the map and the code disagree, the code
is right: fix the map.

Seen on the default branch at 0a6a974 (2026-11-19).

## Deployable

One Cloudflare Worker, `benkyo-ne` (`wrangler.jsonc`), at https://benkyo.jirachai.me.

| Part | Does | Code |
| --- | --- | --- |
| Static assets | The SvelteKit SPA from `build/`, served without Worker code | `src/`, `adapter-static` |
| Worker `fetch` | `/api/*` and missing `/_app/*` files (`run_worker_first`) | `worker/index.ts` |
| Worker `scheduled` | Daily cron `23 3 * * *`: beta data retention (180 days), community retention (removed content 90 days, handled reports 180 days) | `worker/index.ts`, `worker/beta/` |
| Bindings | `DB` (D1 `benkyo`), `CONTENT` (KV), `ASSETS`, `CF_VERSION_METADATA` | `wrangler.jsonc`, `worker/env.ts` |
| Embedded variant | Same Worker with assets bundled in the script | `wrangler.embedded.jsonc`, `worker/embedded.ts` |

## Features

| Feature | Who | API routes | D1 tables | Worker code | Client code |
| --- | --- | --- | --- | --- | --- |
| Kana, lessons, kanji, courses | learner | `/api/content` (KV manifest) | none | `worker/index.ts` | `src/lib/content/`, `src/routes/{learn,kana}/` |
| Review and scheduling | learner | none (local) | none | none | `src/lib/srs/fsrs.ts`, `src/routes/review/`, `src/lib/state/progress.svelte.ts` |
| Handwriting check | learner | none | none | none | `src/lib/handwriting/`, `wasm/stroke/`, `static/wasm/stroke.wasm`, `TracePad`, `RecallPad` |
| Placement and drills | learner | none | none | none | `src/lib/practice/`, `src/routes/learn/placement/` |
| Level courses N5–N1 ([LEVELS.md](LEVELS.md)), Test out | learner | none (built into the app) | none | none | `src/lib/content/levels/` (units, `levels.test.ts` checks), `src/lib/state/levels.svelte.ts`, `src/lib/practice/testOut.ts`, `src/lib/words/levelCards.ts`, `src/routes/learn/level/[unit]/` (+ `test/`), Learn (📗 N5 section), Settings (Show draft units, `showDraftUnits`) |
| Onboarding | new learner | none | none | none | `src/lib/onboarding/`, `Onboarding.svelte` |
| Words and packs | learner | `/api/sync` | `user_cards` | `worker/cards.ts`, `worker/sync.ts` | `src/lib/words/`, `src/lib/state/{words,lessonPacks}.svelte.ts`, `src/routes/words/` |
| Personal notes ([NOTES.md](NOTES.md)) | learner | `/api/sync` (`notes`, `notesCursor`) | `user_notes` | `worker/notes.ts`, `worker/sync.ts` | `src/lib/notes/`, `src/lib/state/notes.svelte.ts`, `NoteCard.svelte`, Words → Notes |
| Community notes ([COMMUNITY.md](COMMUNITY.md)) | signed-in learner, Job | `/api/community/*`, `/api/ai/translate` (文A), `/api/admin/community[/content,/author]` | `community_profiles`, `community_posts`, `community_replies`, `community_likes`, `community_reports`, `community_blocks` | `worker/community.ts`, `worker/communityData.ts`, `worker/communityWords.ts`, `worker/admin/community.ts` | `src/lib/community/` (incl. `translations.ts`, the device cache), `src/lib/state/community.svelte.ts`, `CommunityNotes.svelte`, `CommunityPost.svelte`, `CommunitySettings.svelte`, `src/routes/admin/community/` |
| Progress sync | signed-in learner | `/api/sync` | `users`, `review_log`, `user_cards`, `user_notes` | `worker/sync.ts` | `src/lib/state/progress.svelte.ts`, idb `outbox` |
| Passkey accounts, recovery | everyone | `/api/auth/{register,login}/{options,verify}`, `/api/auth/{me,logout,account,passkeys,recover,recovery-code}` | `accounts`, `passkeys`, `recovery_codes`, `sessions`, `auth_challenges` | `worker/auth/{passkey,session,signup}.ts` | `Welcome.svelte`, `AccountSettings.svelte` |
| Sign in with Apple (off: no `APPLE_CLIENT_ID`) | everyone | `/api/auth/apple/{start,callback}` | `apple_identities`, `apple_states` | `worker/auth/{apple,appleToken}.ts` | `AppleButton.svelte` |
| Sign-up mode, invite codes, VIP invites | everyone, Job | `/api/auth/register/options`, `/api/auth/invite/:code` (card + coupon), `/api/admin/invites` (GET, POST incl. VIP), `/api/admin/invites/:code` (PATCH card/coupon, DELETE revoke), `/api/admin/invites/:code/delete` (POST, soft delete) | `app_settings`, `invite_codes` (+ `card_note`, `card_from`, `card_ink`, `coupon`, `deleted_at`) | `worker/auth/signup.ts`, `worker/invite.ts`, `worker/admin/settings.ts` | `Welcome.svelte`, `src/routes/invite/[code]` (`/invite/VIP` links, `InviteCard`), `src/lib/invite/`, `src/routes/admin/invitations/` (Fleet → Invitations), `src/routes/admin/settings/` (sign-up mode) |
| AI tutor (BYOK) | AI user | `/api/ai/{ask,ask/stream,fill,propose,lesson,translate}` | `ai_ledger`, `ai_rate` | `worker/ai/{ask,run,anthropic,openai,ledger}.ts` | `src/lib/ai/`, `src/routes/ai/` |
| AI keys, models, prices, cap | AI user | `/api/ai/{credentials,models,prices,features,cap,usage}` | `ai_credentials`, `ai_feature_models`, `ai_model_prices`, `ai_settings` | `worker/ai/{credentials,models,cost}.ts`, `worker/crypto.ts` | `AiSettings.svelte`, `src/lib/state/ai.svelte.ts` |
| Managed AI (package AI) | learner on a package | `/api/ai/managed` (+ every `/api/ai/*` call) | `ai_ledger` (`source`, `plan_id`), `accounts.ai_source`, `plans`, `plan_models`, `ai_providers` | `worker/ai/managed.ts`, `worker/ai/{run,ask,ledger}.ts` | `AiSettings.svelte` (Use AI from), `src/lib/state/ai.svelte.ts` (`managed`) |
| Plans and packages | Job | `/api/admin/packages`, `/api/admin/accounts/:id/grants` | `plans`, `plan_grants` | `worker/plans.ts`, `worker/admin/packages.ts` | `src/routes/admin/packages/` |
| Promo codes | Job, signed-in learner | `/api/promo`, `/api/promo/redeem`, `/api/admin/promos[/:code]` (GET, POST, PATCH edit, DELETE soft delete) | `promo_codes` (+ `deleted_at`), `promo_redemptions` (+ `plan_grants`) | `worker/promo.ts`, `worker/admin/promos.ts` | `src/lib/promo/` (`link.ts`: `?ref=CODE` links, redeemed by the root layout), `PromoCode.svelte` (Settings), `src/routes/admin/promos/` |
| Today greeting and package badge | signed-in learner | `/api/auth/me` (name), `/api/promo` (package) | `accounts`, `plan_grants` (read) | `worker/promo.ts` | `src/lib/greeting.ts`, `src/lib/state/plan.svelte.ts`, `PlanBadge` (kit), `src/routes/+page.svelte` |
| Beta consent and usage data | signed-in learner | `/api/beta/{status,consent,events,data,export}` | `beta_consents`, `beta_events`, `beta_ai_calls` | `worker/beta/` | `src/lib/beta/`, `BetaConsent.svelte` |
| Fleet console | Job (Cloudflare Access + step-up) | `/api/admin/{overview,usage (by source and package),audit,system,stepup/*,accounts,invites,settings,packages,promos,ai/*}` | `admin_audit`, `ai_providers`, `plan_models` (+ reads most tables) | `worker/admin/` | `src/routes/admin/` (shell: `+layout.svelte`), `src/lib/admin/` (nav: `nav.ts`, `FleetNav.svelte`, `FleetTrail.svelte`) |
| Session length | Job | `/api/admin/settings/session` | `ai_settings` (`session_ttl_days`) | `worker/auth/session.ts` | `src/routes/admin/settings/` |
| Account deletion | learner, Job | `/api/auth/account`, `/api/admin/accounts/:id` | every table with a user id | `closeAccountStatements` (learner: disable, keep data) / `accountDataStatements` (Fleet: erase) in `worker/ai/credentials.ts` | `AccountSettings.svelte` |
| Health | anyone | `/api/health` | none | `worker/index.ts` | none |

A new table with a user id must be added to `accountDataStatements` (used by both deletes), and to the beta export if it holds
beta data.

## Client stores (IndexedDB `benkyo`, `VERSION` in `src/lib/db/idb.ts`)

| Store | Holds | Used by |
| --- | --- | --- |
| `cards` | FSRS card state | `progress.svelte.ts`, review |
| `logs` | Review log (index `synced`) | `progress.svelte.ts`, sync |
| `meta` | Flags such as `introSeen`, `kuriIntroSeen` | layout, intro, onboarding |
| `userCards` | Learner-made word cards | `words.svelte.ts` |
| `packs` | Lesson packs | `lessonPacks.svelte.ts` |
| `outbox` | Changes waiting to sync | `progress.svelte.ts` |
| `notes` | Personal notes, key `subject` (VERSION 3) | `notes.svelte.ts`, sync |

localStorage keys: `benkyo.locale` (interface language), `benkyo.boot` (startup safe mode),
`benkyo.installCard` (install card dismissed), `benkyo.plan` (last known package, grant end and name of the signed-in account, for the Today badge offline;
`src/lib/state/plan.svelte.ts`).

## Shared things

Announce a change to any of these to the other threads ([teamwork.md](guides/teamwork.md)).

| Thing | Where | Rule |
| --- | --- | --- |
| Design tokens | `src/lib/design/tokens.css`, `tokens.ts` | Old names (`--bg`, `--ink`, `--accent`) are aliases; do not remove them while screens use them |
| Spacing checks | `scripts/check-spacing.mjs`, `scripts/check-layout.mjs`, `.claude/settings.json` | Spacing uses `var(--space-*)`; a new screen goes into `SCREENS` in `check-layout.mjs` |
| Layout check fixtures | `scripts/layout-fixtures.mjs` | Synthetic Fleet data for `check:layout`; a new Fleet screen with forms goes into `FLEET_SCREENS`, a new dynamic Fleet route into `FLEET_SAMPLES` |
| Fleet navigation | `src/lib/admin/nav.ts` (`FLEET_NAV`, `FLEET_SIDEBAR_QUERY`, also in `admin.css`) | A new Fleet page gets a `FLEET_NAV` entry whose label matches its title, and `<FleetTrail />` above its LargeTitle; `check:layout` fails otherwise |
| UI kit checks | `scripts/check-ui.mjs`, `src/lib/ui/kit.test.ts`, `.claude/settings.json` | No raw controls outside `src/lib/ui`; every kit component exported and on `/design`; async work shows a loading state; no spinning element boxes (Safari wobble) |
| UI kit | `src/lib/ui/` (import from `#lib/ui/index.ts`), shown on `/design` | Every control in the app comes from here. New component: export it and add it to `/design` (the lint fails otherwise) |
| UI strings | `src/lib/i18n/{en,th}.ts`, `t()` / `tn()` | Append keys; `th.ts` may be partial (falls back to English) |
| Lesson content Thai | `src/lib/i18n/content.th.ts` | `i18n.test.ts` fails on a missing entry |
| Consent | `src/lib/beta/consentText.ts`, `consentText.th.ts`, `CONSENT_VERSION` | Change together; bump the version |
| AI contract | `src/lib/ai/contract.ts`, `worker/ai/types.ts` | Client and Worker change in the same PR |
| HTTP helpers | `worker/http.ts` | `json`, `aiError`, `httpError`, `readJson` |
| Worker config | `worker/env.ts`, `wrangler.jsonc`, `wrangler.embedded.jsonc` | Keep both wrangler files in step |
| Device and layout | `src/lib/ios/device.svelte.ts` (`RAIL_QUERY`, also in `app.css` and `TabBar.svelte`) | Change all three together |
| Startup | `src/app.html`, `src/lib/boot.ts`, `src/service-worker/` | Must survive failed imports and slow storage on Safari |
