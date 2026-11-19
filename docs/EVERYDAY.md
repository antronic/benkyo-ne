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
  `user_cards.seen_json` (migration 0019); the Worker refuses a malformed one.
- **Recording.** `words.see(ids, via, ctx)` adds a sighting (`src/lib/words/phrasebook.ts`
  `addSighting`). The same card from the same place within 10 minutes counts once, so re-reading a
  photo does not inflate it. The card maker records every word a photo finds that you already have,
  the top hit of a look-up, and the cards you save from either. Scenario packs do not count.
- **Screen.** Words gets a third view, **Phrasebook**: your own cards (and pack cards you met),
  ranked by sightings in the last 30 days, then all time, then newest. Filters: All, From photos,
  Look-ups, From my writing. A card's sheet shows **Where you met it**.
- The Writing helper will record `writing` sightings for phrases it fixes.
