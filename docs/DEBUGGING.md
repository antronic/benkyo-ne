# Debugging: error ids, error reports, Fleet → Errors, debug mode

Why: a bare "500 Internal Error" page told nobody what broke. Now every error the app catches
has an id, the steps before it, and (with consent) a record in Fleet.

## On the device (`src/lib/debug/errors.svelte.ts`)

- `reportError(e, {name, status, requestId, route, extra})` gives the error an id
  (`E-` + 6 Crockford base32 characters, e.g. `E-7F3K2Q`, made on the device so it works offline),
  keeps the last 20 in localStorage `benkyo.errors`, prints it in debug mode, and, when the
  signed-in account agreed to the beta terms (`telemetry.enabled`), sends it at once as a beta
  `error` event. Without consent nothing leaves the device. It never throws, and the same message
  repeated within 2 s (a render loop) is one report; at most 50 are sent per launch.
- Caught automatically: SvelteKit `handleError` (`src/hooks.client.ts`, returns `{ errorId }` so
  `page.error.errorId` is on the error page; 404s are not reported), `window` `error` and
  `unhandledrejection`, the screen boundary in the root layout (`screen_crash`), start-up steps
  (`boot_*`), and any `/api/` answer with status 5xx (`api_error`, with the request id).
- Breadcrumbs (last 30, in memory): screens (path), API calls (method, path without the query
  string, status, time, request id), `console.error`/`warn` text, online/offline. Never what the
  learner typed. All text goes through `scrubText` (no keys or recovery codes).
- `lastErrorId()`, `errorDetails(id)` (plain text for "Copy details"), `sendErrorNote(id, note)`
  (a beta `error_note` event; false without consent), `buildNumber()` (the `$app/env` version,
  the ms build time shown in Settings).
- Debug mode: `?debug=1` (or `?debug=0`) or Settings → Debugging → Debug mode; kept in
  localStorage `benkyo.debug`. Prints every breadcrumb (`console.debug`) and a grouped report per
  error. `window.__benkyo` has `errors()`, `breadcrumbs()`, `details(id)`, `debug(on)`, `build`.
- Settings → Debugging shows the build number and the last 5 errors with Copy details.

## On the Worker

- Every `/api/*` answer carries `x-request-id` (the Cloudflare ray id, or a random id locally;
  `requestIdOf` in `worker/index.ts`).
- An uncaught exception logs one structured line (`event: 'api_exception'`, requestId, method,
  path, error, stack) and answers `{ error: 'server', message, requestId }`. Every 5xx also logs
  `event: 'api_5xx'` with the time taken. Workers Logs (`observability` in `wrangler.jsonc`)
  indexes these fields: search the request id from Fleet there.
- Fleet's `AdminError` keeps `requestId` from the failed call.

## Fleet → Errors (`/admin/errors`, `worker/admin/errors.ts`)

- `GET /api/admin/errors?days=1|7|30&q=&build=&offset=`: errors grouped by name and message
  (count, accounts, last seen), then every occurrence newest first (50 a page). `q` matches the
  error id, message, screen, name or request id; `/admin/errors?q=E-7F3K2Q` opens on one id.
- `GET /api/admin/errors/:id`: the stack, breadcrumbs, other fields, the device snapshot of the
  same launch and the learner's notes.

Storage is `beta_events` (`kind = 'error'`), so no new table: consent, the 180-day retention,
the export, withdrawal and account deletion already cover it (docs/BETA-DATA.md).
