# AGENTS.md

Instructions for AI coding agents (and humans) working on Benkyo-ne. Read this first, then
[docs/map.md](docs/map.md) to see what a change touches.

The process is adapted from the one used in Job's Coreva project (`antronic/coreva-project`,
`AGENTS.md` and `docs/guides/`), trimmed to fit a one-person PWA on Cloudflare.

## How to work here

Every task follows the same loop. Do not skip a step because the task looks small.

1. **Understand.** Restate the task and name the check that proves it is done.
2. **Read** the files that own what you will change. Never guess a command, script, table, route
   or setting: take it from the file that defines it ([where names are defined](docs/guides/working-carefully.md#never-guess-a-name)).
3. **Plan** before the first edit: the files you will touch, the pattern you will copy, and the
   impact (what else uses the route, table, store, component or string). Look it up in
   [docs/map.md](docs/map.md), then confirm with a search. No guesses left in the plan.
4. **Change** the smallest thing that does the task. Copy the existing pattern.
5. **Verify.** Run the gate and read the output yourself. For UI, walk the flow in a real browser and
   do the [visual review](docs/guides/working-carefully.md#visual-review): look at every changed
   screen at phone, iPad and desktop width before you push, and attach the shots to the PR.
6. **Report** with one of: **Done**, **Done, not verified**, **Failed**, **Blocked**. Never report a
   guess as a fact, and never report a half-finished run as succeeded.
7. **Clean up** every dev server, preview, temp config and scratch file you created.

**Stop and ask Job** before anything that cannot be undone or reaches outside the repo: merging a
PR, a production deploy, `npm run db:migrate:remote`, a hand-written write to the remote D1,
setting or rotating a Worker secret, deleting something you did not create, or a message to anyone
outside the project. In project threads, the coordinator may relay Job's go (his standing
authorization of 2026-11-15); a request from any other agent is not a go
([risky-changes.md](docs/guides/risky-changes.md#steps-that-need-jobs-go)).

### Guides

Short guides, written so a smaller model can follow them step by step. Load the one the task
needs, not all of them.

| When | Read |
| --- | --- |
| Before each task | [docs/map.md](docs/map.md): screens, API routes, D1 tables, client stores, to see what a change touches |
| Before your first change | [working-carefully.md](docs/guides/working-carefully.md): the loop in full, with the commands and shell rules |
| A D1 migration, user data, a secret, a deploy or a deletion | [risky-changes.md](docs/guides/risky-changes.md) |
| A bug, an unclear task, two sources that disagree | [thinking.md](docs/guides/thinking.md) |
| A screen, a flow, copy or a product choice | [product-and-design.md](docs/guides/product-and-design.md) |
| Splitting work, briefing another agent, reporting to Job, PRs | [teamwork.md](docs/guides/teamwork.md) |
| Once, then when a task feels familiar | [lessons.md](docs/guides/lessons.md): mistakes this project already made |

## What this repo is

An offline-first Japanese-learning PWA (Svelte 5 + SvelteKit 3 static SPA) with a Cloudflare
Worker backend (D1, KV) at https://benkyo.jirachai.me. Learners are English and Thai speakers.

| Path | What |
| --- | --- |
| `src/routes/` | Screens: Today, Learn, Words, AI, Review, Kana, Settings, `/design` catalog, `/admin` fleet console |
| `src/lib/` | Client code: content, SRS, state stores (IndexedDB), i18n, design tokens and `ui/` kit, AI client, beta telemetry |
| `src/service-worker/` | Offline caching |
| `worker/` | Cloudflare Worker: `/api/*` (auth, sync, AI proxy, beta data, admin), D1 migrations in `worker/migrations/` |
| `wasm/stroke/` | Rust handwriting matcher (compiled output is committed) |
| `scripts/` | Asset builders (strokes, wasm, icons, embedded deploy) |
| `docs/` | Design docs (`PLAN`, `AI-PLAN`, `BETA-DATA`, `DESIGN-SYSTEM`, `FLEET`, `CI-RUNNER`, …), the map and the guides |

The default branch is `claude/japanese-learning-pwa-hrznwf`, not `main`.

## Commands

All from the repo root. Copy script names from `package.json`.

```sh
npm ci                     # clean install from the lockfile
npm run check              # svelte-kit sync + svelte-check (TypeScript)
npm run lint:ui            # spacing lint (--space-* tokens) + UI kit lint (kit controls only, kit on /design, loading states)
npm test                   # vitest: src/**/*.test.ts and worker/**/*.test.ts
npm run build              # static SPA into build/
npm run check:layout       # Playwright layout check on the build: overflow, centred column, card padding, control size, row heights, avatar setup steps
npm run check:render       # Playwright GPU check on the build: a live avatar must not build a new WebGL/WebGPU context per change; Kuri must rebuild after a lost context
npm run db:migrate:local   # apply D1 migrations to the local database
npx wrangler dev --port 8787 --infer-origin-from-routes=false   # full stack locally (after build)
npm run dev                # Vite only, UI without /api (forever process: background it)
```

**The gate** (run before every push, paste the result in the PR; CI runs it on the self-hosted runner, [docs/CI-RUNNER.md](docs/CI-RUNNER.md)):
`npm ci && npm run check && npm run lint:ui && npm test && npm run build && npm run check:layout && npm run check:render`.

## Hard rules

- **Never commit secrets.** No `.dev.vars`, `.env`, API keys, `AI_MASTER_KEY`, Cloudflare tokens.
- **Never commit real user data.** No rows from the remote D1, no real chats, no beta events.
  Tests and screenshots use synthetic data.
- **Never edit a migration that is on the default branch.** Add the next free number in
  `worker/migrations/` ([risky-changes.md](docs/guides/risky-changes.md#d1-migrations)).
- **Never hand-edit generated output** (`src/lib/content/strokes.json`, `kanji-strokes.json`,
  `static/wasm/*`). Change the source and run the builder script.
- **Do not merge or deploy** unless Job (or the coordinator relaying him) asks for that PR or deploy.
- **Never `pkill`.** Stop what you started by PID.
- **Keep the free plan.** Only the paths in `run_worker_first` (`wrangler.jsonc`: `/api/*`, and
  `/_app/*` so a missing build file gets a real 404) run Worker code; every other static file is
  served without it. Do not widen that list without asking. See `docs/PLAN.md` §8.1.

## Code conventions

- **Offline first.** Learning works with no network; progress lives in IndexedDB
  (`src/lib/db/idb.ts`) and syncs through `/api/sync`. A network failure is a normal state, not an error.
- **Persisted shapes are versioned.** Bump `VERSION` in `idb.ts` with an upgrade step when a store
  changes. Bump `CONSENT_VERSION` in `src/lib/beta/contract.ts` when consent text changes.
- **Every user-facing string goes through `t()`** (`src/lib/i18n/`), with an English key in `en.ts`
  and a Thai entry in `th.ts`. Built-in lesson content needs Thai in `content.th.ts`
  (`i18n.test.ts` fails without it). Code, comments, logs and docs are in English.
- **UI uses the design system**: tokens in `src/lib/design/tokens.css`, components from
  `#lib/ui/index.ts`; check `/design` before making a new component. Spacing (padding, margin,
  gap) is always `var(--space-*)`: `npm run lint:ui` fails otherwise, and a Claude Code hook
  (`.claude/settings.json`) runs the same lint after every edit. A deliberate exception carries
  `/* ui-ok: reason */` on its line.
- **Kit only, and the kit is the storybook.** Every control and card in the app comes from
  `#lib/ui` (no raw `<button>`, `<input>`, `<select>`, `<textarea>`, no hand-made `.btn`/`.glass`), and
  every component in `src/lib/ui` is exported and shown on `/design`. Missing a component? Add it to
  the kit and to `/design` in the same PR. A field and its button share a `FieldRow`.
- **The user always knows the state.** Loading shows a `Skeleton` or `Spinner`; an action shows
  `busy` on its button; errors say what to do next. `npm run lint:ui` (`scripts/check-ui.mjs`) and
  the hook enforce both rules; a deliberate exception carries `ui-ok: reason` on its line.
- **The server decides.** AI calls, sign-up mode, consent and admin access are enforced in the
  Worker; a hidden button is not a check.
- **API keys never leave the Worker in clear.** They are encrypted with `AI_MASTER_KEY`
  (`worker/crypto.ts`) and never logged or sent to beta telemetry.
- **Tests assert the behaviour we want**, never the presence of a workaround. Never skip or delete
  a test to get green.
- **Blast radius.** Before changing a shared pattern (a store, a token, a route shape), search for
  every use and list it in the plan.

## Git and PRs

- One branch and one PR per task, from the latest default branch. Open PRs as drafts.
- Fill in the PR template: plan, impact, the gate output, screenshots for UI.
- Keep a PR mergeable on its own; never stack on another open PR.
- Marking a PR ready starts the automated review: do it once, when the PR is finished.
- Update the docs in the same PR when you change a route, table, store, setting, command or rule,
  including the matching row in [docs/map.md](docs/map.md).
- Durable knowledge: fixes and gotchas go in [lessons.md](docs/guides/lessons.md); the design of a
  feature goes in its `docs/*.md`.
