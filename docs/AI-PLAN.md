# Benkyo-ne — AI Assistance Plan (BYOK)

Status: **planned, not built.** Decisions below came out of a Q&A session on
2026-11-13. Each one lists the alternative that was rejected, so it can be
revisited later on purpose rather than by accident.

---

## 1. Decisions

| # | Question | Decision | Rejected alternative (and why it lost) |
|---|---|---|---|
| D1 | Audience | **Just me** | Public app: would need a free tier, quotas and abuse handling |
| D2 | Key custody | **Proxy through the Worker**. The key is stored server-side and every AI call goes via `/api/ai/*` | Device-only: simpler and nothing to leak server-side, but no server-side spend cap and the key has to be entered again on each device |
| D3 | Who may call `/api/ai` | **In-app passkey** (Face ID / Touch ID) → short-lived session token | Cloudflare Access: less code, but leaves the app for a sign-in page; reusing the sync key: one leak exposes both data and spend |
| D4 | Where provider keys live | **Encrypted in D1, set from the app** (AES-GCM, master key is a Worker secret) | `wrangler secret`: safer by default, but can't rotate from the phone |
| D5 | Providers | **Anthropic + OpenAI-compatible**. Cloud endpoints via the Worker; **local endpoints (Ollama / LM Studio) called directly from the browser** | Anthropic only: half the testing surface |
| D6 | First feature | **Content generator** | Mistake tutor: smaller and uses data the app already has (see §7, pushback) |
| D7 | Kana-stage content | **Real words written only with kana you know** | Free-form passages: break the i+1 rule |
| D8 | AI's role in packs | **Code picks the words (dictionary filter); the AI adds context**: example sentence, memory hook, theme | AI picks the words: you pay for picks that then get thrown away |
| D9 | Accuracy guard | **Bundled JMdict subset; every word must exist with that exact reading** | A second model reviewing: twice the cost, still probabilistic |
| D10 | SRS entry | **Auto-add verified words when you *finish* a pack**, within the daily new-card cap; overflow waits for tomorrow | Add at generation time: the deck would grow with prefetch, not reading |
| D11 | Offline | **Pre-generate packs** while online and cache them in IndexedDB | On demand only: nothing to read on the train |
| D12 | Spend guard | **$5 / month hard cap enforced by the Worker**, with a meter in Settings | No cap: a loop bug or leaked session could burn money |
| D13 | Default model | **Claude Sonnet 5.5** (`claude-sonnet-5-5`), changeable per feature | Opus 5.5 (2× the cost); Haiku 5.5 (cheapest, weaker on how natural the Japanese sounds) |

---

## 2. Architecture

```
 iPhone (PWA)                                      Cloudflare Worker                    Providers
 ─────────────                                     ─────────────────                    ─────────
 Passkey (Face ID) ──WebAuthn──▶ /api/auth/*  ──▶  verify (WebCrypto ES256) ─▶ session (D1)
                                                                │
 Packs UI ──Bearer session──▶ /api/ai/generate ──▶ auth ▶ spend cap ▶ provider adapter ──▶ Anthropic (Sonnet 5.5)
     ▲                                             │       (D1 ledger)  │                └▶ OpenAI-compatible
     │ cached packs (IndexedDB)                    │                    └ decrypt key (AES-GCM, master key = secret)
     │                                             ▼
     └──── JMdict subset (bundled, offline) ◀── verify words on device AND in Worker

 Local models (Ollama/LM Studio) ◀── called straight from the browser (no Worker; see §6 caveat)
```

### Why the dictionary runs on both sides

- **Worker:** rejects invalid output before it's billed into a pack or cached.
- **Device:** browser-direct local models bypass the Worker, so the same check
  must also run on the client.
- One module, `src/lib/dict/verify.ts`, is shared by both.

---

## 3. Security model (just me, but the key is real money)

| Threat | Mitigation |
|---|---|
| Someone finds `/api/ai/*` and spends your money | Passkey-only sessions. No password exists to phish. Session tokens are random 256-bit values, stored hashed in D1, last 12 h, and are bound to the passkey that created them |
| Database leak exposes provider keys | Keys AES-GCM encrypted with `AI_MASTER_KEY` (a Worker secret, never in D1 or the repo). The app can **write** a key but never read it back; it only sees `sk-…last4` |
| Runaway loop or bug | $5/month hard cap checked **before** every call, using the worst case (`max_tokens` × output price). Per-request `max_tokens` ceiling. Max 30 AI calls per minute per session |
| Prompt injection via generated content | Model output is data. It's validated against a JSON schema and the dictionary; HTML is never rendered from it (text nodes only) |
| Lost phone | Passkeys sync through iCloud Keychain. A one-time recovery code is shown once when you register, stored hashed in D1 |
| First-run takeover (someone registers a passkey before you) | Registration needs a one-time `SETUP_TOKEN` Worker secret. Registration closes after the first passkey unless you're already signed in |

---

## 4. Feature 1: Content generator ("Words you can read")

### Flow

1. **Pick (deterministic, free, offline).** Filter the JMdict subset for
   *common* words whose reading uses only kana you know, ranked by frequency.
   Skip words already in your deck or shown in the last 30 days. Take 6 per
   pack.
2. **Enrich (AI).** Send the 6 words plus your known kana to the model. Get
   back JSON via structured outputs:
   - `theme`
   - per word: `gloss` (English), `hook` (one-line memory aid), and an
     `example` written only in known kana. The example is optional at the
     kana stage and only allowed once you know at least 15 kana.
3. **Verify.**
   - Every example is tokenised against the dictionary (longest-match on the
     known-kana subset). A sentence containing an unknown or unverifiable
     token is dropped; the word survives without an example.
   - Glosses are compared with the JMdict gloss. If they disagree, the
     dictionary's gloss is shown.
4. **Cache.** The pack goes to IndexedDB. Keep 3 packs ready ahead; refill
   after each lesson or review session when online.
5. **Read.** Pack screen: word, then tap to reveal, then audio (speech
   synthesis), hook and example. Reading works offline.
6. **Add.** Finishing a pack adds its words as cards (`word:<jmdict id>`),
   up to the daily new-card budget. Overflow is queued and added on later
   days.

With the AI off or offline, steps 1, 5 and 6 still work. You get word packs
without hooks or examples, so **the feature degrades rather than breaks.**

### Cost check

A pack is about 2k input and about 1.5k output tokens. On Sonnet 5.5 that's
roughly $0.02, so about 250 packs fit in the $5 cap. The stable system prompt
is cached (`cache_control`); the known-kana list and the words go after the
cache breakpoint.

### API details (Sonnet 5.5)

- `output_config.format` with a JSON schema for strict output. No assistant
  prefill (not supported).
- `output_config.effort: "low"`. This is short structured writing; raise it
  only if measured quality is poor.
- Refusal fallback: beta `server-side-fallback-2026-07-01` with
  `fallbacks: "default"`. Always check `stop_reason` before parsing.
- No streaming needed (small output, background prefetch).
- `max_tokens: 2048`. The cap is checked against this worst case.

---

## 5. Data model additions (D1)

```sql
CREATE TABLE ai_credentials (           -- write-only from the app
  id          INTEGER PRIMARY KEY,
  provider    TEXT NOT NULL,            -- 'anthropic' | 'openai-compatible'
  base_url    TEXT,                     -- for openai-compatible
  label       TEXT NOT NULL,
  key_cipher  BLOB NOT NULL,            -- AES-GCM(ciphertext)
  key_iv      BLOB NOT NULL,
  key_last4   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE passkeys (id TEXT PRIMARY KEY, public_key BLOB NOT NULL, sign_count INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, passkey_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE ai_ledger (               -- spend tracking for the hard cap
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, feature TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens INTEGER, cached_tokens INTEGER, output_tokens INTEGER, cost_usd REAL NOT NULL
);
```

**Endpoints:**
- `POST /api/auth/register` (+ setup token)
- `POST /api/auth/login`
- `POST /api/ai/keys` (write-only)
- `GET /api/ai/keys` (labels and last4 only)
- `POST /api/ai/generate`
- `GET /api/ai/usage`

---

## 6. Providers

| Path | Used for | Notes |
|---|---|---|
| Anthropic via Worker | default for every feature | official `@anthropic-ai/sdk` in the Worker; prompt caching, structured outputs, vision |
| OpenAI-compatible via Worker | OpenRouter, Groq, OpenAI, … | adapter: JSON-schema response format where supported, otherwise parse and validate with the same schema and retry once. Same cap and ledger. Prices entered per model in Settings |
| Local, browser-direct | Ollama / LM Studio on your network | no key, no ledger. **Caveat:** the app is served over HTTPS, so the browser will block calls to `http://192.168.x.x` (mixed content). It only works if the local server has HTTPS, e.g. Tailscale `serve` or a Caddy reverse proxy. Untested on iOS Safari; treat as experimental |

---

## 7. Pushback (things I'd still argue with)

1. **Content generator first is slightly backwards for the kana stage.**
   The AI's real contribution at this stage is the memory hooks and a theme;
   the word list itself is a free dictionary filter. Shipping the free
   deterministic "Words you can read" packs as **phase 1a** (no AI at all) and
   adding enrichment as **1b** gets you value even before the passkey and
   proxy work is done.
2. **Passkey + encrypted D1 keys + proxy is a lot of security plumbing for a
   single user.** It's the right shape if this ever goes public, but it
   roughly doubles phase 1. If speed matters more, Cloudflare Access in front
   of `/api/ai/*` plus a `wrangler secret` key is about one hour of work and
   can be swapped for passkeys later without touching the features.
3. **Auto-add means AI-chosen vocabulary competes with the curriculum** for
   the 10/day new-card budget. Proposal: generated words get at most 30 % of
   the daily new-card budget, so lessons always come first.
4. **Handwriting coach**: the Rust/WASM matcher already checks stroke order,
   direction and shape for free. A vision call per attempt adds commentary on
   proportions and balance at real cost. Proposal: only on request ("Ask for
   feedback" button), never automatic.
5. **Conversation partner** is weak until you know about 300 words and the
   です/ます form. Gate it behind Stage 1 completion so it isn't a gimmick
   you abandon.

---

## 8. Roadmap

| Phase | Scope |
|---|---|
| **1a** | JMdict common-word subset (build script, like `strokes.json`); deterministic "Words you can read" packs; `word:` cards with the auto-add rule (D10); offline |
| **1b** | Passkey auth, encrypted key store, `/api/ai/generate` (Sonnet 5.5, structured outputs, caching, fallback), $5 cap and usage meter, pack enrichment, prefetch |
| 2 | Mistake tutor: one call after a wrong answer, using the confusable pair and your card history; cached explanations per pair |
| 3 | OpenAI-compatible adapter (Worker) and browser-direct local endpoint (experimental) |
| 4 | Conversation partner (needs Stage 1 vocabulary), with an i+1 vocabulary guard via the dictionary |
| 5 | Handwriting coach (vision, on request only) |

---

## 9. Still open (next questions)

- Explanation language for glosses and hooks: English only, or a second
  language as well?
- Should review history be sent to the provider for the mistake tutor
  (privacy), or only the single wrong answer?
- Is the 30 % budget share in §7.3 acceptable?
- Keep the full passkey plan (§7.2), or start with Cloudflare Access?
