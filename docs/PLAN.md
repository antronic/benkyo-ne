# Benkyo-ne — Product & Learning Plan

A Japanese-learning PWA that works offline, runs on Cloudflare's free tier, and
teaches with spaced repetition, mnemonics and animated stroke order.

This is the plan behind the code. The decisions it makes are reflected in the
`src/` and `worker/` folders.

---

## 1. Who it's for and what "done" means

**Learner:** an adult beginner with 10–20 minutes a day, mostly on a phone,
often offline (train, plane).

**Outcomes by stage:**

| Stage | Goal | Rough time at 15 min/day |
|---|---|---|
| 0. Kana | Read & write all hiragana + katakana | 3–4 weeks |
| 1. Survival | 300 words, です/ます sentences, numbers, time | +6 weeks |
| 2. N5 | ~800 words, ~100 kanji, N5 grammar, read short dialogues | +4 months |
| 3. N4 | ~1,500 words, ~300 kanji, plain form, te-form chains | +6 months |
| 4. Reading | Graded readers, sentence mining, N3 path | ongoing |

The app measures success in **retention** (did you still know it 30 days later?),
not streaks or XP. Streaks exist, but they are secondary.

---

## 2. Curriculum

### Stage 0 — Kana (built in v0.1)

Hiragana first, then katakana. Each lesson introduces **one row of about 5
characters**. That is about the limit of working memory for new items
(Cowan, 4±1). The Y/W/ん lesson has 6 because those rows are short.

| # | Lesson | Characters | Notes |
|---|---|---|---|
| H1 | Vowels | あいうえお | the whole system rests on these |
| H2 | K-row | かきくけこ | |
| H3 | S-row | さしすせそ | し = *shi* (exception) |
| H4 | T-row | たちつてと | ち *chi*, つ *tsu* |
| H5 | N-row | なにぬねの | |
| H6 | H-row | はひふへほ | ふ *fu* |
| H7 | M-row | まみむめも | |
| H8 | Y/W + ん | やゆよわをん | を is a particle, read "o" |
| H9 | R-row | らりるれろ | |
| H10–H14 | G, Z, D, B, P rows | が… ざ… だ… ば… ぱ… | the ゛/゜ rule is taught once in the lesson intro; each mnemonic is "base + mark" |
| — | Combos | きゃ しゅ ちょ… | yōon, v0.2 |
| — | Small っ & long vowels | | v0.2 |
| K1–K14 | Katakana | same order | taught *against* hiragana: カ↔か |

**Confusable pairs** are taught as contrasts after both members are known:
さ/ち, ぬ/め, ね/れ/わ, る/ろ, シ/ツ, ソ/ン, ク/ケ/タ. The app makes
dedicated "spot the difference" drills from these pairs (`confusables.ts`).

### Stage 1 — Survival Japanese

Teach whole phrases before taking them apart. Each unit is built around one
situation:

1. Greetings & self-introduction — はじめまして、〜です
2. Numbers 1–100, prices — いくらですか
3. Time & days — 〜時、〜曜日
4. Ordering food — 〜をください
5. Directions — 〜はどこですか
6. Likes — 〜が好きです

Each unit has **8–12 words, 2 grammar points and 1 short dialogue**, with audio.

### Stage 2–3 — JLPT N5 / N4

- **Vocabulary** in frequency order, not textbook order.
- **Kanji** are taught *before* the words that use them, as components → kanji
  → words. Example: 木 → 林 → 森 → 森林. Radicals get mnemonic names.
- **Grammar** as patterns with many examples (pattern → 5 example sentences
  → you produce one), not as rules to memorise.

### Stage 4 — Reading & input

Graded readers, then sentence mining: tap an unknown word in a text to send it
to your deck with its sentence. This is where the WASM tokenizer earns its
place (see §7).

---

## 3. The lesson loop (teaching technique)

Each lesson runs the same five steps. The order matters: each step makes the
recall needed a bit harder than the last. This is **desirable difficulty**.

```
 1. MEET      →  2. TRACE     →  3. RECOGNISE  →  4. RECALL    →  5. SCHEDULE
 mnemonic        draw over       pick 1 of 4      type / draw      into FSRS deck
 picture +       animated        (receptive)      from memory      review tomorrow
 stroke anim     guide                            (productive)
```

| Step | Technique | Why |
|---|---|---|
| Meet | **Dual coding**: picture + sound + shape together | two memory traces instead of one |
| Meet | **Elaborative encoding**: a mnemonic story | links new to known |
| Trace | **Motor encoding**: you draw it with your finger | drawing beats re-reading |
| Recognise | **Retrieval practice**, easy version | early success sustains motivation |
| Recognise | **Interleaving**: distractors from earlier rows | forces you to discriminate, not pattern-match |
| Recall | **Generation effect**: produce the answer | the strongest learning event |
| Recall | **Immediate corrective feedback** | wrong answers fixed within seconds |
| Schedule | **Spaced repetition (FSRS)** | reviews just before you'd forget |

Other teaching rules used throughout:

- **i + 1**: each sentence has at most one unknown element.
- **Worked example → faded example → independent**: grammar shows a full
  sentence, then a sentence with a gap, then a blank prompt.
- **Errors are information**: a wrong answer brings the card back sooner in
  the session (a learning step) and shows the confusable side by side.
- **Session shape**: reviews first, then new items, then a short mixed
  round to finish on a success.
- **Daily caps**: by default 10 new items a day. FSRS review load grows with
  the number of new items, and too many leads to burnout.

---

## 4. Memory techniques

| Technique | How the app uses it |
|---|---|
| **Pictographic mnemonics** | an SVG scene with the kana *inside* it: く = a beak, し = a fish hook, つ = a tsunami wave. The picture fades away over the first reviews (§5.2). |
| **Story / keyword method** | one sentence linking shape → sound: "**Ko**-ko the two worms (こ)". |
| **Component stacking** (kanji) | 休 = 人 person + 木 tree → "a person resting against a tree". |
| **Minimal pairs** | confusables drilled side by side with the distinguishing stroke highlighted. |
| **Chunking** | kana in rows, words in themes, grammar as phrases. |
| **Spacing** | FSRS with 90 % target retention (user-adjustable 80–95 %). |
| **Testing over re-reading** | every screen asks you something; there is no passive "study" mode. |
| **Sleep consolidation** | new items are capped and reviewed again the next day, not in a marathon. |
| **Shadowing** (stage 1+) | play audio → you repeat → compare. |

### 4.1 Mnemonic fading

Leaving the mnemonic on screen forever creates dependence on it.

**v0.1:** lessons show the full picture; reviews show the bare character, with
the picture and story behind a 💡 Hint button (using it grades the answer
*Hard*).

**v0.2:** a graded fade driven by FSRS stability:

| Stability | Card shows |
|---|---|
| < 1 day | full mnemonic picture + character |
| 1–7 days | faint picture, character dominant |
| > 7 days | character only; picture available on tap ("hint") |

Using the hint counts as a *Hard* rating.

---

## 5. Efficient learning engine

### 5.1 FSRS scheduling

The app uses **FSRS-5** (Free Spaced Repetition Scheduler), the algorithm
Anki now ships, with the 19 default parameters. It tracks three numbers per card:

- **Difficulty** `D` (1–10)
- **Stability** `S`: days until recall probability falls to 90 %
- **Retrievability** `R = (1 + F·t/S)^-0.5`, the predicted chance you remember it right now

The next interval is chosen so that `R` reaches the target retention on the
due date. Implementation: `src/lib/srs/fsrs.ts`, with tests in
`src/lib/srs/fsrs.test.ts`.

Later: fit the parameters to each user's own review log once they have about
1,000 reviews. The fitting runs on the user's device; see §7.

### 5.2 Grading without self-assessment

Beginners rate themselves badly. The app **infers** the grade instead:

| Signal | Grade |
|---|---|
| wrong | Again (1) |
| right, used a hint or > 8 s | Hard (2) |
| right, normal speed | Good (3) |
| right, < 2 s, no hesitation | Easy (4) |

Drawing and typing are slower than tapping, so their times are scaled down
before grading. A kana's **first** review (at the end of the lesson that
introduced it) is capped at *Good*. A character met minutes ago should go
through the 1 / 10-minute learning steps, never jump straight to a
multi-week interval.

### 5.3 Harder questions as memory strengthens

v0.1 keeps one card per kana, but the question gets harder as FSRS stability
grows. This is desirable difficulty applied automatically:

| Card | Question |
|---|---|
| learning / relearning, or stability < 3 days | `kana → pick romaji` (recognition) |
| stability 3–21 days | `kana → type romaji` (cued recall) |
| stability > 21 days | `romaji + audio → draw kana` (production, graded by the WASM matcher) |

v0.2 adds a separate `audio → kana` listening card.

---

## 6. Visual & motion design: "iOS 27" direction

Apple hasn't published an iOS 27 design spec, so this is an interpretation that
extends the **Liquid Glass** language Apple introduced in iOS 26. The tokens are
in `src/app.css`.

### 6.1 Principles

1. **Content is the hero**: the character is the largest thing on screen,
   and the chrome (tab bar, toolbars) is translucent glass floating above it.
2. **Material over colour**: surfaces are frosted glass
   (`backdrop-filter: blur() saturate()`) with a specular top edge and a soft
   inner glow, not flat cards.
3. **Depth with meaning**: what you're focused on comes forward (scale +
   shadow); what's done recedes (blur + dim).
4. **Springs, not easings**: every movement uses a spring
   (`svelte/motion` `Spring`, or CSS `linear()` spring curves), so a gesture
   can be interrupted midway.
5. **Respect the user**: `prefers-reduced-motion` swaps motion for cross-fades;
   `prefers-color-scheme` provides true dark mode; text scales with Dynamic Type
   (rem-based).

### 6.2 Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | warm paper `#f6f4ef` | ink `#0b0b0f` |
| `--glass` | `rgb(255 255 255 / .55)` | `rgb(40 40 48 / .45)` |
| `--accent` | 朱 vermilion `#e8432e` | `#ff6a55` |
| `--accent-2` | 藍 indigo `#3b5bdb` | `#7b93ff` |
| `--success` | matcha `#34a853` | `#5fd17a` |
| radii | 14 / 22 / 32 (continuous-corner look) | |
| type | SF Pro / system-ui; kana in `"Hiragino Sans", "Noto Sans JP"` | |

### 6.3 Motion spec

| Moment | Motion |
|---|---|
| Page change | View Transitions API: shared-element morph of the lesson card into the lesson screen; fallback is a fade + 0.96 → 1 scale |
| Flashcard reveal | 3D flip (rotateY) with a spring, stiffness .12 / damping .6 |
| Correct | card lifts, matcha glow ring pulses, light haptic (`navigator.vibrate(8)`) |
| Wrong | horizontal shake (spring), confusable slides in from below |
| Stroke order | each stroke drawn with `stroke-dashoffset`, its length scaled to duration, a brush dot travelling at the tip, numbered start points |
| Progress ring | animated arc driven by `Spring` |
| Tab bar | floating glass capsule; the active pill moves between tabs on a spring |
| Background | slow-drifting blurred colour fields (CSS only, paused when the tab is hidden) |

### 6.4 SVG as a learning tool

- **Stroke-order SVGs** come from **KanjiVG** (CC BY-SA 3.0), extracted at
  build time into `src/lib/content/strokes.json` by `scripts/build-strokes.mjs`.
  The same data is used for the animation, the tracing guide and the
  handwriting matcher.
- **Mnemonic SVGs** are hand-authored scenes (`src/lib/content/mnemonics.ts`).
  Each one draws the scene with the real KanjiVG strokes on top, so the
  learner sees the character *become* the picture. The first two rows are
  done; the rest of the set is listed in the roadmap.
- **Confusable diff SVG**: two glyphs overlaid, with the differing stroke
  highlighted in the accent colour.

---

## 7. Where WASM is used, and where it isn't

WASM is used only where it measurably helps:

| Task | Decision | Reason |
|---|---|---|
| FSRS scheduling | **JS** | a few floating-point operations per card; WASM's call overhead would cost more than it saves |
| Handwriting matching (draw → which kana?) | **WASM (Rust)** ✅ built | resampling + DTW against about 200 templates × strokes on every pen-up; tight numeric loops, and it must run in under 16 ms on low-end phones. JS fallback included. |
| Japanese tokenizer for sentence mining (stage 4) | **WASM** (planned: lindera / vibrato compiled to wasm) | dictionary-based morphological analysis; there's no good pure-JS option at this speed |
| FSRS parameter optimiser | **WASM** (planned: `fsrs-rs` compiled to wasm) | gradient descent over thousands of reviews, run on the device so the review log stays private |
| UI, state, sync | **JS / Svelte** | the DOM is JS-native |

The Rust source is in `wasm/stroke/`. The compiled `static/wasm/stroke.wasm` is
committed, so a Cloudflare build doesn't need a Rust toolchain.

---

## 8. Architecture on Cloudflare (free tier)

```
            ┌──────────────── Browser (PWA) ────────────────┐
            │ Svelte UI ── IndexedDB (cards, review log)     │
            │      │            ▲                            │
            │      ▼            │ local-first: works offline │
            │ Service Worker: precache app shell + content   │
            │      │  background sync of review log          │
            └──────┼─────────────────────────────────────────┘
                   │ HTTPS
            ┌──────▼──────── Cloudflare Worker ──────────────┐
            │ Static Assets (free, unlimited requests)        │
            │ /api/sync   → D1 (user progress, review log)    │
            │ /api/content→ KV + Cache API (content manifest) │
            │ /audio/*    → R2 (recorded audio, phase 2)      │
            └─────────────────────────────────────────────────┘
```

### 8.1 Free-tier budget

Limits change, so check Cloudflare's pricing pages before launch. The numbers
below are the free allowances at the time of writing.

| Service | Free allowance | How we stay inside it |
|---|---|---|
| Workers static assets | requests free & unlimited | the whole app shell is static assets; most traffic never touches a Worker |
| Workers | 100k requests/day, 10 ms CPU | only `/api/*` runs code; sync is batched (1 request per session, not per review) |
| D1 | 5 GB, 5M rows read / 100k rows written per day | review logs are batched; one sync of a 50-card session writes about 51 rows |
| KV | 100k reads / **1k writes** per day | used only for the content manifest; never for user data |
| Cache API | free | API GETs cached at the edge |
| R2 (phase 2) | 10 GB, zero egress fees | audio files, cached forever by the service worker |

At ~51 writes per active user per day, D1's write limit supports roughly
**1,500–2,000 daily active users** before any paid plan is needed.

### 8.2 Data model (D1)

See `worker/migrations/0001_init.sql`.

- `users(id, sync_key_hash, created_at)`: anonymous by default; you get a
  sync key (shown as a QR code later) and can add a passkey in phase 2
- `cards(user_id, card_id, state, due, stability, difficulty, reps, lapses, last_review, updated_at)`
- `review_log(user_id, id, card_id, grade, reviewed_at, elapsed_days, duration_ms)`

### 8.3 Offline & sync strategy

- **Local-first**: IndexedDB is the source of truth on the device. The app
  works with no account and no network.
- **Append-only review log**: sync pushes the log entries the server hasn't
  seen. Card state is *derived* from the log, so two devices can't produce
  conflicting card states; replaying the merged log gives the same result.
- **Service worker** (`src/service-worker.ts`):
  - app shell + build assets: precached and versioned per deploy
  - content JSON: stale-while-revalidate
  - `/api/*`: network-only. Unsynced log entries stay flagged in IndexedDB
    and are pushed when the app opens, comes back online, or is sent to the
    background (`src/lib/sync.ts`)
  - audio: cache-first, so it is fetched once and kept

---

## 9. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **v0.1** | 28 kana lessons (hiragana + katakana incl. dakuten), stroke animation, tracing with per-stroke checks, WASM matcher, FSRS reviews with escalating question types, confusable distractors, offline PWA, Worker + D1 sync, iOS-style UI with dark mode | ✅ built |
| v0.2 | Mnemonic SVG scenes for all 92 kana (10 done), yōon + small っ lessons, dedicated confusable drills, listening cards, graded mnemonic fading | next |
| v0.3 | Stage 1 survival units, recorded audio in R2, shadowing mode | |
| v0.4 | Kanji with radical decomposition, N5 vocab (frequency order), passkey accounts | |
| v0.5 | Per-user FSRS optimiser (WASM), stats screen (retention curve, forecast) | |
| v1.0 | Graded reader + tokenizer (WASM), sentence mining, N4 | |

---

## 10. Licensing of content

- **KanjiVG** stroke data: © Ulrich Apel, CC BY-SA 3.0. Attribution is shown in
  the Settings → About screen; the derived `strokes.json` stays under CC BY-SA.
- **FSRS** algorithm: open (MIT reference implementations); ours is an
  independent TypeScript port.
- Future vocab: JMdict/EDICT (CC BY-SA 4.0, EDRDG licence). Tatoeba sentences:
  CC BY 2.0 FR.
