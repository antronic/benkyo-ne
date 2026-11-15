# Sign in with Apple

A second way into a Benkyo account, beside passkeys. It is off until the
Worker has `APPLE_CLIENT_ID`; until then the Apple button doesn't appear and
`/api/auth/apple/*` answers 404.

## What you set up (once)

You need a paid Apple Developer account. In
[Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):

1. **App ID** (Identifiers → +, App IDs, type App). Any bundle id, e.g.
   `me.jirachai.benkyo`. Tick **Sign in with Apple** under Capabilities.
   It's only there to group the web Services ID; no iOS app is needed.
2. **Services ID** (Identifiers → +, Services IDs). Identifier e.g.
   `me.jirachai.benkyo.web`. This identifier is your `APPLE_CLIENT_ID`.
3. Open the Services ID, tick **Sign in with Apple**, press **Configure**:
   - Primary App ID: the App ID from step 1
   - Domains and Subdomains: `benkyo.jirachai.me`
   - Return URLs: `https://benkyo.jirachai.me/api/auth/apple/callback`

   Save, Continue, Save. Apple only accepts https and real domains, so
   localhost and `*.workers.dev` preview URLs can't use the Apple button
   unless you add them here too (previews: add each URL; localhost: never).
4. Give the Worker the Services ID:

   ```sh
   npx wrangler secret put APPLE_CLIENT_ID   # paste me.jirachai.benkyo.web
   ```

   (It isn't secret, but a Worker secret survives deploys without editing
   `wrangler.jsonc`.)
5. Deploy: `npm run cf:deploy` applies migration `0004_apple.sql` first.

No private key (.p8), Key ID or Team ID is needed: the Worker verifies the
`id_token` Apple posts back against Apple's public keys and never calls
Apple's token endpoint.

## How it behaves

- **Signed out, new Apple ID:** creates an account when `SIGNUP_MODE` is open,
  with the same per-network and per-day throttles as passkey sign-ups. With
  `SIGNUP_MODE=closed` it shows "New sign-ups are closed".
- **Signed out, known Apple ID:** signs in to that account, even when sign-ups
  are closed.
- **Signed in:** Settings → Ways to sign in → Connect links your Apple ID to
  the account, so either works. An Apple ID can belong to one account, and an
  account can have one Apple ID.
- **Disconnect** needs a passkey on the account, and ends every session that
  signed in with Apple. With Apple connected you may remove your last passkey.
- Only the **name** scope is requested. No email is asked for or stored; the
  database keeps Apple's opaque user id (`sub`) per account.
- Someone who already has a passkey account and taps "Continue with Apple"
  without connecting first gets a second, separate account. The sign-in
  screen offers passkey first for that reason.

## Security notes

- Apple returns with a cross-site `form_post`, which our `SameSite=Strict`
  session cookie doesn't ride on. `start` stores a single-use state and nonce
  (10 minutes) and sets the state in a `SameSite=None; Secure` cookie scoped
  to `/api/auth/apple`. The callback needs the posted state to equal that
  cookie, and the `id_token` nonce to match, so a sign-in can't be completed
  in another browser.
- The `id_token` check: RS256 signature by a current Apple key (cached an
  hour, refetched on an unknown `kid`), `iss`, `aud` = `APPLE_CLIENT_ID`,
  `exp`, `iat` no older than 15 minutes, `nonce`.
- The `/api/auth/*` same-origin check exempts only the callback, and only for
  `Origin: https://appleid.apple.com` (or `null`).

## Home Screen app caveat

Apple's page is on another domain, so from the iOS Home Screen app it opens
in an in-app browser sheet. Test there after deploying: if the session lands
in that sheet instead of the app, sign in from Safari, or with a passkey, and
we can switch to Apple's popup flow.
