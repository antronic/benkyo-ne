# Working carefully: the loop for every task

For an AI agent doing day-to-day work on Benkyo, especially a smaller model. It does not assume
judgment. Follow the steps in order, every task, even a small one.

Why so strict: Benkyo holds learners' progress, passkeys, encrypted API keys and beta data, several
threads work on it at once, and Job reads results hours later, often on his phone. A wrong "done"
costs more than a slow "done".

Related: [risky-changes.md](risky-changes.md) for migrations, data, secrets and deploys, and
[lessons.md](lessons.md) for mistakes this project already made.

## The loop

| Step | What you do | You may move on when |
| --- | --- | --- |
| 1. Understand | Restate the task in one or two sentences | You can name the done-check |
| 2. Read | Read the files that own the thing you will change | You have opened them, not remembered them |
| 3. Plan | List the files you will touch, what else uses them, and the checks you will run | You know the impact and no guess is left |
| 4. Change | Make the smallest change that does the task | The diff contains nothing else |
| 5. Verify | Run the gate and the flow, and read the output | You saw it pass yourself |
| 6. Report | Say what happened, with evidence | Failures and skipped steps are stated |
| 7. Clean up | Stop and delete what you started | Nothing of yours is still running |

## 1. Understand the task

Write down, before any code:

- **What is asked**, in your own words.
- **The done-check**: the command or observation that proves it works ("on a 390 px iPhone in Thai,
  the Review screen shows the new button and grading still saves").
- **What is not asked.** Do not fix, rename or tidy things outside the task. Mention them in your
  report as follow-ups.

If the task can be read two ways and both are cheap to undo, pick the likelier one and say which
you picked. If one reading touches anything in [risky-changes.md](risky-changes.md), ask first.

## 2. Read before you write

Read in this order. Stop when you have what the task needs.

1. [AGENTS.md](../../AGENTS.md): hard rules, conventions, commands.
2. [map.md](../map.md): what the change touches.
3. The feature's design doc in `docs/` (`PLAN.md`, `AI-PLAN.md`, `BETA-DATA.md`, `DESIGN-SYSTEM.md`,
   `FLEET.md`, `ONBOARDING.md`, `KURI.md`, `SIGN-IN-WITH-APPLE.md`).
4. The code itself, and one existing example of the same kind of change: a screen next to yours in
   `src/routes/`, a Worker module next to yours in `worker/`, a component in `src/lib/ui/`.

### Never guess a name

A command, script, route, table, column, setting, secret name, i18n key or store name must come
from the file that defines it:

| You need | Read it from |
| --- | --- |
| A script | `package.json` `scripts` |
| A Worker binding, secret or var | `worker/env.ts`, `wrangler.jsonc` (and `wrangler.embedded.jsonc`) |
| An API route | `worker/index.ts` and the module's `routes.ts` (`worker/{ai,admin,beta}/routes.ts`, `worker/auth/passkey.ts`) |
| A D1 table or column | `worker/migrations/*.sql` (latest file that touches it) |
| An AI request or response shape | `src/lib/ai/contract.ts`, `worker/ai/types.ts` |
| An IndexedDB store | `src/lib/db/idb.ts` |
| A UI string key | `src/lib/i18n/en.ts` |
| A design token or component | `src/lib/design/tokens.css`, `src/lib/ui/index.ts`, the `/design` page |
| A lesson, kana or kanji id | `src/lib/content/*.ts` |
| A beta event kind or consent version | `src/lib/beta/contract.ts` |

If you cannot find it, say "I could not find where X is defined". Do not write a likely-looking value.

## 3. Plan

A few lines of plan cost far less than a wrong start. Do not edit while the plan still contains a guess.

Put the plan in the PR body (the template has the headings). For a one-line fix, a sentence is enough.

### Check the impact

No change is local. Answer these four:

1. **What else uses it?** The route, table, store, component, token or string. Look it up in
   [map.md](../map.md), then confirm with a bounded search (`grep -rn <name> src worker | head -40`).
2. **Which journeys pass through it?** A new learner (intro, onboarding, first lesson), a returning
   learner (Today, review, sync), an AI user (key, cap, ask), a Thai learner, Job in `/admin`;
   signed in and signed out; online and offline; phone, iPad, iPhone Duo and desktop.
3. **What could break for each?** Think of the other callers, not only the one in your task.
4. **How will I check each one?** A unit test, a Playwright walk, a screenshot.

A fix is done when the whole journey works, not when the reported symptom is gone.

Start from the latest default branch, never from another open PR:

```sh
git fetch origin claude/japanese-learning-pwa-hrznwf
git switch -c <your-branch> FETCH_HEAD
```

## 4. Change

- Keep the diff to the task. One concern per PR.
- Copy the existing pattern: `#lib/ui` components and tokens for UI, `t()` for strings, the
  `worker/http.ts` helpers for responses, a new numbered file for schema.
- Change the code, the tests and the docs (including [map.md](../map.md)) in the same PR.
- Do not weaken a check to get past it. No skipped tests, no `any` or `as unknown as` to silence
  the type checker without a test, no deleted assertion. If a check is wrong, say so and ask.
- Show errors as they are. Do not turn one status into another or invent a message.

## 5. Verify

| You changed | Run |
| --- | --- |
| Anything | The gate: `npm ci && npm run check && npm test && npm run build` |
| Worker code | The module's `*.test.ts`, and for a flow: `npm run build && npm run db:migrate:local && npx wrangler dev --port 8787 --infer-origin-from-routes=false`, then call the route |
| A migration | The steps in [risky-changes.md](risky-changes.md#d1-migrations) |
| A screen or component | Walk the flow in Playwright at 390 px, 768 px and 1280 px, light and dark, English and Thai; save screenshots under `/mnt/project-files/<topic>/` |
| UI strings | `npm test` (runs `src/lib/i18n/i18n.test.ts`); look at the Thai screen for clipping |
| Passkey sign-up or sign-in | Playwright with CDP `WebAuthn.addVirtualAuthenticator` against `wrangler dev` |
| Strokes or WASM | `npm run build:strokes` or `npm run build:wasm`, then the handwriting tests |
| Docs or these guides | Check every link and command you wrote against the file that defines it |

Rules for verifying:

- **Read the output.** Exit code 0 with an error in the log is a failure. A run that stopped
  halfway is a failure.
- **Check the real thing.** `svelte-check` alone is not enough for UI. Open the screen.
- **Check you are looking at the new build.** A dev server or `vite preview` left running serves
  old code, and `vite preview` crashes when you rebuild under it: restart it.
- **Skip the intro in screenshots** by setting IndexedDB `meta/introSeen` (and `kuriIntroSeen`) to
  `true` before loading the screen.
- If you could not run a check, say so. "Not verified" is an acceptable answer. A guess written as
  a fact is not.

## Shell rules

- **Every command gets a timeout**: quick ones 10 to 30 s, installs and builds 120 to 300 s, test
  suites up to 600 s. Wrap with `timeout <N>s` where it may hang.
- **Forever processes never run in the foreground**: `npm run dev`, `vite preview`, `wrangler dev`,
  any `--watch`. Background them with a PID file:
  `nohup <cmd> > /tmp/<name>.log 2>&1 & echo $! > /tmp/<name>.pid`, and stop them by that PID.
- **Bound the output.** Send logs to `/tmp/<name>.log` and read them with `tail -n 120` or `grep`.
- **Set `CI=true`** for tests and builds.
- **Large files:** check the size before reading `docs/AI-PLAN.md`, `docs/PLAN.md`,
  `src/lib/content/*.json` or `package-lock.json`, and read only the part you need.

## 6. Report

Lead with the outcome. Use these words exactly:

| Word | Means |
| --- | --- |
| **Done** | The done-check passed and you saw it |
| **Done, not verified** | The change is made; say which check you could not run and why |
| **Failed** | Say at which step, and paste the error line |
| **Blocked** | Say exactly what you need, and from whom |

- Attach screenshots for UI.
- Never paste a secret, a token, or a learner's details into a reply, a PR, a commit or a log.
- A PR is "ready" only when it is out of draft, contains the default branch and the gate passed on its head.

## 7. Clean up

Leave nothing behind, in the cloud and on Job's Mac:

```sh
git status --short                                  # stray files
ls /tmp/*.pid 2>/dev/null                           # servers you started
```

- Stop every dev server, preview and `wrangler dev` **you** started, by PID. Never `pkill`.
- Delete temporary Playwright configs, scratch scripts and build output you made outside `build/`.
- Leave Job's own processes and folders alone. If you cannot tell whose it is, ask.

## Stop and ask

Stop and ask, rather than continue, when:

- The step cannot be undone or reaches outside the repo
  ([the list](risky-changes.md#steps-that-need-jobs-go)).
- A migration that is already on the default branch looks wrong.
- Two sources disagree (a doc and the code, two threads) and you cannot check which is right.
- A check fails and you do not understand why after one honest attempt.
- You would have to guess a value that matters (a price, a limit, legal wording, a Thai translation
  of consent text).

Ask once, with the exact action, its target and what you already checked. Then carry on with
anything that does not depend on the answer.
