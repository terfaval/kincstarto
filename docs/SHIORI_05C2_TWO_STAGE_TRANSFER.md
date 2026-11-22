# SHIORI-05C/2 - reviewed one-admin data classification and staged transfer

## Editorial decision (2026-11-21)

- 94 book titles and 8 paths: the public catalog must retain all editorial data.
- All 22 non-default reading statuses and 8 path-progress values belong to the sole admin; public pages and public JSON must never expose them.
- The 10 legacy `notes` values are editorial working notes, not public book-detail content. Preserve every value in the private admin-only state, using the existing `notes` field as a compatibility bridge. Do not delete or expose notes in public catalog JSON.
- No per-book manual notes classifier and no user-account rollout is needed for this one-admin migration.
- This is an approved classification, not authorization to perform production storage writes.

## Delivery

The existing 05C/1 GET audit remains read-only. The new admin route:

`/api/admin/spirit/private-migration-apply`

GET returns **only migration policy flags**. POST is disabled by default, and can be enabled ONLY on an isolated Vercel Preview deployment with `SHIORI_05C2_WRITE_ENABLED=1`, never in production. NOTE: the Preview is wired to the same public catalog Blob as Production, so POST writes affect the live data even from Preview. Do not enable without separate explicit approval.

The two irreversible-request phases are:

1. `private`: validate exact reviewed 94/8 source SHA, lossless editorial projection and state roundtrip; ensure private object is absent; create exact private pathname with overwrite forbidden; verify via private readback and metadata. Public Blob unchanged.
2. `public`: re-read exact reviewed source and verified private state, demand matching metadata, SHA and private values, then issue one ETag-conditional public overwrite that strips status, notes, progress and per-path comments. Verify destination HEAD metadata and stop, with no automatic retry.

The route accepts strictly a JSON object with `phase`, `sourceSha256`, and `confirm` (either `PRIVATE FIRST` or `REDACT PUBLIC`). It is guarded by the app's admin cookie and same-origin POST checks. The route returns only safe phase names, counts and hashes. Never paste secrets or raw private values into a request or chat.

The exact source SHA currently pinned is:
`18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3`.
Any subsequent catalog edit invalidates the plan. Reaudit first.

## STOP / recovery notes

- `PRIVATE_OBJECT_EXISTS`: do not overwrite it; inspect separately.
- `SOURCE_CHANGED`: a new audit and candidate are required.
- `OUTCOME_UNCERTAIN_DO_NOT_RETRY`: a write may already have completed. Inspect with GET audit and read-only Blob preflight instead of retrying.
- A private write by itself does NOT remove sensitive fields from the still-public catalog. Both phases and the final audit are required.
- Immediately after stage two, use the read-only postcheck to compare exact public projection, public field absence, private data, catalog IDs and private state. Do not set `SHIORI_PRIVATE_STATE_READY=1` until the public service is deployed with the split-reader code and the postcheck passes.
- Neither current Preview nor this ZIP changes Vercel settings, invokes POST, promotes, pushes, or deploys anything.
- Previously publicly accessible historical versions and downloaded copies cannot be made private retroactively just by overwriting the current public Blob. Treat any past exposure separately.

## Local validation

```powershell
node --experimental-strip-types --test scripts/qa/shiori-private-transfer-gates.test.mjs scripts/qa/shiori-private-migration-audit.test.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

Do NOT enable the write flag yet. Separate operational approval, staged tests, and read-only follow-up checks must precede live writes.
