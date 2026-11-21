# Benkyo-ne (勉強ね): App Overview & Implementation

A Japanese-learning Progressive Web App for iPhone (optimised for the
foldable **iPhone Duo**). It runs fully offline, schedules reviews with
spaced repetition, teaches stroke order with animated SVG, checks
handwriting in WebAssembly, and adds optional AI help using your own API
key.

- **Live:** https://benkyo.jirachai.me
- **Repo branch:** `claude/japanese-learning-pwa-hrznwf`
- **Related docs:**
  - [`PLAN.md`](PLAN.md): the learning design and original architecture
  - [`AI-PLAN.md`](AI-PLAN.md): the AI decisions (D1–D24), wave 2 (multi-user, subscriptions)

---

## 1. What the app does

| Tab | Purpose |
|---|---|
| **Today** | Greeting, daily progress ring, streak, reviews due, new words ready, next lesson |
| **Learn** | Filter chips: **Fundamentals** (28 kana lessons), **Travel**, **Make friends**, **Japanglish**, **✨ My packs** (AI-made) |
| **Words** | Reading packs ("Words you can read"), your word/phrase cards, tags with drill, card details |
| **✨ AI** | Make a word card pack · Make a lesson pack · Ask AI (tutor chat) |
| **Review** | One session for kana, words and phrases; new cards introduced within a daily budget |
| **Kana** | Hiragana/katakana chart, tinted by how likely you are to recall each one; stroke animation + practice |
| **Settings** | Learning options, romaji, tab position, sync, AI (passkey, keys, models, cap, language), About |

---

## 2. Learning design

### The lesson loop
Each step makes recall harder than the last ("desirable difficulty"):

```
MEET → TRACE → RECOGNISE → RECALL → SCHEDULE
```

1. **Meet:** a mnemonic picture, the sound and an animated stroke order,
   together (dual coding).
2. **Trace:** each stroke is checked for position, shape and direction as
   you lift your finger.
3. **Recognise:** pick the reading out of 4. The wrong options come from
   look-alike kana (さ/ち, シ/ツ, ソ/ン), so you have to tell them apart.
4. **Recall:** draw the kana from memory, graded by the WASM matcher.
   - A **visual memory hint** (picture, story and a 2-second peek) is
     available; using it grades the answer *Hard*.
5. **Schedule:** the kana goes into the FSRS deck. Its first grade is
   capped at *Good*, so a new card always goes through the short learning
   steps first.

### Spaced repetition
- **Algorithm:** **FSRS-5** (the algorithm Anki uses), written in TypeScript.
  Target retention 80–95 %.
- **Grades are inferred,** not self-rated: wrong → Again; slow or used a
  hint → Hard; normal → Good; fast → Easy.
- **Questions get harder as a card gets stronger:**
  - learning cards: **pick** the answer
  - stability 3–21 days: **type** it
  - over 21 days: **draw** it (kana) or produce it (words).
- **Daily new-card order:**
  1. curriculum lessons
  2. cards you made or added from a course
  3. reading-pack words (at most 30 %)
- **Parking:** cards whose kana you can't read yet wait until you can,
  unless you choose **"Learn now with romaji"**.
- **Tag drills** (e.g. "Ramen Shop") practise cards early *without*
  rescheduling cards that aren't due, so FSRS intervals stay honest.

### Content
- **Kana:** 28 lessons covering hiragana and katakana, including the dakuten
  rows. Stroke data is from KanjiVG.
- **Courses:** 10 curated units, 69 items. Every item is checked against
  JMdict by an automated test.
- **Japanglish converter:** type an English word and see:
  - the real loanword from the dictionary;
  - a rule-based katakana guess, with the rules that applied
    (*bed → ベッド*: small ッ; *game → ゲーム*: silent e).
- **Romaji** appears in small grey text under Japanese across the app. It's
  hidden on questions where it would give the answer away, then revealed
  after you answer.

---

## 3. iOS UI: the look

The design interprets Apple's **Liquid Glass** language (iOS 26/27).

- **Materials:** frosted glass surfaces (`backdrop-filter: blur saturate`)
  with a specular top sheen and a soft inner edge. Slowly drifting colour
  fields sit behind the glass, tinted per screen.
- **Type:** the system font stack (SF Pro), with iOS sizes (17 px body,
  34 px large titles); Japanese in Hiragino / Noto Sans JP.
- **Colour tokens:** 朱 vermilion accent, 藍 indigo secondary, 抹茶 matcha
  success. Each is defined separately for light and dark mode.
- **Shapes:** continuous-looking corners (14/22/32 px), pill buttons and
  capsule segmented controls.
- **Motion:** springs, not ease curves, using CSS `linear()` spring
  approximations and Svelte `Spring`. Specifically:
  - page morphs with the View Transitions API
  - a 3D flip for flashcard answers
  - a shake on wrong answers, a matcha glow on correct ones
  - stroke drawing with a moving brush tip
- **Skeleton loading:** shimmering placeholders (row / card / tile / line)
  instead of spinners or blank screens.
- **Accessibility:**
  - Reduce Motion (springs become instant), Reduce Transparency (solid
    surfaces) and Dark Mode are respected.
  - VoiceOver labels on controls.
  - Every touch target is at least 44 pt, measured on the folded Duo.

---

## 4. iOS UX: the behaviour

Looking like iOS isn't enough; the app also behaves like iOS:

| iOS convention | Implementation |
|---|---|
| Edge swipe to go back | The page follows your finger with a shadow, completes on distance or flick velocity, otherwise springs back. Only in the installed app (Safari keeps its own gesture). |
| Don't lose work silently | Leaving a lesson part-way (swipe or ✕) shows an **action sheet**: *Leave Lesson* / *Cancel*. |
| Bottom sheets | Drag the grabber down; it rubber-bands upward, the backdrop fades with the drag, and it dismisses on distance or velocity. |
| Large titles | Collapse into a glass inline nav bar as you scroll. |
| Tab bar | Shrinks while you scroll down; tapping the active tab scrolls to top; **slides away (springs back) on immersive screens**. |
| Alerts & sheets | Custom action sheets (bottom on phone, centred when unfolded) instead of `window.confirm()`; HUD toasts. |
| Haptics on iPhone | iOS Safari has no Vibration API, so the app clicks a hidden native `<input switch>` (iOS 18+), which plays the system haptic. Android uses `navigator.vibrate`. |
| Keyboard | Romaji fields turn off autocorrect and capitalisation and use the right Enter key. The visual viewport is tracked, so inputs stay above the keyboard. |
| Updates | A new version downloads in the background; a **"New version available · Restart"** banner lets you choose when. It never reloads mid-lesson. |
| Audio | Short sounds like "あ" were being clipped: the app now waits briefly after cancelling, warms up the speech engine, speaks single kana slower with "。", and prefers Enhanced/Premium voices. |

---

## 5. iPhone Duo (foldable) support

The layout adapts to the **space available**, not the device model:

| Posture | Width (CSS px) | Layout |
|---|---|---|
| Folded | ~380–470 | Bottom tab bar, single column, bottom sheets |
| Unfolded | ~600–670 | **Side rail** navigation; two-pane lessons and reviews; kana chart + detail pane; two-column Today and Learn |
| Landscape | ~950 | Same, roomier |

- **Continuity:** folding or unfolding is just a resize. Lesson state and
  traced strokes survive it (tested by unfolding partway through tracing).
- **Hinge-aware:** panes snap to the Viewport Segments API
  (`env(viewport-segment-*)`) when the browser provides it, plus a Device
  Posture enhancement.
- **iOS 27 side status bar:**
  - The left and right safe-area insets are respected everywhere: nav bar,
    sheets, tab bar, overlays.
  - When a right-side status column is detected, the tab bar becomes a
    vertical icon rail **under the battery**.
  - Settings → Tab bar position: Auto / Bottom / Side.
- **Breakpoint:** 600 px, not the frameworks' default 640 px, because the
  unfolded screen can be narrower than 640.

---

## 6. AI features (bring your own key)

All AI is optional; every feature still works without it.

- **Your key, your Worker:** API keys are **AES-GCM encrypted in D1**. The
  app can write a key but never read it back; it only shows the last 4
  characters.
- **Passkey accounts** (Face ID / Touch ID). Anyone can create an account
  with just a name and a passkey; no password or email. Each account has its
  own API keys, model choices, prices, spending cap and usage, and the
  encrypted keys are bound to the account. A recovery code is shown once at
  sign-up. Settings → Account lists your passkeys and lets you add or remove
  them, make a new recovery code or delete the account. The session is an
  HttpOnly cookie.
- **Live model list:**
  - Models come from each provider's `/models` API (Anthropic,
    OpenAI-compatible).
  - Prices come from the provider (OpenRouter), then a built-in table,
    then a price you enter. A model with no price stays locked 🔒.
- **Spending cap:**
  - $5/month by default.
  - The Worker **reserves the worst-case cost before every call**, so
    spending can't go over the cap.
  - Every call is recorded with its actual cost, and there's a rate limit.
- **Features:**
  - **Card maker:**
    - Five modes: English, 日本語 (handles conjugation: 食べなかった →
      食べる), Romaji, Photo, Scenario.
    - In Scenario and Photo modes, the AI **names the pack** and the name
      becomes the cards' tag.
  - **Reading packs:** the dictionary picks real, beginner-friendly words
    written only in kana you know; the AI adds a theme, memory hooks and
    examples.
  - **Lesson packs:** the AI designs a unit around any topic, and it
    appears in Learn under ✨ My packs.
  - **Ask AI:** a tutor chat that knows your level and answers in both
    languages, with tappable examples. Answers stream in as they are
    written (server-sent events from the Worker; Stop keeps what was
    written). Every conversation is saved on the device as a thread: the
    History sheet groups them by day, searches titles and messages, and
    rows swipe left to delete. A word card (Words → tap a card, or a
    revealed word in a word pack → Ask AI about this word) opens a new chat about that word: the word, reading
    and meaning go to the Worker as `focus` (`AskRequest`), the chat shows
    an "About this word" card and word starters, and the thread keeps the
    focus for later questions. Back returns to where it was opened: Words,
    or the same word in the pack (`/words/pack/<id>?at=<n>`).
- **Accuracy:**
  - **Everything the AI writes in Japanese is checked against JMdict on
    the device.**
  - Examples with unknown words are dropped; items that can't be confirmed
    are marked "unverified".
  - Model output is validated against strict JSON schemas before use.
- **Bilingual:** English plus a second language you choose. Meanings are
  translated from the checked English meaning (the dictionary package is
  English-only).
- **Claude specifics:**
  - Calls use the official SDK, with structured outputs, prompt caching on
    a stable system prompt, and `effort: low`.
  - The refusal fallback is enabled, and `stop_reason` is always checked.

---

## 7. Architecture

```
iPhone (installed PWA)                         Cloudflare (free plan)
───────────────────────                        ──────────────────────
SvelteKit 3 / Svelte 5 SPA                     Worker  (benkyo.jirachai.me)
├─ IndexedDB: cards, review log, user cards,   ├─ static app (assets, or embedded build)
│  packs, outbox (local-first)                 ├─ /api/sync      D1: review log (append-only) + cards (LWW)
├─ Service worker: precache shell + common     ├─ /api/auth/*    passkeys, sessions, recovery
│  dictionary; lazy-cache the rest; updates    ├─ /api/ai/*      keys, models, prices, cap, propose/fill/lesson/ask(+stream)
├─ FSRS-5 scheduler (TS)                       └─ KV + Cache API: content manifest, model lists
├─ Handwriting matcher: Rust → WASM (22 KB), JS fallback
└─ Dictionary: JMdict via @johnmorrisdotca/jisho (lazy chunks)
```

- **Local-first:**
  - The device is the source of truth, so the app works fully offline.
  - Sync pushes an **append-only review log**, and card state is rebuilt by
    replaying it, so two devices can't produce conflicting card states.
  - Card content syncs alongside it (last write wins).
- **WASM where it pays:**
  - Handwriting matching (resampling + DTW + a direction check against
    ~140 templates) runs in Rust/WASM; scheduling stays in JS.
  - Stroke direction is checked explicitly, because DTW alone accepted
    short strokes drawn backwards.
- **Dictionary:**
  - 26k common words (≈2.5 MB) are precached for offline use.
  - The full JMdict (~1,700 lazily loaded pieces) is fetched on demand.
  - Lookup fallbacks never throw; they report `available: false` instead.
- **Deploys:**
  - Normal: `npm run cf:deploy` (D1 migrations + static assets), or Workers
    Builds on push.
  - Fallback: `cf:deploy:embedded` bundles the app into the Worker script,
    for networks that break the asset upload.

### Tech stack
SvelteKit 3 · Svelte 5 runes · Vite 8 · TypeScript · Rust (wasm32) ·
Cloudflare Workers, D1, KV, Cache API · Wrangler · @anthropic-ai/sdk ·
@simplewebauthn · JMdict (@johnmorrisdotca/jisho) · KanjiVG · Vitest ·
Playwright (end-to-end checks).

---

## 8. Quality & testing

- **Unit tests (148, Vitest):**
  - **FSRS:** maths, scheduling, and replaying a log reproduces the same card.
  - **Handwriting (JS and WASM):** recognition, reversed strokes, and both
    engines agree.
  - **Dictionary:** lookups, deinflection, readability rules, pack picks,
    offline fallbacks.
  - **Content and text:** course items exist in JMdict; romaji conversion;
    Japanglish rules.
  - **AI:** crypto round-trips, price resolution, cost/cap maths,
    prompt/schema/validator coverage.
- **Rust tests:** for the WASM matcher.
- **End-to-end (Playwright),** run during development:
  - full lessons, including drawing strokes;
  - reviews and two-device sync;
  - offline reload;
  - fold/unfold mid-lesson, swipe-back, sheet drag;
  - passkey registration with a virtual authenticator;
  - every AI flow, against a fake OpenAI-compatible provider;
  - update banner across two real builds;
  - tab-bar animation, measured frame by frame.
- **Static checks:** `svelte-check` passes with 0 errors and 0 warnings,
  and the Worker passes its TypeScript check.

**Not verifiable from the build environment:**
- a real Anthropic call
- Face ID passkeys on a real iPhone
- exactly how iOS 27.3 reports the side status bar to web apps
- the speech quality of each iOS voice

---

## 9. Project layout

```
docs/                 PLAN.md · AI-PLAN.md · OVERVIEW.md (this file)
src/routes/           Today · learn (+ lesson, course units) · words (+ maker, pack reader)
                      ai (hub, lesson builder, ask) · review · kana · settings
src/lib/components/   StrokeAnimator · TracePad · RecallPad · MnemonicHint · KanaGlyph · WordCardView
                      WordQuiz · Sheet · LargeTitle · TabBar · Overlays · UpdateBanner · Skeleton
                      Romaji · JapanglishConverter · AiSettings · ProgressRing · Backdrop
src/lib/ios/          haptics · gestures (swipe-back, keyboard) · overlay (sheets, toasts) · device (size classes, insets)
src/lib/srs/          fsrs.ts
src/lib/handwriting/  match.ts (WASM loader + JS fallback)
src/lib/dict/         readable · dict (lookup/verify) · packs (beginner word picks)
src/lib/content/      kana · lessons · mnemonics (+ SVG scenes) · confusables · courses · japanglish · romaji
src/lib/ai/           contract · client · prompts · validate · prices
src/lib/state/        progress · words · ai · lessonPacks · ui
src/lib/words/        maker (card pipeline, outbox) · packs (reading packs)
src/lib/pwa/          update (background updates + banner)
src/service-worker/   offline caching & update flow
wasm/stroke/          Rust handwriting matcher
worker/               Worker: sync, auth (passkeys), ai (models, ledger, adapters), embedded entry, migrations
scripts/              build-strokes · build-wasm · build-icons · embed-assets
```

---

## 10. Roadmap

| Next | Notes |
|---|---|
| Mnemonic pictures for the remaining 82 kana | 10 done (あ–こ) |
| Mistake tutor | Explains look-alike mix-ups using your review history |
| Recorded audio (R2) | Consistent sound quality beyond device text-to-speech |
| Kanji with radicals, N5 vocabulary | Stage 2 of the curriculum |
| **Wave 2:** multi-user + subscriptions | Open sign-up; passkey/email/Apple sign-in; Stripe + PromptPay (Thailand). Plus $4.99 / Pro $9.99 proposal; see AI-PLAN.md |
| Full dictionary on the live site | Connect Workers Builds (normal assets deploy) |

---

## 11. Licences & credits

- **Code:** MIT.
- **Stroke order:** KanjiVG, © Ulrich Apel, CC BY-SA 3.0.
- **Dictionary:** JMdict, © EDRDG, CC BY-SA 4.0. Example sentences from
  Tatoeba, CC BY 2.0 FR. Packaged by John Morris (`@johnmorrisdotca/jisho`,
  MIT).
- **Scheduling:** FSRS (open-spaced-repetition); ours is an independent
  TypeScript port.
