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
| Static assets | The SvelteKit SPA from `build/` and the component Storybook at `/storybook/`, served without Worker code | `src/`, `adapter-static` |
| Worker `fetch` | `/api/*` and missing `/_app/*` files (`run_worker_first`) | `worker/index.ts` |
| Worker `scheduled` | Daily cron `23 3 * * *`: beta data retention (180 days), community retention (removed content 90 days, handled reports 180 days), content feedback retention (handled reports 180 days) | `worker/index.ts`, `worker/beta/`, `worker/community.ts`, `worker/feedback.ts` |
| Bindings | `DB` (D1 `benkyo`), `CONTENT` (KV), `ASSETS`, `CF_VERSION_METADATA` | `wrangler.jsonc`, `worker/env.ts` |
| Embedded variant | Same Worker with assets bundled in the script | `wrangler.embedded.jsonc`, `worker/embedded.ts` |

## Features

| Feature | Who | API routes | D1 tables | Worker code | Client code |
| --- | --- | --- | --- | --- | --- |
| Kana, lessons, kanji, courses | learner | `/api/content` (KV manifest) | none | `worker/index.ts` | `src/lib/content/`, `src/routes/{learn,kana}/` |
| Review and scheduling | learner | none (local) | none | none | `src/lib/srs/fsrs.ts`, `src/routes/review/`, `src/lib/state/progress.svelte.ts` |
| Handwriting check | learner | none | none | none | `src/lib/handwriting/`, `wasm/stroke/`, `static/wasm/stroke.wasm`, `TracePad`, `RecallPad` |
| Placement and drills, kanji you keep forgetting ([EVERYDAY.md](EVERYDAY.md)) | learner | none | none | none | `src/lib/practice/`, `src/lib/state/forgetting.svelte.ts`, `src/routes/learn/placement/`, Learn › Practice, `/review?practice=<id>` |
| Level courses N5–N1 ([LEVELS.md](LEVELS.md)), Test out | learner | none (built into the app) | none | none | `src/lib/content/levels/` (units, `levels.test.ts` checks), `src/lib/state/levels.svelte.ts`, `src/lib/practice/testOut.ts`, `src/lib/words/levelCards.ts`, `src/routes/learn/level/[unit]/` (+ `test/`), Learn (📗 N5 section), Settings (Show draft units, `showDraftUnits`) |
| Browse: kanji gallery, grammar index ([LEVELS.md](LEVELS.md#browse)) | learner | none | none | none | `src/lib/content/kanjiIndex.ts`, `src/lib/state/kanjiIndex.svelte.ts`, `src/routes/learn/browse/{kanji,kanji/[char],grammar}/`, Learn (Browse row), level-kanji strokes `src/lib/content/level-kanji-strokes.json` (`npm run build:strokes`, loaded by `loadLevelStrokes()`) |
| Onboarding ([ONBOARDING.md](ONBOARDING.md)): after sign-up, loading after sign-in/up | new learner | none | none | none | `src/lib/onboarding/`, `Onboarding.svelte`, `Handoff.svelte`, `ui.onboardingNext`/`ui.handoff`, `+layout.svelte` (`afterWelcome`) |
| Words, packs and phrasebook | learner | `/api/sync` | `user_cards` (`seen_json`: where each card came up, migration 0021) | `worker/cards.ts`, `worker/sync.ts` | `src/lib/words/` (`phrasebook.ts`), `src/lib/state/{words,lessonPacks}.svelte.ts`, `src/routes/words/` |
| Personal notes ([NOTES.md](NOTES.md)) | learner | `/api/sync` (`notes`, `notesCursor`) | `user_notes` | `worker/notes.ts`, `worker/sync.ts` | `src/lib/notes/`, `src/lib/state/notes.svelte.ts`, `NoteCard.svelte`, Words → Notes |
| Community notes ([COMMUNITY.md](COMMUNITY.md)) | signed-in learner, Job | `/community` tab, `/api/community/*` (incl. `feed`), `/api/ai/translate` (文A), `/api/admin/community[/content,/author]` | `community_profiles`, `community_posts`, `community_replies`, `community_likes`, `community_reports`, `community_blocks` | `worker/community.ts`, `worker/communityData.ts`, `worker/communityWords.ts`, `worker/admin/community.ts` | `src/lib/community/` (incl. `translations.ts`, the device cache), `src/lib/state/community.svelte.ts`, `CommunityNotes.svelte`, `CommunityPost.svelte`, `CommunitySettings.svelte`, `src/routes/admin/community/` |
| Content feedback ([FEEDBACK.md](FEEDBACK.md)): 👍/👎 and Report a problem | signed-in learner, Job | `/api/feedback/{mine,vote,report}`, `/api/admin/feedback[/report]` | `content_votes`, `content_reports` (migration 0020) | `worker/feedback.ts`, `worker/admin/feedback.ts` | `src/lib/feedback/`, `src/lib/state/feedback.svelte.ts`, `ContentFeedback.svelte` (on kana, kana and kanji lessons, course and level units, grammar points, word rows, Words card, kanji page), `src/routes/admin/feedback/` |
| Progress sync | signed-in learner | `/api/sync` | `users`, `review_log`, `user_cards`, `user_notes` | `worker/sync.ts` | `src/lib/state/progress.svelte.ts`, idb `outbox` |
| Passkey accounts, recovery | everyone | `/api/auth/{register,login}/{options,verify}`, `/api/auth/{me,logout,account,passkeys,recover,recovery-code}` | `accounts`, `passkeys`, `recovery_codes`, `sessions`, `auth_challenges` | `worker/auth/{passkey,session,signup}.ts` | `Welcome.svelte`, `AccountSettings.svelte` |
| Avatar (selfie or by hand) | signed-in learner | `/api/auth/avatar` (PUT: parts or "Not now"), `/api/auth/me` (`account.avatar`, `avatarAsked`), community posts and replies (`avatar`) | `accounts.avatar`, `accounts.avatar_asked_at` (0019) | `worker/avatar.ts`, `worker/auth/passkey.ts`, `worker/community.ts` | `src/lib/avatar/` (parts, style pack, selfie reader, mapping), `src/lib/state/avatar.svelte.ts`, `AvatarSetup.svelte`, `AvatarEditor.svelte`, `Avatar`/`TilePicker`/`SwatchPicker` (kit). See [AVATAR.md](AVATAR.md) |
| Sign in with Apple (off: no `APPLE_CLIENT_ID`) | everyone | `/api/auth/apple/{start,callback}` | `apple_identities`, `apple_states` | `worker/auth/{apple,appleToken}.ts` | `AppleButton.svelte` |
| Sign-up mode, invite codes, VIP invites | everyone, Job | `/api/auth/register/options`, `/api/auth/invite/:code` (card + coupon), `/api/admin/invites` (GET, POST incl. VIP), `/api/admin/invites/:code` (PATCH card/coupon, DELETE revoke), `/api/admin/invites/:code/delete` (POST, soft delete) | `app_settings`, `invite_codes` (+ `card_note`, `card_from`, `card_ink`, `coupon`, `deleted_at`) | `worker/auth/signup.ts`, `worker/invite.ts`, `worker/admin/settings.ts` | `Welcome.svelte`, `src/routes/invite/[code]` (`/invite/VIP` links, `InviteCard`), `src/lib/invite/`, `src/routes/admin/invitations/` (Fleet → Invitations), `src/routes/admin/settings/` (sign-up mode) |
| AI tutor (BYOK) | AI user | `/api/ai/{ask,ask/stream,fill,propose,lesson,translate}` | `ai_ledger`, `ai_rate` | `worker/ai/{ask,run,anthropic,openai,ledger}.ts` | `src/lib/ai/`, `src/routes/ai/`; Words card and word pack → Ask AI about this word opens `AskPeek.svelte` (a peek Sheet over the card; `AskMessages.svelte` and `src/lib/ai/askSend.ts` are shared with `/ai/ask`; `AskRequest.focus`); "Open in Ask AI" continues on `/ai/ask` (`focusHref`/`focusFromUrl`/`backFromUrl` in `src/lib/ai/threads.ts`) |
| Writing helper ([EVERYDAY.md](EVERYDAY.md)) | AI user | `/api/ai/write` (Suggestions model) | `ai_ledger`, `ai_rate` | `worker/ai/run.ts` | `src/routes/ai/write/`, `src/lib/words/writing.ts`, `PolitenessMeter`, `MarkedText`, `SpeechBubble`; word politeness on the Words card and packs: `src/lib/words/politeness.ts`, `getMarks`, `CardPoliteness.svelte`, `WordPoliteness.svelte`, `StepBar` (kit) |
| Weekly report ([EVERYDAY.md](EVERYDAY.md)) | learner | none | none | none | `src/routes/week/`, `src/lib/report/week.ts`, `src/lib/state/week.svelte.ts`, Today (Your week card), `BarChart`, `StatTile` |
| AI keys, models, prices, cap | AI user | `/api/ai/{credentials,models,prices,features,cap,usage}` | `ai_credentials`, `ai_feature_models`, `ai_model_prices`, `ai_settings` | `worker/ai/{credentials,models,cost}.ts`, `worker/crypto.ts` | `AiSettings.svelte`, `src/lib/state/ai.svelte.ts` |
| Managed AI (package AI) | learner on a package | `/api/ai/managed` (+ every `/api/ai/*` call) | `ai_ledger` (`source`, `plan_id`, `credits`), `accounts.ai_source`, `plans` (`ai_credits`), `plan_models`, `model_credit_rates`, `ai_providers` | `worker/ai/managed.ts`, `worker/ai/{run,ask,ledger,cost}.ts`, `src/lib/ai/credits.ts` | `AiSettings.svelte` (Use AI from; hides own-key setup on a package), `src/lib/state/ai.svelte.ts` (`managed`) |
| Plans and packages | Job | `/api/admin/packages`, `/api/admin/credit-rates`, `/api/admin/accounts/:id/grants` | `plans`, `plan_grants`, `model_credit_rates` | `worker/plans.ts`, `worker/admin/packages.ts` | `src/routes/admin/packages/` |
| Promo codes | Job, signed-in learner | `/api/promo`, `/api/promo/redeem`, `/api/admin/promos[/:code]` (GET, POST, PATCH edit, DELETE soft delete) | `promo_codes` (+ `deleted_at`), `promo_redemptions` (+ `plan_grants`) | `worker/promo.ts`, `worker/admin/promos.ts` | `src/lib/promo/` (`link.ts`: `?ref=CODE` links, redeemed by the root layout), `PromoCode.svelte` (Settings), `src/routes/admin/promos/` |
| Today greeting and package badge | signed-in learner | `/api/auth/me` (name), `/api/promo` (package) | `accounts`, `plan_grants` (read) | `worker/promo.ts` | `src/lib/greeting.ts`, `src/lib/state/plan.svelte.ts`, `PlanBadge` (kit), `src/routes/+page.svelte` |
| Beta consent and usage data | signed-in learner | `/api/beta/{status,consent,events,data,export}` | `beta_consents`, `beta_events`, `beta_ai_calls` | `worker/beta/` | `src/lib/beta/`, `BetaConsent.svelte` |
| Fleet console | Job (Cloudflare Access + step-up) | `/api/admin/{overview,usage (by source and package),audit,errors,system,stepup/*,accounts,invites,settings,packages,promos,ai/*}` | `admin_audit`, `ai_providers`, `plan_models` (+ reads most tables) | `worker/admin/` | `src/routes/admin/` (shell: `+layout.svelte`), `src/lib/admin/` (nav: `nav.ts`, `FleetNav.svelte`, `FleetTrail.svelte`) |
| Session length | Job | `/api/admin/settings/session` | `ai_settings` (`session_ttl_days`) | `worker/auth/session.ts` | `src/routes/admin/settings/` |
| Account deletion | learner, Job | `/api/auth/account`, `/api/admin/accounts/:id` | every table with a user id | `closeAccountStatements` (learner: disable, keep data) / `accountDataStatements` (Fleet: erase) in `worker/ai/credentials.ts` | `AccountSettings.svelte` |
| Install and Open in Safari | learner in a browser tab | none | none | none | `src/lib/pwa/` (`platform.ts`: `needsSafari`, `appName`, `safariUrl`; `install.svelte.ts`), `InstallGuide.svelte`, `InstallCard.svelte` (Today), `OpenInSafari.svelte` (launch prompt on iPhone/iPad outside Safari, above the intro and sign-in), kit `SafariPrompt`, Welcome (install-first card) |
| Health | anyone | `/api/health` | none | `worker/index.ts` | none |
| Error reports and debugging ([DEBUGGING.md](DEBUGGING.md)) | everyone (sent only with beta consent), Job | `/api/beta/events` (`error`, `error_note`), `/api/admin/errors[/:id]`, `x-request-id` on every `/api/*` answer | `beta_events` | `worker/index.ts` (`requestIdOf`, structured logs), `worker/admin/errors.ts` | `src/lib/debug/errors.svelte.ts`, `src/hooks.client.ts`, `DebugSettings.svelte` (Settings → Debugging), `src/routes/admin/errors/` |

A new table with a user id must be added to `accountDataStatements` (used by both deletes), and to the beta export if it holds
beta data.

## Client stores (IndexedDB `benkyo`, `VERSION` in `src/lib/db/idb.ts`)

| Store | Holds | Used by |
| --- | --- | --- |
| `cards` | FSRS card state | `progress.svelte.ts`, review |
| `logs` | Review log (index `synced`) | `progress.svelte.ts`, sync |
| `meta` | Flags such as `introSeen`, `kuriIntroSeen`; `kanjiWriteSlips` (kanji drawn wrong, device only), `writeChecks` (Writing helper checks, device only) | layout, intro, onboarding, `forgetting.svelte.ts`, `week.svelte.ts` |
| `userCards` | Learner-made word cards | `words.svelte.ts` |
| `packs` | Lesson packs | `lessonPacks.svelte.ts` |
| `outbox` | Changes waiting to sync | `progress.svelte.ts` |
| `notes` | Personal notes, key `subject` (VERSION 3) | `notes.svelte.ts`, sync |

localStorage keys: `benkyo.locale` (interface language), `benkyo.errors` (last 20 errors caught on this device), `benkyo.debug` (debug mode), `benkyo.avatar` (the signed-in account's avatar parts, for offline), `benkyo.boot` (startup safe mode), `benkyo.avatarStrips` (iPhone/iPad: old avatar wave strips cleared once),
`benkyo.installCard` (install card dismissed), sessionStorage `benkyo.safariPrompt` (Open in Safari prompt: Continue here chosen in this tab), `benkyo.levelUp` (Next level suggestion hidden, `N5>N4`), `benkyo.plan` (last known package, grant end and name of the signed-in account, for the Today badge offline;
`src/lib/state/plan.svelte.ts`).

## Shared things

Announce a change to any of these to the other threads ([teamwork.md](guides/teamwork.md)).

| Thing | Where | Rule |
| --- | --- | --- |
| Design tokens | `src/lib/design/tokens.css`, `tokens.ts` | Old names (`--bg`, `--ink`, `--accent`) are aliases; do not remove them while screens use them |
| Spacing checks | `scripts/check-spacing.mjs`, `scripts/check-layout.mjs`, `.claude/settings.json` | Spacing uses `var(--space-*)`; a new screen goes into `SCREENS` in `check-layout.mjs`; a new full-screen sheet or step gets a flow like `avatarFlow` |
| Render (GPU) check | `scripts/check-render.mjs` | A live avatar or other GPU view must not build a new WebGL/WebGPU context per change; a new animated view gets a walk there |
| Layout check fixtures | `scripts/layout-fixtures.mjs` | Synthetic Fleet data for `check:layout`, and `SIGNED_IN_ME` (a signed-in learner with no avatar) for the avatar setup in `check:layout` and `check:render`; a new Fleet screen with forms goes into `FLEET_SCREENS`, a new dynamic Fleet route into `FLEET_SAMPLES` |
| Fleet navigation | `src/lib/admin/nav.ts` (`FLEET_NAV`, `FLEET_SIDEBAR_QUERY`, also in `admin.css`) | A new Fleet page gets a `FLEET_NAV` entry whose label matches its title, and `<FleetTrail />` above its LargeTitle; `check:layout` fails otherwise |
| UI kit checks | `scripts/check-ui.mjs`, `src/lib/ui/kit.test.ts`, `.claude/settings.json` | No raw controls outside `src/lib/ui`; every kit component exported, on `/design` and with a story in `src/lib/ui/stories/`; async work shows a loading state; no spinning element boxes (Safari wobble) |
| UI kit | `src/lib/ui/` (import from `#lib/ui/index.ts`), shown on `/design` and in Storybook (`/storybook/`) | Every control in the app comes from here. New component: export it, add it to `/design` and add `src/lib/ui/stories/<Name>.stories.svelte` (the lint fails otherwise) |
| Storybook | `.storybook/` (config, app CSS, themes, viewports, `$app/*` stand-ins), `src/lib/ui/stories/`, built into `build/storybook/` by `npm run build`, served at `/storybook/` | Plain static path: not in `run_worker_first`, skipped by the service worker and the embedded deploy. [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#storybook) |
| UI strings | `src/lib/i18n/{en,th}.ts`, `t()` / `tn()` | Append keys; `th.ts` may be partial (falls back to English) |
| Lesson content Thai | `src/lib/i18n/content.th.ts` | `i18n.test.ts` fails on a missing entry |
| Consent | `src/lib/beta/consentText.ts`, `consentText.th.ts`, `CONSENT_VERSION` | Change together; bump the version |
| AI contract | `src/lib/ai/contract.ts`, `worker/ai/types.ts` | Client and Worker change in the same PR |
| HTTP helpers | `worker/http.ts` | `json`, `aiError`, `httpError`, `readJson` |
| Worker config | `worker/env.ts`, `wrangler.jsonc`, `wrangler.embedded.jsonc` | Keep both wrangler files in step |
| Device and layout | `src/lib/ios/device.svelte.ts` (`RAIL_QUERY`, `SIDEBAR_QUERY`, also in `app.css`; TabBar reads them) | Change them together |
| Main navigation | `src/lib/nav.ts` (`NAV_ITEMS`, `DEFAULT_PINS`), `TabBar.svelte`, `NavMore.svelte` | A new top-level screen gets a `NAV_ITEMS` entry; `check:layout` fails otherwise |
| Error pages | `src/routes/+error.svelte`, `src/lib/errorKind.ts`, kit `ErrorState` | Every route error (learner and Fleet) goes through `ErrorState`; a panel that fails inside a screen uses `layout="inline"` instead of throwing. The error ID comes from `page.error.errorId` |
| More below button | kit `ScrollMore` (`src/lib/ui/ScrollMore.svelte`, rule in `scrollMore.ts`), one instance in `src/routes/+layout.svelte`, `ui.scrollClear` | Every long screen gets it from the layout. A screen with its own fixed bottom bar sets `ui.scrollClear` to the px it needs (Ask AI composer, Fleet menu pill) and resets it to 0 when it leaves. A full-screen sheet that scrolls itself renders its own with `target` (`BetaConsent.svelte`) |
| Startup | `src/app.html`, `src/lib/boot.ts`, `src/service-worker/` | Must survive failed imports and slow storage on Safari |
