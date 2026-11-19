# Personal notes (phase 1 of notes and community)

The full plan (shared notes, packs, tips, blog, moderation) is the
[Notes and community plan](https://claude.ai/artifact/FS32YVZu5N4LfRUgVvESzA). This file describes what
is built.

## What it does

Every study item can carry one private note, written by you and seen only by you.

| Item | Subject | Where the note shows |
| --- | --- | --- |
| Word or phrase card | the card id, `word:<id>` / `phrase:<id>` | Words card sheet, reading pack (after reveal), Review (after you answer) |
| Kana | `kana:<char>` | Kana chart detail, Review (after you answer) |
| Kanji | `kanji:<char>` | Kanji lesson Meet step, Review (after you answer) |
| Course or AI lesson unit | `unit:<course>/<unit>` | Top of the unit screen |

`lesson:` and `pack:` subjects are reserved for later screens and already accepted by the Worker.

- **NoteCard** (`src/lib/components/NoteCard.svelte`, on `/design`): saves on this device as you type
  (700 ms after the last key, and on blur or Done). Emptying a note deletes it. In Review it is a
  "My note" button (`peek`) that only appears after you answer and only when there is a note, so
  it never gives the answer away.
- **Words → Notes**: a Cards / Notes switch lists every note with search. Tapping a card's note
  opens the card; other notes open in a sheet, with a link to the unit when there is one.
- Notes are capped at 4,000 characters (`NOTE_MAX` in `src/lib/notes/contract.ts`).

## Storage and sync

- Device: IndexedDB store `notes` (key `subject`), added in `VERSION` 3 of `src/lib/db/idb.ts`.
  State: `src/lib/state/notes.svelte.ts`, loaded at boot with the cards.
- Server: D1 table `user_notes` (migration `0013_user_notes.sql`), on the same sync store as
  `user_cards`. `POST /api/sync` takes `notes` + `notesCursor` and returns changed notes, newest
  edit wins (`worker/notes.ts`). A deleted note is a tombstone with an empty body.
- Older clients that send no `notes` get no `notes` back.
- An old sync key's notes move into the account when the key is claimed. Account deletion removes
  them with the rest of the synced progress (`deleteSyncStatements`).
- Notes are not beta usage data and are not sent to telemetry.
