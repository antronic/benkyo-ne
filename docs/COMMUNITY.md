# Community notes (phase 2 of notes and community)

The plan with all four phases is the
[Notes and community plan](https://claude.ai/artifact/FS32YVZu5N4LfRUgVvESzA). Phase 1, private notes,
is in [NOTES.md](NOTES.md). This file describes phase 2 as built: sharing a note, likes, replies,
reports, blocks, the Translate button (文A) and the Fleet Community screen.

## What learners see

- **Community tab** (`/community`, `src/routes/community/+page.svelte`): the Community home. Every
  shared note on every item, **New** (newest first) or **Popular** (most liked in the last 30 days,
  `TOP_DAYS`), 20 at a time with Show more. Each note shows the item it is about; tapping it opens a
  sheet with your own note and all the shared notes on that item, where you can share yours.

- **Community notes** (`CommunityNotes.svelte`, on `/design`) sits under "My note" on the Words card
  sheet, the Kana detail, the kanji Meet step and course units. It lists notes other learners
  shared on the same item (same subject id, see NOTES.md), most liked first, three at a time.
- **Share my note** publishes a *copy* of your private note. The private note stays private; the
  shared copy only changes when you press **Update shared copy**, which shows once the two differ.
- The **first share** asks for a public handle (3 to 20 lowercase letters, digits, dots or
  underscores, `HANDLE_RE`) and the community guidelines, with a preview of exactly what goes public
  and the note's language (guessed from the text, `guessLang`). The account name is never shown.
- Each note or reply (`CommunityPost.svelte`) has a heart (one per person, the count is public),
  replies one level deep, and a ••• menu: Report (spam, harassment, wrong or misleading, sexual,
  other, with an optional detail), Block @handle, or Delete for your own.
- **文A Translate** (an icon button with no label; the tooltip and accessible name say "Translate")
  sits on someone else's note or reply when it is in another language than the interface (English
  or Thai) and AI is available. It translates with the learner's AI on the **Translate** model slot
  (Settings → AI), shows "Translated by AI", and pressing it again shows the original. Translations
  are kept on the device (`src/lib/community/translations.ts`, localStorage, newest 200, keyed by
  note, edit time and language), so the same note isn't paid for twice.
- **Settings → Community** (`CommunitySettings.svelte`) shows your handle and the people you
  blocked, with Unblock.
- Signed in only during the beta. Shared notes are fetched when an item opens and are not stored on
  the device; offline shows a notice with Retry.

## Rules the Worker enforces (`worker/community.ts`)

| Rule | Value |
| --- | --- |
| Handle and guidelines | Required before posting; `GUIDELINES_VERSION` bumped means everyone accepts again before their next post |
| Length | Notes 4,000 characters (`POST_MAX`), replies 1,000 (`REPLY_MAX`) |
| Rate limits per day | 10 notes, 30 replies, 20 reports, 5 handle changes; 3 notes and 10 replies for accounts under 3 days old (`LIMITS`) |
| Links | At most 2 per note or reply; links in replies only once the account is 7 days old |
| Blocked words | Spam and slurs in English, Thai and Japanese (`worker/communityWords.ts`), checked after folding case, spacing and look-alike digits |
| Auto-hide | 3 different people reporting a note or reply hides it until it is reviewed (`AUTO_HIDE_REPORTS`) |
| Who sees what | Others see published content by accounts that are not closed and not banned, minus people they blocked. The author sees their own content in any state with a "Hidden while it's reviewed" or "Removed by a moderator" badge |
| Closed accounts | "Delete account" disables the account (Job, 2026-11-19), so its notes and replies are hidden, not deleted |
| Fleet Delete | Erases the profile, posts (with the replies under them), replies, likes, reports and blocks (`communityDataStatements` in `worker/communityData.ts`) |
| Retention | Removed content is purged 90 days after removal; handled reports after 180 days (daily cron, `purgeCommunity`) |

Editing a shared note keeps the status a moderator gave it, so editing doesn't bring back a hidden note.

## Translate (`POST /api/ai/translate`)

- The request carries only `{kind, id, to}`; the Worker reads the text itself with the same
  visibility rule as above (`visibleText` in `worker/communityData.ts`), so a hidden, removed or
  blocked note can't be translated, and a note already in `to` is refused (400).
- It runs through the normal AI pipeline (`worker/ai/run.ts`: rate limits, cap or package allowance,
  ledger, beta usage data) on the `translate` feature. Default model: Haiku 5.5 on the learner's
  first Anthropic key (`TRANSLATE_MODEL` in `worker/ai/models.ts`); on a package, the model the
  console assigned to Translate, else the package's cheapest priced model.
- Migration `0015_translate_feature.sql` rebuilds `ai_feature_models` so its CHECK allows `translate`.

## Fleet console: Community (`/admin/community`, `worker/admin/community.ts`)

- Counts: open reports, hidden now, notes and replies this week, handles.
- The queue: every note or reply with an open report, oldest first, with the reports, a link to the
  author's account, and their history (posts and replies, how many removed, muted or banned).
- Actions: **Dismiss** (reports were wrong; a note the reports hid goes back up), **Hide**,
  **Restore**, **Remove** (passkey tap), **Mute author** (can read, can't post; passkey tap),
  **Ban author** (can't post, their content is hidden; passkey tap), **Let them post again**.
  Each is written to `admin_audit` as `community.*`.

## API and tables

| Route | Does |
| --- | --- |
| `GET /api/community/me` | your handle, status and whether you can post |
| `PUT /api/community/profile` | `{handle, guidelines}` |
| `GET /api/community/feed?sort=new\|top&before=` | the Community home, 20 a page (`Feed`) |
| `GET /api/community/subject?s=` | shared notes on one item, plus yours |
| `POST /api/community/posts` | share or update your note on an item |
| `GET`/`DELETE /api/community/posts/:id` | a note with its replies / delete yours |
| `POST /api/community/posts/:id/replies`, `DELETE /api/community/replies/:id` | reply / delete your reply |
| `POST /api/ai/translate` | `{kind, id, to}` → `{text, to}` (文A, see above) |
| `POST /api/community/like`, `/report`, `/block` | `{kind: 'post' \| 'reply', id, …}` |
| `GET /api/community/blocks`, `DELETE /api/community/blocks/:handle` | blocked people / unblock |
| `GET /api/admin/community`, `POST /api/admin/community/{content,author}` | Fleet queue and actions |

Tables (migration `0014_community.sql`): `community_profiles`, `community_posts` (one table for every
kind of post; phase 2 makes `note` only, one per person per item), `community_replies`,
`community_likes`, `community_reports`, `community_blocks`.

Not in phase 2: shared packs (phase 3), tips, blog, inbox and profiles pages
(phase 4). The beta privacy notice is unchanged: the guidelines shown before the first share say
what becomes public, how long it is kept and how to delete it.
