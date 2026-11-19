# Thinking: how to reason about a task, a problem and your own answer

How a careful engineer thinks on this project, written as steps a smaller model can follow. The
process around it is in [working-carefully.md](working-carefully.md).

The short version: **know what you know, check what you assume, and say which is which.**

## Three kinds of statement

Before you rely on anything, label it:

| Label | Means | Example |
| --- | --- | --- |
| **Seen** | You read or ran it in this task | "`wrangler.jsonc` binds D1 as `DB`" |
| **Told** | A doc, a memory note, a PR body or another agent says so | "the deploy yesterday applied migration 0009" |
| **Guessed** | It seems likely | "the i18n key is probably `review.done`" |

- Act on **seen**.
- Check **told** when it matters. Docs go stale: the README still says Workers Builds deploys from
  `main`, but the default branch is `claude/japanese-learning-pwa-hrznwf` and deploys run by hand.
  The code and the config win.
- Never act on **guessed** for a name, a number or a state. Turn it into seen, or ask.
- In a report, never write a guess in the voice of a fact. Write "I did not check" instead.

## Thinking about a task

Ask these in order. Write one line for each.

1. **Who is this for, and what do they do with the result?** A Thai learner on the bus with five
   minutes, a beginner on day one, someone who already reads kana, Job checking `/admin` at night.
2. **What is the goal behind the ask?** Solve the goal. If the ask and the goal pull apart, say so.
3. **What does done look like?** One check someone could run.
4. **What is the smallest thing that reaches it?** Do that. List the rest as follow-ups.
5. **What could this break?** Offline use, sync, a learner's saved progress (IndexedDB upgrade),
   sign-in, AI spend caps, the free-plan budget, Thai layout, Safari startup. If any, read
   [risky-changes.md](risky-changes.md).
6. **What do I not know?** List it. Find it, or ask.

## Problem solving

When something is broken, do not change code yet.

1. **Reproduce it.** Write the exact steps, device and browser, and what you saw. If you cannot
   reproduce it, say so. Safari on iPhone often differs from Chromium: use WebKit or the iOS
   simulator on Job's Mac when it matters.
2. **Read the error to the end.** The first line is often a symptom.
3. **List at least two explanations**, and for each, what you would see if it were true.
4. **Check the cheapest one first, on the real system.** A test, a local `wrangler dev` call, a
   count of beta `error` events (counts, not rows).
5. **Fix the cause, not the symptom.** Then walk the whole journey again, reads and writes.
6. **Record it** in [lessons.md](lessons.md) if the mistake could happen again.

## Two sources disagree

- A design doc and the code: the code is what runs; say which is wrong and fix the doc.
- Two threads: do not argue across threads. Check the real system, then report what you saw.
- A product choice: it is Job's. Ask once, with a recommendation.

## Deciding

When you have two options:

1. Prefer the one that keeps the app working offline and on the free plan.
2. Prefer the one that is easier to undo.
3. Prefer the one that follows an existing pattern in this repo.
4. Prefer the smaller diff.

If they are still equal, pick one, say why in one line, and go. Do not weigh the same two options twice.

## Checking your own answer

Before you report:

- Did I run the done-check, or do I only expect it to pass?
- Is every name in my report something I saw in a file?
- Did I walk the whole journey, or only the reported step?
- Is anything I said "told" that I wrote as "seen"?
