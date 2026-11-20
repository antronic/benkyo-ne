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

## Browse

The **Browse** row at the top of Learn opens:

- **Kanji** (`/learn/browse/kanji`): every kanji the app teaches (the kanji lessons, then the level
  units' kanji) in one grid, filtered by lessons or level and searched by meaning or reading
  (`src/lib/content/kanjiIndex.ts`). A kanji page (`/learn/browse/kanji/[char]`) plays the strokes
  (the origin picture first for lesson kanji), then **Trace** or **Write** from memory with the
  handwriting check, and lists the lesson or unit that teaches it and the unit words that use it.
  Facts are KANJIDIC2; nothing AI-written shows unless the unit is visible.
- **Grammar** (`/learn/browse/grammar`): every grammar point of the visible units, searchable; a row
  opens the point in its unit (`#<grammar id>`).
- **Kana** and **Words** link to their tabs.

Stroke data for the level kanji is `src/lib/content/level-kanji-strokes.json`, made by
`npm run build:strokes` (KanjiVG, CC BY-SA 3.0) for every level kanji not already in the kanji
lessons. It is a separate chunk loaded by `loadLevelStrokes()` before a screen draws those kanji.
Add a level to `LEVEL_KANJI` in `scripts/build-strokes.mjs` when its units are written.

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
- every word is in JMdict with that reading; a word written in kana finds the kana entry (いつ alone
  finds 五), and no two words of a level are the same entry (they would be one card)
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
| N5 | 27 | 27 (n5-01 to n5-27) | 0 |
| N4–N1 | 30, 43, 63, 77 | 0 | 0 |

### N5 units

All 27 are AI drafts waiting for review. Kanji: all 79 N5 kanji on Waller's list, each taught once.

| Unit | Title | Kanji | Grammar |
| --- | --- | --- | --- |
| n5-01 | Nice to meet you | 名 前 生 | 〜は〜です, 〜じゃありません, 〜か |
| n5-02 | This and that | 何 語 国 | これ・それ・あれ, この・その・あの, 〜の〜 |
| n5-03 | Where is it? | 右 左 外 | ここ・そこ・あそこ・どこ, あります・います, 〜に〜があります |
| n5-04 | Time and prices | 時 半 円 午 百 | 〜時・〜時半, いくらですか・〜円, 〜から〜まで |
| n5-05 | Everyday verbs | 行 来 食 見 | 〜ます・〜ません, 〜を〜ます, 〜へ行きます |
| n5-06 | What I did | 今 毎 年 | 〜ました・〜ませんでした, 〜に (time), 〜で〜ます |
| n5-07 | Counting things | 一 二 三 四 五 | 〜つ, 〜をください, 〜と〜 |
| n5-08 | People and ages | 六 七 八 九 十 | 〜人（にん）, 〜さい, 〜も |
| n5-09 | Shopping | 千 万 高 | 〜いです・〜くないです, 〜がほしいです, 〜だけ |
| n5-10 | Making plans | 火 水 木 金 土 | 〜ませんか, 〜ましょう, 〜と（いっしょに） |
| n5-11 | Dates and birthdays | 日 月 先 | 〜月〜日, いつ, 〜ね・〜よ |
| n5-12 | My family | 父 母 子 男 女 | 父・お父さん, 〜や〜（など）, だれが・何が |
| n5-13 | Describing places | 大 小 長 | 〜です・〜じゃないです（な-adjective）, A-い N・A-な N, あまり〜ない |
| n5-14 | The weather | 天 気 雨 | 〜かったです・〜でした, 〜でしょう, 〜から（reason） |
| n5-15 | School and likes | 学 校 友 | 〜が好きです・〜がきらいです, 〜が上手です・〜がへたです, 〜が、〜 |
| n5-16 | Asking the way | 東 西 南 北 | 〜を（through）, 〜て、〜, 〜てください |
| n5-17 | Going out and coming in | 出 入 休 | 〜を出ます, 〜に入ります, 〜てから |
| n5-18 | On the phone | 電 話 | 〜ています（now）, 〜ています（state）, もう・まだ |
| n5-19 | Rules at the library | 書 読 聞 | 〜てもいいです, 〜てはいけません, 〜に行きます（purpose） |
| n5-20 | Talking with friends | 上 下 | dictionary form, ない form, 〜ないでください |
| n5-21 | Before and after | 後 間 | た form, 〜前に, 〜後で |
| n5-22 | When I was a child | 中 | 〜とき, 〜時間・〜か月・〜年（ぐらい）, 〜がわかります・〜ができます |
| n5-23 | Comparing things | 山 川 | 〜より, どちらが〜・〜のほうが, 〜の中で〜が一番 |
| n5-24 | Colours and changes | 白 | 〜くなる・〜になる, 〜くて・〜で, 〜く・〜に + verb |
| n5-25 | Getting around | 車 | 〜で（means）, 〜にのる・〜をおりる, どうやって |
| n5-26 | What I want to do | 本 | 〜たいです, どうして・なぜ, 何も・だれも・どこへも + negative |
| n5-27 | A summer festival | 人 | ぜんぜん〜ない, 何か・どこか・だれか, それから・でも・だから |

The onboarding level picker is built (docs/EVERYDAY.md, "I use Japanese every day"). Not yet built: a local review page, and recorded audio (🔊 uses the device voice).
