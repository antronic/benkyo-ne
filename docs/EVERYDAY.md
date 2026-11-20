# Everyday Japanese (draft)

Status: **design draft, not in the app.** Job approved the look on 2026-11-19. The screens are in the
Design Studio ("Everyday Japanese · draft") and the reusable pieces are on `/design` under
"Draft · Everyday Japanese". Nothing below is wired into a screen yet.

## Who it is for

People who already use Japanese every day (at work, at home, online) and need practice, not
beginner lessons. Many are Thai speakers working with Japanese companies.

## Getting to advanced content (no quiz gate)

1. First-run gets a fourth level, "I use Japanese every day", then **Pick your level**: one sample
   sentence per JLPT level (N5 to N1); the learner picks the hardest one they can read. A short
   check is offered, never required.
2. Learn opens at that level with a level switch at the top. Grammar, kanji, keigo, reading and
   domain packs at that level are all open; lower levels become review only.
3. Every unit has **Test out**: 3 questions, all right marks it done, one wrong and it is studied.
4. Today shows the next unit at the learner's level and suggests moving up at 80% done.

The N3 to N1 units do not exist yet; they are the content work in the experienced-learner plan.

## Features and what they reuse

| Feature | Reuses | Phase |
| --- | --- | --- |
| Personal phrasebook: every word looked up, captured from a photo or fixed in the Writing helper, ranked by how often it comes up | photo reader (`src/lib/words/maker.ts`, vision), dictionary check, Words, notes, review | E1 |
| Writing helper: politeness check and a more natural version of a message, with Kuri's reason and a Thai note | managed AI allowance or own key, Kuri, second-language explanations | E1 |
| Pick your level + test out | onboarding questions (`src/lib/onboarding/`), placement scoring (`src/lib/practice/placement.ts`) | E1 |
| Kanji you keep forgetting: weekly set from misreads and failed handwriting | FSRS lapses, handwriting matcher, kanji strokes, `InkPad` | E2 |
| Weekly report: read, wrote, saved, minutes a day, one weak spot with a 5 minute drill | review log, Today cards, `StatTile`, `BarChart`, Kuri | E2 |
| Domain packs: IT, office, medical, hotel, anime; known words skipped | topic courses, community shared packs | E3 |

## Draft kit components

`PolitenessMeter`, `MarkedText`, `KanjiTile`, `SpeechBubble` (see [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)).
Everything else in the drafts is built from existing kit components (`ListRow` with `selected`,
`Segmented`, `Badge`, `StatTile`, `BarChart`, `Card`).

## Built: personal phrasebook (E1)

- **Data.** Each card carries `seen` (`UserCard.seen` in `src/lib/ai/contract.ts`): a total count
  and the last 10 sightings (`at`, `via`, `ctx`). `via` is `photo`, `lookup`, `writing` or `add`;
  `ctx` is the look-up text or the message, up to 300 characters. It syncs in
  `user_cards.seen_json` (migration 0021); the Worker refuses a malformed one.
- **Recording.** `words.see(ids, via, ctx)` adds a sighting (`src/lib/words/phrasebook.ts`
  `addSighting`). The same card from the same place within 10 minutes counts once, so re-reading a
  photo does not inflate it. The card maker records every word a photo finds that you already have,
  the top hit of a look-up, and the cards you save from either. Scenario packs do not count.
- **Screen.** Words gets a third view, **Phrasebook**: your own cards (and pack cards you met),
  ranked by sightings in the last 30 days, then all time, then newest. Filters: All, From photos,
  Look-ups, From my writing. A card's sheet shows **Where you met it**.
- The Writing helper will record `writing` sightings for phrases it fixes.

## Built: Writing helper (E1)

- **Where.** AI tab › Writing helper (`/ai/write`). Pick who it is for (friend, colleague, boss,
  customer; remembered on the device), paste the message, tap Check.
- **AI.** `POST /api/ai/write` (`WriteRequest` → `WriteResponse` in `src/lib/ai/contract.ts`),
  prompt `WRITE_SYSTEM` in `src/lib/ai/prompts.ts`. It runs on the **Suggestions** model (feature
  `propose`), like Ask AI, so it uses the package allowance or the learner's own key with no new
  model slot or migration. The validator keeps only changes whose `from` is in the message and
  whose `to` is in the rewrite, and phrases that appear in the rewrite.
- **Screen.** `PolitenessMeter` (the message's level against `WRITE_TARGET` for the person),
  `MarkedText` with the edits in place (`markChanges` in `src/lib/words/writing.ts`) or the clean
  suggestion, Kuri's verdict in a `SpeechBubble` (with the second language), each change with its
  reason, Copy, and **Save phrases**: the phrases become cards with a `writing` sighting, so they
  rank in the phrasebook. A phrase the dictionary doesn't know keeps the same card id each time.
- Not yet: the "same pattern" sheet and Practise this pattern from the draft.

## Built: "I use Japanese every day" in onboarding (E1)

- The level question has a fourth answer, **I use Japanese every day** (`Level` `'daily'` in
  `src/lib/onboarding/plan.ts`). It adds one more page, **Pick your level**: one sample sentence
  per JLPT level (`JLPT_PICKS`), and the learner taps the hardest one they can read. No quiz.
- The plan: test out of hiragana and katakana (2 minutes each, so words saved from photos are not
  parked), **Your level: N3** (Learn opens at that level when it has units: the Learn filter is set
  on the device; otherwise the step says the units are being written), **Your phrasebook and
  Writing helper**, then minutes a day. `Answers.jlpt` is stored with the profile.
- The Today plan card ticks the level step when a unit of that level is done, and the phrasebook
  step when any word has come up (a sighting).
- **Moving up.** Once 80% of the units you can see in the hardest level you've started are done
  (`levelUp` in `src/lib/practice/levelUp.ts`), Today shows **Next level**: *Go to N4* opens
  Learn at that level, or, while its units are still being written, it says so. **Not now** hides
  that suggestion on the device (localStorage `benkyo.levelUp`).

## Built: kanji you keep forgetting (E2)

- **The set.** `forgottenKanji` in `src/lib/practice/forgetting.ts` reads the last 7 days: a
  kanji card or a word with kanji graded Again is a **misread** (each kanji in the word counts),
  and a kanji drawn wrong from memory is **couldn't write**. An Again within 5 seconds of a write
  slip for the same kanji counts once, as the write slip. At most 12, most slips first.
- **Data.** Misreads come from the review log (`logs`). Write slips are recorded by the review
  screen and kept on the device only, in `meta` key `kanjiWriteSlips` (last 60 days, no sync and
  no migration). `src/lib/state/forgetting.svelte.ts` loads both.
- **Screen.** Learn › Practice shows the week's set as `KanjiTile`s (red dots for misreads, blue
  for couldn't write) and a 🧠 drill, `/review?practice=forgetting`: each kanji card in the set,
  always written from memory with `RecallPad`, plus the word cards written with those kanji.
  As with the other drills, cards that aren't due keep their schedule.

## Built: weekly report (E2)

- **Where.** `/week`, from a **Your week** card on Today (shown once the last 7 days have any
  review, saved card, check or read). Back goes to Today.
- **Numbers** (`weekReport` in `src/lib/report/week.ts`, the 7 local days ending today):
  **Read** = distinct photos and look-ups among the cards' sightings; **Wrote** = messages the
  Writing helper checked; **Saved** = your own cards made this week (not pack cards); **Minutes a
  day** = review time from the log (`durationMs`), in a `BarChart` with translated labels.
- **One thing to work on**, first that applies: a person you write to where at least 2 checked
  messages, and at least half, were off (→ Writing helper); else this week's forgotten kanji
  (→ the 🧠 drill); else the cards you missed (→ Weakest first). Kuri sums up the week in a
  `SpeechBubble`, and **5 minute practice** opens the drill.
- **Data.** Writing helper checks are kept on the device only, in `meta` key `writeChecks`
  (`{at, to, gap}`, last 60 days); `src/lib/state/week.svelte.ts` records and loads them. No sync,
  no migration.
