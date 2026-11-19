# Lessons: mistakes this project already made

Each lesson is a real mistake or gotcha with the rule it teaches, its evidence and when it can be
retired. Read them once. When a task feels like one of these, stop and apply the rule.

The process they belong to is in [working-carefully.md](working-carefully.md).

**Adding a lesson.** One line each, between the markers below (keep the list under 6 KB):
`(slug) rule. [evidence: PR or commit; since date; retire when <check exists>]`. Remove a lesson
when its retire condition is met.

## Lessons from Coreva

These came from Job's other projects and apply here unchanged:

- (guessed-name) A command or input name was written from memory and was wrong. Take every name
  from the file that defines it ([where names are defined](working-carefully.md#never-guess-a-name)).
- (half-run) A run that failed partway was reported as succeeded. Read the run to the end; report
  "Failed at step N" and what exists now.
- (wrong-status) A 403 was shown as a made-up 500. Never invent data to fill a gap, and never turn
  one error into another.
- (stale-server) A dev server left running kept serving an old build. Stop what you start; check
  which build a page is before you trust it.
- (half-fix) A fix made viewing work but writes still failed. A fix is done when the whole journey
  works, reads and writes.
- (one-endpoint-two-pages) An endpoint was changed for one page and broke another. Find every caller first.
- (review-independence) A reviewer must not share the author's model.

## Benkyo lessons

<!-- LESSONS:BEGIN -->

- (migration-number) Two PRs each took the next migration number, so `0005_account_sync.sql` and `0005_beta.sql` both exist. Take the number from the default branch and open PRs at merge time, never from your branch start. [evidence: worker/migrations/; since 2026-11-15; retire when a test fails on duplicate migration prefixes]
- (stale-readme-deploy) The README says Workers Builds deploys `main`; the real default branch is `claude/japanese-learning-pwa-hrznwf` and deploys run by hand with `npm run cf:deploy`. Trust `package.json` and the deploy notes over the README until it is fixed. [evidence: README "Deploy to Cloudflare"; since 2026-11-19; retire when the README matches]
- (safari-boot) Regular Safari on iPhone got stuck on the splash after `Importing a module script failed`, which Chromium never showed. Startup code must survive a failed import or a slow IndexedDB (timeouts in `src/lib/boot.ts`), and missing `/_app/*` files must 404, not return HTML. [evidence: PR #20, PR #21; since 2026-11-15; retire when a WebKit startup test runs in the gate]
- (webkit-in-cloud) The cloud container cannot download Playwright WebKit and cannot reach benkyo.jirachai.me. Reproduce Safari bugs on Job's Mac (cached WebKit, iOS simulator) and check the live site with a fetch tool. [evidence: PR #20 thread; since 2026-11-15; retire when the environment allows them]
- (relayed-deploy) A deploy was blocked when the go came only through a relay. Name the exact action and target in the request, and if a safety check still blocks it, ask Job in the thread. [evidence: PR #12 and #19 deploys; since 2026-11-15; retire when relayed approval is never blocked]
- (vite-preview-rebuild) `vite preview` crashes when you rebuild under it. Stop it by PID, rebuild, start it again. [evidence: PR #4 screenshots; since 2026-11-15; retire when screenshots use a script that restarts it]
- (wrangler-dev-rebuild) After `npm run build` under a running `wrangler dev`, it answered 404 for every page, and stopping it by the npx PID left `workerd` serving the old copy. Stop the `wrangler` and `workerd` PIDs, rebuild, start again, and check `/` returns 200 before walking a flow. [evidence: promo codes PR walk; since 2026-11-19; retire when walks use a script that restarts it]
- (mock-getsession) Tests mock `getSession` from `worker/auth/passkey.ts`, but `requireSession` calls the unmocked one inside that module. New Worker routes call `getSession` and throw 401 themselves so the tests see the mocked session. [evidence: worker/promo.ts; since 2026-11-19; retire when tests use a real session cookie]
- (thai-content) New built-in lesson, course, kanji or drill text without a Thai entry fails `i18n.test.ts`. Add `content.th.ts` entries in the same PR; ask for a Thai speaker's review on consent or legal text. [evidence: PR #17; since 2026-11-15; retire never (it is the check)]
- (consent-version) Changing consent text without bumping `CONSENT_VERSION` would keep old consents valid for new terms. Change `consentText.ts` and `consentText.th.ts` together and bump the version. [evidence: PR #6; since 2026-11-15; retire never (it is the check)]
- (spacing-drift) 638 hand-typed px values (10, 14, 18 next to 8, 12, 16) made spacing uneven, and `.page > * { max-width }` left every desktop column stuck to the left of a wide screen. Spacing comes from `var(--space-*)` and the column from `--page-max`; `npm run lint:ui` and `npm run check:layout` enforce both. [evidence: this PR, Fleet sign-in card; since 2026-11-19; retire never (it is the check)]
- (fixed-in-transform) Settings capped every child at 680px with `.settings > :global(*)`, which also caught LargeTitle's fixed title bar, so it stopped short and sat off-centre beside the rail; on Today an animated `.rise` header trapped it. Size page columns with `--page-max`, and keep transforms off LargeTitle's ancestors. [evidence: PR #31; since 2026-11-19; retire never (check:layout covers it)]
- (native-controls) The Fleet grant form used native `<select>`s and the delete row paired a 52px field with a 36px pill, though the kit had a Select: nothing checked that screens used the kit. Every control comes from `#lib/ui`, a field and its button share a `FieldRow`, and a component that awaits something shows a Skeleton, Spinner or busy button; `scripts/check-ui.mjs` (lint:ui and the hook) enforces all three. [evidence: PR #31, Fleet package grant; since 2026-11-19; retire never (it is the check)]
- (two-budgets-one-ledger) Managed AI and learners' own keys share `ai_ledger`. Without `source = 'own'` in the cap query, package spend would have used up a learner's own $5 cap (and the other way round). Any new sum over `ai_ledger` for a budget filters by `source`; Fleet totals sum both on purpose. [evidence: worker/ai/ledger.ts, managed.test.ts; since 2026-11-19; retire never (it is the check)]
- (screens-not-flows) Fleet shipped eleven pages with no navigation: only the overview's links and an invisible edge swipe, no sidebar, no menu, no back, no "you are here". PRs #31 and #33 reviewed spacing and components one screen at a time, and `check:layout` loaded each URL directly, so nothing ever tried to get from one page to another. Review the journey as well as the screen: every page reachable from the nav, every page says where you are and how to go back. `check:layout`'s navigation pass enforces it for Fleet and the tab bar. [evidence: this PR (Fleet navigation); since 2026-11-19; retire never (it is the check)]
- (effect-loop) Today's `$effect` called `plan.load()`, which read the store's `$state` before its `await`, so the effect subscribed to it and every answer re-ran it: 2,400 `GET /api/promo` in 6 seconds, invisible in screenshots and unit tests. An effect that starts async work reads only the inputs it means to follow, then calls the work inside `untrack()`; count requests in a browser walk when an effect fetches. [evidence: PR #35 Codex review; since 2026-11-19; retire when a check counts requests per screen]
- (phone-width-admin) Fleet was designed and checked at phone width, and on a desktop it stayed an 820px column of phone lists: tables as stacked rows, sections one under another, half the screen empty. An operator console is a desktop tool first. Lay out records as `DataTable` and sections with `Columns`; `check:layout` fails a Fleet page under 900px wide at 1280px. [evidence: this PR (Fleet desktop); since 2026-11-19; retire never (it is the check)]
- (one-spinner-per-file) The loading-state lint passed a whole file once any spinner or busy button appeared in it, so the Fleet promo page's invite list, the providers' model list and a link's promo code being used after sign-in all loaded with nothing on screen, and the VIP card hid its buttons until the drawing finished. Each async function must drive its own visible state; `scripts/check-ui.mjs` now checks them one by one, and flags "…ing…" text with no spinner. [evidence: VIP invite follow-up, Job 2026-11-19; since 2026-11-19; retire never (it is the check)]
<!-- LESSONS:END -->
