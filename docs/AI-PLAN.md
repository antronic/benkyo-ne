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
| D14 | Model list | **Fetched live from each provider's `/models` API**; nothing hard-coded in the picker | Hard-coded list: goes stale with every model release |
| D15 | Model prices (for the cap) | **Use prices from the provider's `/models` response when it has them** (e.g. OpenRouter). Otherwise a built-in price table; otherwise you enter the price once; otherwise the model is blocked under the cap | Manual price for every model: tedious |
| D16 | Card maker input | **All modes, switchable**: English, Japanese (kana/kanji), romaji, screenshot, scenario | A single input mode |
| D17 | Kanji on cards | **Kana on the front, kanji shown on the back** ("also written 池"); switch to a kanji front once you're at the kanji stage | Kanji with furigana from day one; kana only |
| D19 | Cards you make vs the 30 % share | **Cards you make yourself do *not* count toward the 30 % share** for AI-picked pack words; they still use the overall daily new-card limit, with overflow queued | Sharing the 30 % with pack words |
| D20 | Phrases | **Phrases are cards too** (いただきます, おねがいします, すみません) | Single words only |
| D21 | Scenario tags | **Scenarios become deck tags** ("ramen shop") you can review on their own before you go | Untagged |
| D22 | Explanation language | **English plus a second language you pick in Settings**, shown under the English | English only |
| D23 | Mistake tutor context | **Your review history may be sent to the provider**, scoped to what the explanation needs (§4d) | Only the single wrong answer |
| D24 | Auth | **Keep the full passkey setup** (D3), not Cloudflare Access | Cloudflare Access + `wrangler secret` as a faster start |
| D18 | Word not in dictionary | **Allowed, marked "unverified"**, then checked against the full JMdict online; if still unknown, you decide | Reject (blocks slang and names); trust the AI (risky) |

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

## 4b. Feature 2: Card maker ("Make a card from…")

You give it something; it proposes cards; **you approve before anything
enters the deck.** A segmented control switches between input modes:

| Mode | Example | Pipeline |
|---|---|---|
| English | "pond" | Dictionary lookup by English gloss gives candidates; the AI ranks them for everyday use and explains the differences (池 vs 沼). You pick one or more |
| Japanese | いけ / 池 / 食べた | Exact dictionary lookup. Inflected forms are reduced to the dictionary form (食べた → 食べる) by a small deinflector, so the AI isn't needed for that step |
| Romaji | ike / taberu | Converted to kana on the device (deterministic), then handled like Japanese input |
| Screenshot | photo of a menu or sign | Vision model extracts the words, with the original span highlighted on the image; you tick the ones you want. Needs a model whose `/models` capabilities list image input |
| Scenario | "ordering at a ramen shop" | The AI proposes 6–10 high-value words or phrases for that situation, each dictionary-checked; you tick the ones you want |

**For each accepted item the AI writes the card back:**
- gloss, checked against JMdict
- memory hook
- one example sentence, with a translation; dictionary-tokenised, and any
  unverified token is flagged
- part of speech and politeness note (e.g. です/ます vs plain)

The card is `word:<jmdict id>`, or `word:custom:<uuid>` for unverified words.

**Rules:**
- **Readings you can't read yet.** If a card's reading uses kana you haven't
  learned, the card is saved but **parked**. It's added to reviews
  automatically once all its kana are learned, so the kana-front rule (D17)
  never shows you an unreadable prompt.
- **Daily budget (D19).** Cards you make yourself are exempt from the 30 %
  share for generated pack words (§7.3). They still go through the overall
  daily new-card limit, and overflow is queued for the next day. Priority
  order for new cards each day:
  1. curriculum lessons
  2. cards you made
  3. pack words (≤ 30 %)
- **Phrases (D20).** A card can be a word **or a phrase** (`kind: word |
  phrase`). Fixed expressions are verified as a whole where JMdict lists them
  (いただきます and おねがいします are entries). Otherwise the phrase is
  tokenised, and each part must verify (or is flagged), the same as example
  sentences. Phrase cards add a "when to say it" usage line (e.g. before
  eating; polite request), and their example is a mini-dialogue instead of a
  sentence. Phrase cards are tested by meaning → say or type the phrase, not
  by reading individual kana.
- **Scenario tags (D21).** Every card from scenario mode gets the scenario as
  a tag (`ramen shop`). You can also tag cards from other modes. The Review tab
  gets a tag filter ("Review: ramen shop"), so you can drill a tag before a
  real-life situation. These drills are **extra practice**: they don't
  reschedule cards that aren't due, so FSRS intervals aren't distorted.
  Reviews of cards that are due count normally.
- **Unverified (D18).** A gold "unverified" badge, plus a second check against
  the full JMdict that the Worker keeps in D1 (too large to bundle).
  Confirmed words lose the badge. Unknown words stay badged until you edit
  them or delete them.
- **Offline.** Typed inputs go into an outbox. Dictionary-only work (lookups,
  romaji conversion) happens immediately; the AI part runs on reconnect.
- **Cost.** Per item roughly the same as a pack word (≈$0.004 on Sonnet 5.5).
  Screenshot mode adds one image call (≈$0.01–0.03 depending on the image).
  All of it goes through the same $5 cap.

---

## 4d. Explanation language & tutor context

### Second language (D22)
- Settings has **Explanation language: English + [second language]**. The
  second language is a free choice, stored as a BCP-47 code such as `de`,
  `es` or `th`.
- **Glosses.** JMdict has native glosses for a handful of languages (German,
  French, Russian, Spanish, Dutch, Hungarian, Swedish, Slovenian).
  - Where the bundled or D1 dictionary has a gloss in your second language,
    that is used: verified and free.
  - Otherwise the model translates the *English JMdict gloss*, not the
    Japanese word directly. That way the meaning is anchored to verified
    data, and the translation gets a small "AI-translated" marker.
- **Hooks, usage notes and tutor explanations** are written in both languages
  in the same call (a structured-output field per language), so it costs a
  little more output but no extra call.
- **The UI itself stays English.** Only learning content is bilingual.
- **Cache key** for packs and cards includes the language pair, so changing
  the second language regenerates content gradually instead of mixing
  languages.

### Mistake tutor context (D23)
Sending history is allowed, but only the data the explanation needs:

| Sent | Not sent |
|---|---|
| the wrong answer and the expected answer | your sync key, passkeys, other credentials |
| that card's review history (grades, intervals, lapses) | the full review log across all cards |
| stats for its confusable pair (e.g. how often you mix ぬ/め) | device or location data |
| the card's mnemonic and your known-kana set | |

- Settings gets a line saying what the tutor sends, and a switch to fall back
  to "only the wrong answer".
- The tutor caches its explanation per confusable pair, so repeated mistakes
  don't cost repeated calls.

---

## 4c. Model list from the providers' `/models` APIs

`GET /api/ai/models?credential=<id>` (Worker, behind the passkey session):

1. Calls the provider's model list with the stored key:
   - **Anthropic:** `GET /v1/models` (paginated). Each entry has `id`,
     `display_name`, `max_input_tokens`, `max_tokens` and `capabilities`.
     That's enough to show context size, mark vision-capable models for
     screenshot mode, and hide models that lack structured outputs.
   - **OpenAI-compatible:** `GET {base_url}/models`. OpenRouter-style entries
     also include `pricing` and `context_length`. Entries with only `id` are
     listed with capability "unknown".
   - **Local (browser-direct):** the browser calls `{local}/v1/models` itself.
2. Normalises the entries to
   `{ id, label, provider, contextTokens, maxOutput, vision, structured, price? }`.
3. Caches the result for 1 hour (Cache API, plus a KV copy for cold
   starts; well within the free-tier write limits).

**Price resolution for the cap (D15), first match wins:**
1. Price in the provider's `/models` response
2. Built-in price table (`worker/ai/prices.ts`, Claude models; updated with
   releases)
3. Price you entered for that model in Settings
4. **No price: the model shows a 🔒 "set a price to use under the cap"**

The picker in Settings lists every model per credential, grouped by provider,
with context size, vision and structured-output badges and $/M tokens. Each
feature (packs, card maker, tutor, …) stores its own model choice. Defaults:
Sonnet 5.5 for text, and for screenshot mode the first vision-capable model in
your list.

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
CREATE TABLE ai_model_prices (         -- your manual prices (D15 step 3)
  provider TEXT NOT NULL, model TEXT NOT NULL,
  input_per_m REAL NOT NULL, output_per_m REAL NOT NULL, PRIMARY KEY (provider, model)
);
CREATE TABLE ai_feature_models (feature TEXT PRIMARY KEY, credential_id INTEGER NOT NULL, model TEXT NOT NULL);
CREATE TABLE jmdict (                  -- full dictionary for online verification of rare words (D18)
  id INTEGER PRIMARY KEY, kanji TEXT, reading TEXT NOT NULL, gloss TEXT NOT NULL, common INTEGER NOT NULL
);
CREATE INDEX jmdict_reading ON jmdict (reading);
CREATE INDEX jmdict_kanji ON jmdict (kanji);
-- Card content & tags (word/phrase cards). The review log stays the source of
-- truth for scheduling; this is card *content*, synced alongside it
-- (last-write-wins by updated_at).
CREATE TABLE user_cards (
  user_id INTEGER NOT NULL, card_id TEXT NOT NULL,   -- word:<jmdict id> | word:custom:<uuid> | phrase:<…>
  kind TEXT NOT NULL CHECK (kind IN ('word','phrase')),
  front TEXT NOT NULL, kanji TEXT, gloss TEXT NOT NULL, usage TEXT, hook TEXT,
  example_json TEXT, verified INTEGER NOT NULL, parked INTEGER NOT NULL,
  source TEXT NOT NULL,                              -- user | pack | scenario
  updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, card_id)
);
CREATE TABLE card_tags (
  user_id INTEGER NOT NULL, card_id TEXT NOT NULL, tag TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id, tag)
);
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
- `GET /api/ai/models?credential=<id>`
- `PUT /api/ai/models/price` (manual price)
- `PUT /api/ai/features/<feature>/model`
- `POST /api/ai/generate` (packs)
- `POST /api/ai/cards` (card maker: `{mode, input, image?}` returns proposals)
- `GET /api/dict/lookup?q=` (full-JMdict verification)
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
2. *(Resolved: keep passkeys, D24.)* **Passkey + encrypted D1 keys + proxy is a lot of security plumbing for a
   single user.** It's the right shape if this ever goes public, but it
   roughly doubles phase 1. If speed matters more, Cloudflare Access in front
   of `/api/ai/*` plus a `wrangler secret` key is about one hour of work and
   can be swapped for passkeys later without touching the features.
3. **Auto-add means AI-chosen vocabulary competes with the curriculum** for
   the 10/day new-card budget. Decided: generated pack words get at most 30 %
   of the daily new-card budget, so lessons always come first; cards you make
   yourself are exempt from the 30 % (D19).
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
| **Wave 1** (single delivery) | Everything previously split into 1a/1b/1c: dictionary on device (`@johnmorrisdotca/jisho`, JMdict), "Words you can read" packs (deterministic picks + AI context), passkey auth, encrypted key store, live `/models` list + price resolution, $5 cap + usage meter, card maker (English / 日本語 / romaji / photo / scenario), phrase cards, scenario tags + tag drills, bilingual content, word/phrase reviews, card sync, offline outbox |
| 2 | Mistake tutor (D23 context scope) |
| 3 | Browser-direct local models (experimental, see §6 caveat) |
| 4 | Conversation partner (needs Stage 1 vocabulary) |
| 5 | Handwriting coach (vision, on request only) |

**Changes made while building wave 1:**
- The dictionary comes from the npm package `@johnmorrisdotca/jisho` (JMdict
  CC BY-SA 4.0, Tatoeba CC BY 2.0 FR, KanjiVG). Its data is split into about
  1,700 lazily loaded chunks.
- **Verification runs on the device only.** The device holds the whole
  dictionary (lazily), so the Worker doesn't need a copy, and the planned D1
  `jmdict` table is dropped. That also avoids D1's free-tier limit of 100k
  writes a day, which a full import would exceed.
- The common-word chunk (≈2.5 MB) is precached for offline use; the rest is
  cached on first use.
- The script-only deploy can't carry the full dictionary (3 MB limit). There,
  rare words show as "unverified" until a normal assets deploy (Workers
  Builds) serves the full set.

## 9. Open questions

None. All decisions are recorded in §1 (D1–D24). Remaining unknowns are
implementation details, to settle while building: the exact JMdict subset
size, the deinflector rules, and passkey UX on iOS Safari.
