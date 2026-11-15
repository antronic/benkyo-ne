# Beta consent and usage data

During the beta, every signed-in account must agree to share usage data. The
app asks right after sign-in (and again whenever the terms change). Until the
account agrees, account features are locked: `/api/ai/*` and
`/api/beta/events` answer `403 consent_required`. "Not now" signs out, and
offline learning on the device keeps working.

The consent text lives in `src/lib/beta/consentText.ts` and the version in
`src/lib/beta/contract.ts` (`CONSENT_VERSION`). **Change the text and bump
the version together**: every account is then asked to agree again.

## What is collected

| Area | What | Where it's recorded |
| --- | --- | --- |
| Learning progress | each graded answer (card, grade, time taken, FSRS state before/after, today's totals, streak); lesson completions; one daily summary (cards by state/kind, due, lessons done, streak, learning settings) | app → `beta_events` (`kind = progress`) |
| AI requests and replies | the parsed request (words, questions, Ask AI turns, lesson topics), the full system + user prompt, the raw model reply, the validated result, provider, model, tokens, cost, latency, status/error. Images are replaced by `{mediaType, bytes}` | Worker → `beta_ai_calls` |
| Device and app | user agent, UA client hints (brands, platform, model, platform version when offered), screen/viewport/pixel ratio/orientation, colour scheme, reduced motion, language(s), time zone, display mode (installed vs browser tab), service worker, CPU cores, device memory, network type, storage used, app version; Cloudflare's country guess per batch (never the IP) | app → `beta_events` (`kind = device`) |
| Errors and events | `window` errors and unhandled rejections (message, stack), failed API calls (path, status, server message), screens opened, app open/hidden/visible, settings changed, progress reset | app → `beta_events` (`kind = error` / `event`) |

**Never collected:** AI API keys (they are only decrypted to call the
provider and never touch usage data), passkeys, recovery codes, request
bodies of failed calls, anything outside Benkyo. As a safety net,
`src/lib/beta/scrub.ts` drops secret-looking fields (`apiKey`, `token`,
`password`, `cookie`, …) and replaces key-like text (`sk-…`, `Bearer …`,
recovery-code shapes) with `[redacted]`, on the device and again on the
Worker, including inside AI prompts.

## Retention, access, withdrawal

- Usage data (`beta_events`, `beta_ai_calls`) is deleted **180 days** after it
  arrives (`RETENTION_DAYS`), by a daily cron (`23 3 * * *` UTC,
  `purgeOld` in `worker/beta/routes.ts`).
- Consent records (`beta_consents`: version, time, user agent) are kept while
  the account exists, as evidence of consent.
- Settings › Beta data: **Download** (JSON export, `GET /api/beta/export`),
  **Delete data** (usage data only, collection continues), **Withdraw from the
  beta** (marks consent withdrawn, deletes usage data, locks account features
  until the person agrees again).
- Deleting the account deletes all three tables' rows for it.

These cover what Japan's APPI (notice of purpose of use, third-party
provision, disclosure and deletion requests) and the GDPR (informed, specific,
withdrawable consent; access, erasure, storage limitation) expect for a beta
like this. A short privacy notice naming the operator and a contact address
is still needed before a wide launch.

## Endpoints

```
GET    /api/auth/me                → Me, now with beta: BetaStatus
GET    /api/beta/status            → BetaStatus
POST   /api/beta/consent {version} → BetaStatus
DELETE /api/beta/consent           → BetaStatus (withdraw + delete usage data)
POST   /api/beta/events {events}   → {stored}   (≤100 per batch, 60 batches/min)
GET    /api/beta/export            → JSON download
DELETE /api/beta/data              → {ok}
```

The app batches events (`src/lib/beta/telemetry.svelte.ts`): every 30 s,
when hidden (keepalive), when 100 are queued, and keeps up to 1000 in
IndexedDB while offline. Nothing is queued before consent.

## Admin console

The fleet/admin console plan said the console never shows chats or API keys.
With this data, AI prompts and replies (including Ask AI conversations) are
now stored per account. API keys are still never stored in usage data. If the
console shows `beta_ai_calls`, treat it as personal data: admin-only, and
mention it in the console's own notes.

## Useful queries

```sql
-- reviews per day
SELECT date(at / 1000, 'unixepoch') d, COUNT(*) FROM beta_events WHERE name = 'review' GROUP BY d;
-- installed app vs browser
SELECT json_extract(data_json, '$.displayMode') m, COUNT(DISTINCT user_id) FROM beta_events WHERE kind = 'device' GROUP BY m;
-- AI failures by model
SELECT model, status, COUNT(*) FROM beta_ai_calls GROUP BY model, status;
-- top errors
SELECT name, json_extract(data_json, '$.message') msg, COUNT(*) n FROM beta_events WHERE kind = 'error' GROUP BY 1, 2 ORDER BY n DESC LIMIT 20;
```
