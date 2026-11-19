# Level courses (JLPT N5 to N1)

Units that take a learner from N5 to N1: kanji, words, grammar and reading, level by level. The plan
behind it (scope per level, effort, sources and licences) is the Claude Doc "Benkyo: Plan to fill
the N5–N1 content gap", and the licence research is in the project files
(`content-research/reports/Open Japanese content sources.md`).

## What a unit is

One `LevelUnit` (`src/lib/content/levels/types.ts`):

| Part | Size | Where the facts come from |
| --- | --- | --- |
| Kanji | 2–5 new kanji of the unit's level | The unit names them; meaning and readings come from KANJIDIC2 at run time (`@johnmorrisdotca/jisho/kanji`) |
| Words | 10–15 | Written in the unit; the tests check each against JMdict with its reading |
| Grammar | 3 points, 5 examples each | Written in the unit (pattern, formation, meaning, note, examples in EN and TH) |
| Reading | 4–8 lines and 2–3 questions | Written in the unit |
| Review | who checked the Japanese and the Thai, and when | Filled in by the reviewer |

Every text a learner reads is stored as `{ en, th }`, so Thai lives beside the English instead of in
`content.th.ts`.

The JLPT level of a kanji is Jonathan Waller's list (tanos.co.uk), which the jisho package carries
under CC BY ("use anything here however you like (commercial or non-commercial), but credit my
site", his "Use my data!" page). The unit screen credits it, and KANJIDIC2, on the screen.

## Screens

- **Learn**: a "📗 JLPT N5" section and filter chip. A unit card shows its kanji, a Draft badge,
  and for Thai readers an "AI Thai" badge while the Thai is unchecked. Tick when done.
- **Unit** (`/learn/level/[unit]`): kanji with readings, grammar with examples and 🔊, the reading
  with a translation toggle and questions, then the words with "Add to my cards" and "Mark unit
  done".
- **Test out** (`/learn/level/[unit]/test`): three questions (`src/lib/practice/testOut.ts`): read a
  unit word written in kanji, the meaning of a unit word, the meaning of an example sentence. All
  right: the unit is done and its words go into the learner's cards, graded Good (as the kana
  placement check does). One wrong: the unit opens as usual.

## Drafts and review

A unit whose `review.ja` is null is a **draft**. Drafts are hidden from learners unless they turn
on **Settings → Show draft units** (`showDraftUnits`, off by default), and they carry a Draft
badge and a notice on the unit screen. When the reviewed units of a level are none, Learn says how
many units are written and points to the setting.

To publish a unit, a reviewer checks it and sets `review.ja` (and `review.th` for Thai) to
`{ by, on: 'YYYY-MM-DD' }`. `levels.test.ts` fails a review without a name or a date.

## Checks (`src/lib/content/levels/levels.test.ts`, part of `npm test`)

- ids are unique and start with the level; each unit has its parts (3 grammar points of 5 examples)
- the unit's kanji are of its level (Waller) and in KANJIDIC2; no kanji or word is taught twice
- every word is in JMdict with that reading
- Japanese lines use only kanji of the unit's level or below, or ones the kanji lessons teach;
  anything harder is written in kana
- every English text has Thai; reading answers point at a choice; choices are distinct
- Test out builds three answerable questions for every unit

## Adding units

1. Draft the unit in `src/lib/content/levels/<level>.ts` (AI drafts are fine), `review` null,
   `source: 'ai-draft YYYY-MM-DD'`.
2. `npm test` until `levels.test.ts` passes.
3. Bump `planned` in `LEVELS` only if the plan changes.
4. Review, then fill `review`.

A new level is one more entry in `LEVELS` (`src/lib/content/levels/index.ts`) with its own file,
loaded on demand so the app bundle does not grow with it.

## Status

| Level | Planned units | Written | Reviewed |
| --- | --- | --- | --- |
| N5 | 27 | 6 (n5-01 to n5-06) | 0 |
| N4–N1 | 30, 43, 63, 77 | 0 | 0 |

Not yet built: tracing for the new kanji (the kanji lessons' TRACE needs `build:strokes` for them),
the onboarding level picker, a local review page, and recorded audio (🔊 uses the device voice).
