<!-- Fill every line; write "none" rather than leaving one empty. See AGENTS.md and docs/guides/teamwork.md. -->

## What and why

<!-- One or two sentences, in the words of the person who asked. -->

## Plan

- Scope: / Not in scope:
- Files:
- Shared things touched (tokens, ui kit, i18n keys, idb stores, AI contract, wrangler config):
- API routes added, changed or removed:
- Migration (`worker/migrations/NNNN_name.sql`):
- Config and secrets (names only):
- Needs Job's go (deploy, consent text, remote D1):

## Impact

<!-- What else uses what you changed, which journeys pass through it, and how you checked each. -->

## Verification

Status: Done | Done, not verified | Failed | Blocked

```text
npm ci && npm run check && npm test && npm run build
<paste the summary lines: svelte-check result, Test Files / Tests, build>
```

- [ ] Flow walked in a real browser (phone 390 px, iPad, desktop; light and dark; English and Thai) — or "no UI change"
- [ ] `docs/map.md` and the feature's doc updated — or "nothing to update"
- [ ] No secrets, `.dev.vars` or real learner data in the diff

## Screenshots

<!-- Required for UI changes. -->
