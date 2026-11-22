# SHIORI-05C/3 — Final private-reader activation and independent postcheck

## Agreed boundary

The 94 books and 8 reading paths stay in the PUBLIC library with their original titles, descriptions, metadata, categories, book order and relationships. The public JSON ONLY loses:

- `books[].status`
- `books[].notes` (10 internal editorial notes, preserved in the separate private Blob)
- `paths[].progress`
- `paths[].items[].comment`

The private object `spirit/reading-state.json` has ALREADY been independently verified on 2026-11-21 (`PRIVATE_VERIFIED` then `private-preflight` with `privateObjectExists:true`). DO NOT repeat the first private POST or overwrite the private object.

## Patch boundary

- `src/app/api/admin/spirit/private-activation-check/route.ts`: protected GET-only confirmation. **Before** public redaction it returns `phase: PRE_REDACTION`, `expectedPublicSha256` and `privateObjectVerified: true` iff the existing private data matches the exact reviewed legacy SHA. **After** public redaction it returns `phase: POST_REDACTION`, `postcheckPassed:true`, exact counts, `publicSha256`, `privateStateReady` and `publicPersonalFieldsPresent:false`. The target hash from before MUST match the postcheck's actual hash after. NO secret, private values, Blob URLs, or book IDs in its response.
- `scripts/qa/shiori-activation-audit-core.mjs`: canonical full-public-projection byte comparison and full private roundtrip; book/path counts, referential integrity, and 22 status / 10 notes / 8 progress / 0 comments inventory.
- `/admin/shiori-state`: protected read-only overview of personal statuses, internal editorial notes and path progress. No change to public book details or shared Shiori shelving. The JSON import FAB stays the only FAB.

The new admin page is intentionally READ-ONLY; edits to private state remain handled by existing authenticated APIs. No new write endpoints are introduced in 05C/3.

## Manual operational sequence; **do not reorder**

1. Apply patch to `C:\kincstarto`, run local tests / `tsc --noEmit` / Next build. Do not deploy to Production yet. Do not change `SHIORI_PRIVATE_STATE_READY`.
2. Deploy to a NEW protected Preview and sign in as Kincstarto admin. GET `/api/admin/spirit/private-activation-check` (same host). Expect `phase: PRE_REDACTION`, 94/8/22/10/8 counts, `privateObjectVerified:true`. **Record** `expectedPublicSha256` for comparison. If not exactly as expected, STOP.
3. Confirm the Preview's GET `/api/admin/spirit/private-migration-apply` still reports `enabled:true`, `action:NO_WRITES`. Confirm the currently public SHA remains `18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3`. Ensure no concurrent book or path edits.
4. Only after these checks, manually authorize the already-reviewed 05C/2 second POST (phase `public`, sourceSha256 pinned, confirm `REDACT PUBLIC`) on that Preview. **This DOES overwrite the LIVE public Blob.** Require human confirmation. If it returns anything other than `PUBLIC_REDACTION_WRITTEN`, do not retry.
5. GET `/api/admin/spirit/private-activation-check` on the same new Preview. Expect `phase: POST_REDACTION`, `postcheckPassed:true`, `privateObjectVerified:true`, `publicPersonalFieldsPresent:false`, 94/8/22/10/8. Compare `publicSha256` to the previously saved `expectedPublicSha256` AND the second POST's `targetPublicSha256`. If no exact match, stop. On a stale CDN ETag error, do not repeat the write; investigate read-only and retry GET after the CDN settles.
6. Configure `SHIORI_PRIVATE_STATE_READY=1` on Vercel **Production**, and deploy this VERIFIED code to Production. The activation flag does nothing until the new deployment; deploy from the locally verified working tree with `vercel.cmd deploy --prod` only after checking full deploy scope. Do not enable it on an old version of the app that lacks the split-reader code. This can briefly interrupt personal admin state display while release propagates, not delete the private Blob.
7. On **Production**, sign into admin, GET `/api/admin/spirit/private-activation-check`: `phase:POST_REDACTION`, `privateStateReady:true`, all counts intact. Open `/admin/shiori-state`, verify statuses, notes, path progress; open `/library`, verify all 94 books and 8 reading paths and no personal values in public views. Also use admin JSON full export if desired; it must be accessible only when authenticated.
8. Disable/remove `SHIORI_05C2_WRITE_ENABLED` from Preview and retire earlier write-enabled Preview deployments (removing an environment variable does NOT revoke the copy already embedded in a previously deployed build). Never set this flag in Production. Remove obsolete Preview deployments only after successful Production verification. The private and public Blobs are not deleted by removing deployments.

### STOP conditions

- No new POST after `PRIVATE_VERIFIED` other than the single, separately confirmed public phase.
- Any `SOURCE_CHANGED`, `PRIVATE_UNVERIFIED`, ETag conflict, HTTP 5xx, or `OUTCOME_UNCERTAIN_DO_NOT_RETRY`: STOP; only read-only checks until diagnosed.
- Do not publish notes, status, progress, or raw private export in logs, screenshots, tickets, or chat.
- Current public-Blob redaction cannot retroactively revoke earlier downloaded or cached historical public copies; handle historical exposure separately.
- Do not run production storage writes from the assistant or from an automatic migration job.

## Local verification

Use `scripts/qa/shiori-final-activation.test.mjs` and the existing focused Shiori test suite, then `npx.cmd tsc --noEmit`, `npm.cmd run build`, `git diff --check`. The dependency-free assistant ZIP omits `node_modules`, so TS / Next production-build verification must be performed in the user's local repository.
