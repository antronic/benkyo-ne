# Content feedback

Learners rate what the app teaches with a thumb up or down and can report a
problem with it. Job reads both in Fleet → Feedback and fixes the content.
Asked for by Job on 2026-11-19 ("in each lesson/word add thumb up/down + report
the content").

## Where it shows

`ContentFeedback.svelte` (shown on `/design`, with a made-up API):

| Screen | Subject | Form |
| --- | --- | --- |
| Kana chart, a kana's sheet | `kana:あ` | bar |
| Kana lesson, done screen | `lesson:<id>` | bar |
| Kanji lesson, each kanji in Meet; done screen | `kanji:日`, `lesson:<id>` | bar |
| Course unit (under My note) | `unit:<course>/<unit>` | bar |
| Course unit and level unit word rows | the card id (`word:…`, `phrase:…`) | compact ••• |
| Level unit: each grammar point; end of the unit | `grammar:<id>`, `unit:<id>` | bar |
| Kanji gallery page | `kanji:日` | bar |
| Words → a card's sheet | the card id | bar |

Subjects reuse the note ids (`src/lib/notes/contract.ts`), plus `grammar:`
(`FEEDBACK_SUBJECT_RE` in `src/lib/feedback/contract.ts`), so a note, a vote and
a report on the same word line up.

The bar: "Helpful?" 👍 👎 and ⚑ Report a problem, which opens the form in
place (so it also works inside a sheet). Compact: one ••• button for a list row
that opens the same choices in a sheet. A thumb down opens the report form,
since it usually means something is off. Tapping the lit thumb takes the vote
back. Report reasons: a mistake in the Japanese, the English or Thai is off,
reading or sound is wrong, hard to understand, something else, plus an
optional note (500 characters). The learner's interface language goes with the
report, so Job knows which translation they saw.

Signed out, a tap says to sign in from Settings: votes need an account so one
person counts once, and the server decides (a hidden bar is not a check).

## Server

| Route | What |
| --- | --- |
| `GET /api/feedback/mine` | your votes, `{votes: {subject: 1 \| -1}}` (newest 5000) |
| `POST /api/feedback/vote {subject, label, vote}` | 1, -1, or 0 to take it back |
| `POST /api/feedback/report {subject, label, reason, detail, locale}` | one open report per person per subject (409 `already_reported`) |
| `GET /api/admin/feedback` | totals, the 100 subjects with the most open reports then thumbs down, the 100 oldest open reports |
| `POST /api/admin/feedback/report {id, status}` | `fixed`, `dismissed` or `open`; audited as `feedback.<status>` |

Tables (migration `0019_content_feedback.sql`): `content_votes` (one row per
subject and account) and `content_reports`. `label` is what the learner saw the
item called, kept only for Fleet. Limits per account per day: 500 votes, 30
reports (`FEEDBACK_LIMITS`). The daily cron deletes reports handled more than
180 days ago. Deleting an account deletes its votes and reports
(`accountDataStatements`).

The client keeps your votes in memory (`src/lib/state/feedback.svelte.ts`),
loaded once per account. A vote lights at once and goes back, with a toast, if
the server refuses it (offline, signed out, rate limited).
