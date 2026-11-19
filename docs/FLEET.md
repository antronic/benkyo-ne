# Fleet console

The fleet console is the operator console at `/admin`. It's for checking and
managing the platform, packages and users. Only admin accounts can use it,
and today that's the owner (account 1). There is no "make admin" button.

Plan: [Fleet console plan](https://claude.ai/artifact/V5aGj3ttAxjHqYzje5XLdg).

## What's built

| PR | Scope | Status |
|---|---|---|
| 1 | Access check, admin guard, audit table, Overview screen | merged (#7) |
| 2 | Accounts: list, detail, disable/enable, delete, cap, revoke sessions; passkey step-up | merged (#10) |
| 3 | Settings: sign-up switch, invite codes, session lifetime, sign-ups per day | merged (#11) |
| 4 | Usage, System and Audit log screens (read-only) | merged (#14) |
| 5 | Packages: Free / Plus / Pro, manual grants | merged (#15) |
| 6 | AI providers, live model lists, packages built from models, new packages | PR #30 |
| 7 | Promo codes: made in the console, redeemed in Settings | PR #32 |
| 8 | Navigation: sidebar (≥ 960px), menu pill and sheet on phones, breadcrumbs (`src/lib/admin/nav.ts`, `FleetNav.svelte`, `src/routes/admin/+layout.svelte`) | merged (#38) |
| 9 | Desktop layouts: 1160px column from 1200px, accounts and audit log as tables (`DataTable`), sections side by side (`Columns`) | this PR |
| 10 | Feedback: thumbs and reports learners leave on lessons, units, grammar, kanji and words; mark fixed or dismiss ([FEEDBACK.md](FEEDBACK.md)) | this PR |

## Security

Four locks, all required:

1. **Cloudflare Access at the edge** on `/admin*` and `/api/admin/*`.
2. **The Worker verifies the Access JWT** (`Cf-Access-Jwt-Assertion`) on every
   `/api/admin/*` call: signature against the team's published keys, the
   application's AUD tag, issuer and expiry. If Access isn't configured, the
   API answers 503 and the console stays closed.
3. **An admin passkey session.** Recovery-code and Apple sessions are
   refused, and disabled accounts never get a session.
4. **A fresh passkey tap for changes.** Disabling, enabling, changing a cap,
   signing an account out everywhere and deleting it answer
   `428 stepup_required` unless this session confirmed with one of the
   admin's own passkeys in the last 5 minutes (`/api/admin/stepup/*`,
   `sessions.stepup_at`). The console asks for the tap and retries.

Guard rails: you can't disable, delete or sign out your own account, and
admin accounts can't be disabled or deleted from the console. Deleting
needs the account's name typed exactly and erases every table's rows for
it, beta data included. The person's own "Delete account" only closes the
account (disabled, data kept, `account.close` in the audit log); erase a
closed account here when its owner asks by email.

Every admin write is logged in `admin_audit` in the same D1 batch as the
change (`audited()` in `worker/admin/routes.ts`).

## Setting up Cloudflare Access (once)

1. Cloudflare dashboard → **Zero Trust** → pick a team name (free plan, up to
   50 users). The team domain is `<team>.cloudflareaccess.com`.
2. **Settings → Authentication → Login methods**: add **One-time PIN** and
   **GitHub**.
3. **Access → Applications → Add → Self-hosted**:
   - Domain `benkyo.jirachai.me`, path `admin` and a second entry for path
     `api/admin`.
   - Session duration: 24 hours.
   - Policy **Allow**, Include → Emails → the owner's email.
4. Copy the application's **AUD tag**.
5. Set the Worker variables, then deploy:

   ```sh
   npx wrangler secret put ACCESS_TEAM_DOMAIN   # <team>.cloudflareaccess.com
   npx wrangler secret put ACCESS_AUD           # the AUD tag
   npx wrangler secret put ADMIN_EMAILS         # optional extra allow-list, comma-separated
   npm run cf:deploy                            # applies migrations 0006 to 0009
   ```

6. In **Workers & Pages → benkyo-ne → Settings → Domains & Routes**, turn
   off the `workers.dev` URL and preview URLs, so `/api/admin/*` can only be
   reached through the Access-protected domain.
7. Optional: a WAF rate-limiting rule on `/api/admin/*`, for example 60
   requests per minute per IP.

## Sign-ups

`/admin/settings` (menu: People → Sign-up settings) switches sign-ups between **open to everyone** and
**invite only** (`app_settings.signup_mode`, cached 30 s per isolate).
While invite-only, a passkey sign-up needs a valid invite from **Invitations**
(`/admin/invitations`, menu: People → Invitations): a random code `BK-XXXX-XXXX`, or a VIP
whose name Job picks such as `VIP` (3 to 20 letters, digits and underscores, not 8 letters which
would read as a random code); each with a use count and optional expiry (`invite_codes`), and
the account remembers which code it used (`accounts.invite_code`). Apple
sign-up only works while sign-ups are open. `SIGNUP_MODE=closed` on the
Worker overrides the console and stops invites too.

The same screen sets the sign-in session lifetime (`ai_settings.session_ttl_days`,
1 to 400 days, default 400; see `worker/auth/session.ts`) and shows new
accounts per day for the last 30 days.

Emergency stops that don't need the console: set the Access policy to deny
everyone, and `SIGNUP_MODE=closed` on the Worker.

## Usage, system and audit log

- **Usage** (`/admin/usage`): AI spend over 7, 30 or 90 UTC days, per day,
  feature, model and account, plus the latest failed calls. Spend counts
  finished calls only.
- **System** (`/admin/system`): the deployed Worker version (the
  `CF_VERSION_METADATA` binding in `wrangler.jsonc`), the app build, the
  last applied D1 migration compared with the newest one this Worker was
  built with (`LATEST_MIGRATION` in `worker/admin/insights.ts`; a test fails
  if it falls behind `worker/migrations`), health checks and table sizes.
  "Behind" means the deploy skipped `wrangler d1 migrations apply`.
- **Audit log** (`/admin/audit`): every admin change, newest first, with a
  filter by action.

## Packages

`/admin/packages` holds the three packages (`plans`, migration 0009),
seeded from the pricing proposal in `docs/AI-PLAN.md`: Free, Plus ($4.99 a
month or $39 a year, $1.50 of managed AI) and Pro ($9.99 or $79, $3.50).
Name, description, prices, the monthly AI allowance and whether it's
offered can be edited; Free always stays free.

An account gets Plus or Pro through a grant on its page (`plan_grants`):
**trial** (7 days to a year) or **complimentary** (also "until ended"). A
new grant replaces the live one, and a grant can be ended early. The
account's package is the highest live grant, else Free (`worker/plans.ts`).
Grants and package edits need a passkey tap and are audited; deleting an
account deletes its grants.

More packages can be made with **New package** (they start not offered,
so they can be set up first) and deleted while nobody has ever had one.
Free, Plus and Pro can't be deleted. Grants can give any package but Free.

### AI providers and package models

`/admin/ai` holds the operator's own provider keys (`ai_providers`,
migration 0010): Anthropic, any OpenAI-compatible server, and presets for
OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI and
Together. A key is only kept after it lists the provider's models; it's
sealed with `AI_MASTER_KEY` (bound to this table, so a learner's key row
can't be swapped in) and never returned, logged or shown again, only its
last four characters. Keys can be replaced, providers turned off, and
removed once no package uses them.

`/admin/ai/:id` shows every model the provider's API lists (cached an
hour, **Refresh** asks again), with context size, image input, price per
million tokens (from the provider's list or the built-in table) and which
packages include it.

On `/admin/packages`, **Choose models** picks models from every turned-on
provider into a package (`plan_models`, up to 20). Each is checked against
its provider's list when saved, and its name and price are copied so the
page can show what a package keeps after its AI allowance. Each app feature
(fill a card, suggest cards and Ask AI, read a photo) is given to one model
in the package. Free has no models: learners there use their own key.

Not built yet: nothing in the app checks the package, there's no checkout
or payment webhook, and the app doesn't call the package's models yet. Those
come with Phase B of `docs/AI-PLAN.md`, which will add `subscription` grants.

## Promo codes

`/admin/promos` makes codes that give a package for a while (`promo_codes`,
migration 0011). A code is **random** (10 letters and digits without
look-alikes such as 0/O and 1/I) or **typed in** (6 to 24 letters, digits
and underscores, starting and ending with a letter or digit; case, spaces,
dashes and dots are ignored, so `songkran-27` is saved as `SONGKRAN27` and
`songkran_27` as `SONGKRAN_27`). Underscores don't count when matching:
`SONGKRAN_27` and `SONGKRAN27` are the same code, so a new code must differ
from every existing one with underscores removed. Each code sets the
package (any paid one), trial or complimentary, how many days the package
lasts from redeeming (or until ended, complimentary only), an optional use
limit, an optional expiry, and a note only the admin sees. Making, editing
and switching a code off or on need a passkey tap and are audited
(`promo.create`, `promo.update` with the changed fields, `promo.disable`,
`promo.enable`). Codes are never deleted, so their redemptions stay on
record. The list shows each code's uses against its limit (`12 / 50`, or
`12 / ∞` with no limit); tapping a code lists who redeemed it, linked to
their account, with the date and whether that grant is still live.

**Links.** Each code has a shareable link, `https://benkyo.jirachai.me/?ref=CODE` (or
`?coupon=CODE`), and a sign-up link with an invite, `/invite/VIP?coupon=CODE`: pick the invite
under "Link with an invite" on the code's page, or copy an invite's own link (`/invite/VIP`)
in Invitations. `/invite/<invite>` (`src/routes/invite/[code]`, a static SPA path) fills the
invite into the sign-up sheet (sessionStorage `benkyo.inviteLink`) and opens it. The coupon is
kept on that device (localStorage `benkyo.promoLink`, 30 days) through the intro, sign-up,
onboarding and consent; once the person is signed in the app redeems it once and says how it
went (a toast), then forgets it. Offline, it waits for the next try. `src/lib/promo/link.ts`,
used by the root layout.

**VIP invites.** Made only in Fleet → Invitations ("＋ New VIP"): a name (the link,
`/invite/NAME`), who it's for, a note (up to 280 characters), who it's from (up to 40), an optional
drawing on an `InkPad`, an optional promo code picked from Promo codes, uses and expiry; Preview
plays the card. One call, `POST /api/admin/invites {code, card, coupon, …}` (audited `invite.vip`;
a card needs a name, a promo code needs a card). Edit changes the card and the promo code
(`PATCH /api/admin/invites/:code {card?, coupon?}`, step-up, audited `invite.card` /
`invite.card.clear` / `invite.coupon`). Stored in `invite_codes.card_note`, `card_from`, `card_ink`
(JSON: `{aspect, strokes: [[x, y, ms]…]}`, x and y from 0 to 1; migration 0016; `worker/invite.ts`
checks the shape and size) and `coupon` (the promo code as stored; migration 0017). A VIP is an
invite with a card; `GET /api/admin/invites` lists them all.

**Used up.** A VIP turns itself off once its quota is used: every use of the invite is taken, or
its promo code has no redemptions left (`INVITE_USED_UP` in `worker/auth/signup.ts`, used by
sign-up and the card). Nothing is stored: raising either limit, or picking another promo code in
Edit, turns it back on. Fleet shows a "Used up" badge, the invite's uses and the promo code's
redemptions against their limits (`AdminInvite.usedUp`, `couponUses`, `couponMaxUses`). The link
answers 410 with `reason: 'full'`, and the app says the invite is full and opens sign-up without
filling in the code (revoked, expired or deleted say it has ended).

**Deleting.** VIPs and invite codes have Delete next to Revoke (`POST /api/admin/invites/:code/delete`,
step-up, a confirm dialog, audited `invite.delete` with `{code, vip, uses}`); promo codes have
"Delete this code" on their sheet (`DELETE /api/admin/promos/:code`, step-up, confirm, audited
`promo.delete` with `{code, uses, unboundVips}`). Delete only hides: it sets `deleted_at`
(migration 0018) and keeps the row, its redemptions and every package it already gave. A deleted
item leaves the lists, can't be used or redeemed (a deleted promo code reads as not valid), and
its name stays taken. Deleting a promo code also unbinds it from any VIP. A deleted, revoked,
used-up or expired VIP link answers 410, and the app says the invite has ended and opens sign-up
without filling in the code.

When `/invite/<vip>` opens, the page asks `GET /api/auth/invite/:code[?coupon=CODE]` (signed out,
30 a minute per IP; 404 without a live invite and a card). The answer has the card, the perk and
`coupon`: the link's `?coupon=` if it has one, else the VIP's own, and only while it can still be
redeemed. The page saves that code like a `?coupon=` link (used once signed in) and plays
`InviteCard` once the splash has gone: it springs up, the seal stamps on, the note rises in, the
handwriting plays back as it was drawn, and the perk ("Plus trial · 14 days") shows. Accept and Not
now come in with the note. Accept opens sign-up with the invite filled in (after the intro on a
first visit); Not now goes to the app. With no card, offline or slow (4 s), the link goes straight
to sign-up. Kit components `InviteCard`, `InkPad` and `InkReplay`, ink model in
`src/lib/ui/ink.ts`, all on `/design`.

**Editing** (`PATCH /api/admin/promos/:code`) changes the package, kind,
days, use limit (not below the uses so far), expiry (days from today, or
never) and note. Changes apply to redemptions from then on; packages a code
already gave keep their terms. The code text itself can change only while
nobody has redeemed it. A package can't be deleted while any code, live or
switched off, gives it: move those codes to another package first.

Learners redeem a code in Settings, under Account (`POST /api/promo/redeem`,
signed in, 10 tries an hour per account). A redemption is a normal
`plan_grants` row with the note `Promo <code>`, so it shows under Packages
and on the account's page and can be ended there. Rules: once per account;
it replaces a lower live grant; it is refused when the account already has
the same package or a better one, so a code never takes anything away. The
claim, the use count and the grant are written in one D1 batch whose
statements only run while the code is still redeemable, so two people
can't both take the last use. Deleting an account deletes its redemptions
but keeps the code's use count.

## Local development

`DEV_AUTH_BYPASS=1` on localhost skips both Access and the passkey (as for
the rest of the API):

```sh
npx wrangler d1 migrations apply benkyo --local
npx wrangler dev --port 8787 --infer-origin-from-routes=false --var DEV_AUTH_BYPASS:1
# open http://localhost:8787/admin
```
