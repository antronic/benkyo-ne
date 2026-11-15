# Fleet console

The fleet console is the operator console at `/admin`. It's for checking and
managing the platform, packages and users. Only admin accounts can use it,
and today that's the owner (account 1). There is no "make admin" button.

Plan: [Fleet console plan](https://claude.ai/artifact/V5aGj3ttAxjHqYzje5XLdg).

## What's built

| PR | Scope | Status |
|---|---|---|
| 1 | Access check, admin guard, audit table, Overview screen | this PR |
| 2 | Accounts: list, detail, disable/enable, delete, cap, revoke sessions | planned |
| 3 | Settings: sign-up switch, invite codes, session lifetime | planned |
| 4 | Usage and system: spend charts, build and migration info, audit log view | planned |
| 5 | Packages: Free / Plus / Pro, manual grants | planned |

## Security

Three locks, all required:

1. **Cloudflare Access at the edge** on `/admin*` and `/api/admin/*`.
2. **The Worker verifies the Access JWT** (`Cf-Access-Jwt-Assertion`) on every
   `/api/admin/*` call: signature against the team's published keys, the
   application's AUD tag, issuer and expiry. If Access isn't configured, the
   API answers 503 and the console stays closed.
3. **An admin passkey session.** Recovery-code sessions are refused, and
   disabled accounts never get a session.

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
   npm run cf:deploy                            # applies migration 0006_admin.sql
   ```

6. In **Workers & Pages → benkyo-ne → Settings → Domains & Routes**, turn
   off the `workers.dev` URL and preview URLs, so `/api/admin/*` can only be
   reached through the Access-protected domain.
7. Optional: a WAF rate-limiting rule on `/api/admin/*`, for example 60
   requests per minute per IP.

Emergency stops that don't need the console: set the Access policy to deny
everyone, and `SIGNUP_MODE=closed` on the Worker.

## Local development

`DEV_AUTH_BYPASS=1` on localhost skips both Access and the passkey (as for
the rest of the API):

```sh
npx wrangler d1 migrations apply benkyo --local
npx wrangler dev --port 8787 --infer-origin-from-routes=false --var DEV_AUTH_BYPASS:1
# open http://localhost:8787/admin
```
