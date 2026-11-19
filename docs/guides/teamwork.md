# Teamwork: planning, splitting, handing off, reporting and PRs

Benkyo is built by Job with several Claude threads in one project: a coordinator in the project
chat, and one thread per task. This guide is how to work in that team.

## The idea

Parallel threads are fast only when they **cannot collide**. So:

- One thread owns a task and its files until its PR merges.
- Shared things change in small, separate PRs and are announced: design tokens and `src/lib/ui`,
  `src/lib/i18n/en.ts`/`th.ts`, `src/lib/db/idb.ts`, `src/lib/ai/contract.ts`, `worker/http.ts`,
  `worker/env.ts`, `wrangler*.jsonc`, `worker/migrations/`.
- Job decides what the product does; the coordinator relays his go for merges and deploys.

## The plan lives in the PR

Before coding a non-trivial change, write the plan into the draft PR body (the template has these
headings). It is what Job and other threads read. Take every name from the file that defines it.
Write "none", never leave a line empty.

```md
## Plan: <task, in the person's words>
- Scope: <what this PR does> / Not in scope: <what it leaves out>
- Files: <paths>
- Shared things touched: <tokens, ui kit, i18n keys, idb stores, AI contract, wrangler config> or none
- API routes: <added | changed | removed> or none
- Migration: <worker/migrations/NNNN_name.sql> or none
- Impact: <what else uses these; which journeys pass through them; how I checked each>
- Config and secrets: <new or changed names in worker/env.ts> or none
- Done when: <the check anyone can run>
- Needs Job's go: <step> or none
```

If the plan changes while you build, update the PR body and tell the threads that depend on it.

## Splitting work

1. **Split by files, not by step.** Each piece gets files nobody else touches.
2. **Fix the boundary first.** Agree the API shape (`src/lib/ai/contract.ts`, the route's request
   and response) before the client and Worker sides are built in parallel.
3. **Make each piece mergeable alone.** Every PR branches from the default branch and never stacks
   on another open PR. A feature that is not finished hides behind a setting or stays unlinked.
4. **Give each piece a done-check.**
5. **Append-only shared lists.** When two PRs add i18n keys or migrations, conflicts should be
   "keep both"; take the next free migration number at merge time.

## Handing work to another thread or agent

The other agent knows only what you write. A good brief has:

| Part | Example |
| --- | --- |
| The goal and why | "Thai learners can't see the Review button on a 390 px iPhone" |
| What is already decided | "Use the existing `Button` from `#lib/ui`; no new token" |
| Files it owns | "`src/routes/review/`" |
| Files it must not touch | "`src/lib/design/tokens.css` (shared)" |
| The done-check | "Gate green; Playwright screenshot in Thai at 390 px shows the button" |
| What to read | The PR or doc link, not a retyped copy |
| What needs Job's go | "Do not mark the PR ready, do not deploy" |

- Pass Job's words on exactly. Your message is not his go.
- Hand over the evidence and the question, not your conclusion to confirm.
- A reviewer must not share the author's model: say the author model in the brief.

## Reviewers

A reviewer agent costs a lot and the automated PR review spends Job's quota. Use one only when it
buys something the gate cannot: auth and passkeys, admin access and step-up, API key encryption,
AI spend caps and the ledger, beta data and consent, a migration, or a large cross-area diff.
Run it once, at the end, after your own gate passes; treat its findings as told and check each
against the code.

## Working with Job

Job builds Benkyo mostly alone, often reads on his phone, and comes back hours later.

- **Lead with the outcome or the one thing you need from him.**
- **Do not ask what you can find out** from the repo, the docs or project memory.
- **Ask once, with a recommendation.** Then keep working on what does not depend on the answer.
- **Show it.** Screenshots for every UI change, in project files, attached to the reply.
- **Give exact commands**, copied from `package.json`, in the order to run them.
- **Be honest about bad news, early.**

## PRs

- Branch from the latest default branch, one task per PR, opened as a draft.
- Fill in `.github/pull_request_template.md`: plan, impact, gate output, screenshots.
- Merge the default branch in to stay current; never rebase or force-push a branch someone else uses.
- Mark ready once, when finished (it starts the automated review). Job, or the coordinator on his
  behalf, merges.
- After merge, a deploy is a separate step that needs its own go
  ([risky-changes.md](risky-changes.md#steps-that-need-jobs-go)).

## What good team behaviour looks like

| Do | Do not |
| --- | --- |
| Announce a change to a shared file | Change a token or a store "because it was one line" |
| Build against the agreed API shape with a fake | Stack your PR on someone's open PR |
| Report "failed at step 3" | Report "mostly done" |
| List a problem outside your task as a follow-up | Fix it silently in your PR, or ignore it |
| Leave the workspace as you found it | Leave a dev server or a temp config behind |
