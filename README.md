<div align="center">

# 勉強ね · Benkyo-ne

**Learn to read and write Japanese, one kana at a time.**

An offline-first Japanese-learning PWA with animated stroke order, picture mnemonics,
handwriting checked in WebAssembly, FSRS spaced repetition and a bring-your-own-key AI tutor.

[![Live](https://img.shields.io/badge/live-benkyo.jirachai.me-e8432e?style=for-the-badge)](https://benkyo.jirachai.me)

![Svelte 5](https://img.shields.io/badge/Svelte_5-SvelteKit_3-ff3e00?logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Rust → WASM](https://img.shields.io/badge/Rust-WebAssembly-654ff0?logo=webassembly&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers_·_D1_·_KV-f38020?logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8?logo=pwa&logoColor=white)
![FSRS-5](https://img.shields.io/badge/scheduler-FSRS--5-2ea44f)

[Features](#-features) · [Docs](#-documentation) · [Stack](#-tech-stack) · [Develop](#-develop) · [Deploy](#-deploy-to-cloudflare) · [Layout](#-project-layout)

</div>

---

## ✨ Features

### 🧠 Learning

| | |
|---|---|
| ✍️ **Stroke order** | Every kana writes itself with animated SVG strokes from KanjiVG. |
| 🖼️ **Picture mnemonics** | All 92 basic kana have a story and a drawn scene behind the glyph (keyword method + dual coding). |
| 🎯 **Handwriting check** | Draw on the screen; a Rust matcher compiled to WebAssembly checks shape, order and direction. |
| 🔁 **Spaced repetition** | FSRS-5 schedules every card; grades are inferred from how you answered. |
| 🧭 **Courses** | Fundamentals, Travel, Make friends and Japanglish (with a live English → katakana converter). |
| 🔤 **Romaji everywhere** | Small grey romaji under Japanese text, hidden where it would give the answer away. |

### 🤖 AI tutor (bring your own key)

| | |
|---|---|
| 💬 **Ask AI** | A Japanese tutor chat. Answers **stream in as they're written**, with tappable spoken examples. |
| 🕘 **Chat history** | Every conversation is saved on the device. Search, reopen, continue, swipe to delete. |
| 🃏 **Card maker** | Make word cards from English, Japanese, romaji, a screenshot or a scenario; AI names the pack. |
| 📚 **Lesson packs** | Describe a topic and get a short lesson unit of words and phrases. |
| 👥 **Accounts with passkeys** | Anyone can sign up with a name and a passkey (Face ID / Touch ID): no password, no email. |
| 🔐 **Your keys, your cap** | Each account brings its own Anthropic or OpenAI-compatible key, encrypted and bound to that account, with its own monthly spend cap. |

### 📱 Feels like iOS

- **Liquid Glass look**, large titles, springy transitions and a liquid, glittering progress ring.
- **iOS behaviour too:** edge swipe-back, draggable sheets, action sheets, haptics and keyboard-aware layouts.
- **Optimised for the foldable iPhone Duo:** adaptive layouts, plus a side tab rail under the battery when the status bar sits on the right.
- **Splash screen, a 3D first-launch introduction** (replayable from Settings) and an in-app update banner.

---

## 📖 Documentation

| Doc | What's inside |
|---|---|
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | A tour of the app and how the iOS-style UI and UX are built. |
| [`docs/PLAN.md`](docs/PLAN.md) | The learning design: curriculum, memory techniques, visuals, architecture, free-tier budget. |
| [`docs/AI-PLAN.md`](docs/AI-PLAN.md) | The AI design: BYOK, passkeys, spend cap, prompts, decisions, and the multi-user plan. |

---

## 🧱 Tech stack

| Layer | Tech |
|---|---|
| 🎨 **UI** | Svelte 5 (runes) + SvelteKit 3, static SPA via `adapter-static` |
| 📴 **Offline** | Service worker (`src/service-worker/`), IndexedDB, local-first |
| 🗓️ **Scheduling** | FSRS-5 in TypeScript (`src/lib/srs/fsrs.ts`) |
| ✍️ **Handwriting** | Rust → `wasm32-unknown-unknown` (`wasm/stroke/`), with a JS fallback |
| 🖋️ **Stroke data** | KanjiVG (CC BY-SA 3.0), compiled by `scripts/build-strokes.mjs` |
| 📖 **Dictionary** | JMdict (English glosses), loaded lazily in chunks |
| ☁️ **Backend** | Cloudflare Worker (`worker/`) + D1 (sync, AI ledger) + KV / Cache API (content) |
| 🤖 **AI** | Anthropic SDK and OpenAI-compatible adapter, streamed over server-sent events |
| 🌐 **Hosting** | Workers Static Assets (free and unmetered) |

---

## 🛠️ Develop

```bash
npm install
npm run dev          # Vite dev server (UI only; /api not available)
npm test             # unit tests (FSRS, handwriting JS + WASM, AI prompts and parsers, …)
npm run check        # svelte-check / TypeScript
```

**Full stack locally** (Worker + local D1):

```bash
npm run build
npm run db:migrate:local
npx wrangler dev     # → http://localhost:8787
```

<details>
<summary><b>Regenerating derived assets</b> (optional: the outputs are committed)</summary>

```bash
npm run build:strokes   # re-download KanjiVG → src/lib/content/strokes.json
npm run build:wasm      # needs Rust + `rustup target add wasm32-unknown-unknown`
NODE_PATH=$(npm root -g) node scripts/build-icons.mjs   # PNG icons (needs Playwright)
```

</details>

---

## 🚀 Deploy to Cloudflare

Everything runs on the **free plan**. The resources already exist and their IDs are in
`wrangler.jsonc`: D1 `benkyo` (migrated) and KV `CONTENT`.

Live at **https://benkyo.jirachai.me** (Workers custom domain, configured in both wrangler configs).

### ⭐ Recommended: Workers Builds (deploy on every push)

No secrets live in GitHub.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**
   (or open the `benkyo-ne` Worker → **Settings → Builds → Connect**).
2. Pick GitHub → `antronic/benkyo-ne`.
3. Settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npm run cf:deploy` (applies D1 migrations, then deploys) |
   | Non-production deploy command | `npm run cf:preview` (preview URL, production untouched) |

4. Save. Every push to `main` goes live; other branches get preview URLs.

> [!IMPORTANT]
> Secrets: `AI_MASTER_KEY` (base64 of 32 random bytes) encrypts API keys.
> Optional: `SIGNUP_MODE=closed` stops new accounts (default: open sign-up).
> Optional: `APPLE_CLIENT_ID` (your Services ID) turns on Sign in with Apple beside passkeys.
> Setup: [docs/SIGN-IN-WITH-APPLE.md](docs/SIGN-IN-WITH-APPLE.md).

<details>
<summary><b>Manual deploy from your machine</b></summary>

```bash
npx wrangler login
npm run build && npm run cf:deploy
```

</details>

<details>
<summary><b>Script-only deploy</b> (when the asset upload can't run)</summary>

`npm run cf:deploy:embedded` bundles `build/` into the Worker script
(`worker/embedded.ts`, `wrangler.embedded.jsonc`) and deploys that. Use it where
Wrangler's asset upload can't run, for example behind a proxy that rewrites the
`Authorization` header. Static files then count as Worker requests (free plan:
100k/day). The next normal deploy switches back to free Static Assets under the
same Worker name and domain. It does **not** apply D1 migrations: run
`npx wrangler d1 migrations apply benkyo --remote` first.

</details>

> [!NOTE]
> Static assets are served without invoking the Worker. Only `/api/*` runs Worker code
> (`run_worker_first`), which keeps traffic inside the free request limits.
> See `docs/PLAN.md` §8.1 for the free-tier budget.

---

## 🗂️ Project layout

```text
docs/                        OVERVIEW · PLAN · AI-PLAN
src/routes/                  Today · Learn · Words · AI · Review · Kana · Settings
src/lib/components/          StrokeAnimator, TracePad, ProgressRing, Sheet, TabBar, Intro, Splash, …
src/lib/content/             kana, lessons, courses, mnemonics + SVG scenes, japanglish, strokes.json
src/lib/ai/                  API client, contract, prompts, validators, streaming format, chat threads
src/lib/srs/fsrs.ts          scheduler
src/lib/handwriting/         WASM loader + JS fallback
src/lib/state/               runes stores backed by IndexedDB
src/lib/ios/                 haptics, swipe-back, keyboard, action sheets, device insets
src/service-worker/          offline caching
wasm/stroke/                 Rust handwriting matcher
worker/                      Cloudflare Worker: sync, passkey accounts, AI proxy + ledger, D1 migrations
```

---

## 📜 Licences

- **Code:** MIT.
- **Stroke data** in `src/lib/content/strokes.json` is derived from
  [KanjiVG](https://kanjivg.tagaini.net) © Ulrich Apel, CC BY-SA 3.0.
- **Dictionary data** from JMdict © the Electronic Dictionary Research and Development Group, CC BY-SA 4.0.

<div align="center">

Made with 🍵 for learners · がんばってね！

</div>
