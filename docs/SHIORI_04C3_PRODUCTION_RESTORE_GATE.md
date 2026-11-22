# SHIORI-04C/3 – Production restore gate

Status: read-only preflight for a **single, exactly identified 2026-11-21 recovery candidate**. This patch contains no personal JSON or credentials and changes no app/API code. Applying this patch does NOT upload anything.

## Prerequisites

- Existing `SHIORI-04C2` preview files are installed, including `scripts/qa/shiori-recovery-core.mjs`.
- The user already ran the live backup/merge preview, at `Documents/ShioriBackups/recovery-...`, and has kept all three local files intact.
- Audited live SHA256: `fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00` (59 books, 4 paths).
- Reviewed candidate SHA256: `23840c39cf8815181c0d6940e6f4fab411617835ef1292ecebceab6160abee84` (86 books, 8 paths).
- Production Vercel env is pulled into a one-time TEMP file. Never copy secrets into the repo.

## Read-only preflight

Run `node --test scripts/qa/shiori-recovery-promotion.test.mjs` and then the CLI with `--recovery-dir ABSOLUTE_PATH` (NO `--apply`). The CLI reads the live Blob via `get()`, verifies exact fixed fingerprints, validates links, compares original personal fields and paths, and returns an informative read-only result. **No Blob writes occur in this mode.** Keep the original backup locally and do not share personal files.

## Live promotion (separate explicit user approval required)

A future separately provided command, only after explicit authorization from the owner, will opt into `--apply`, which requires a live typed confirmation and re-reads the Blob immediately before its only `put()` call. It will replace only `spirit/library.json` with the pinned candidate (86 books, 8 paths), then read back and verify. A change to the live data after the audit blocks the operation. This SDK path does **not** provide an atomic compare-and-swap guarantee; avoid concurrent admin edits during the actual promotion. Do not automatically retry failures or overwrite on ambiguity. Always preserve the local backup for rollback.

Remaining tasks AFTER live restore: verify the Next.js Shiori UI shows 86 books and 8 paths using production environment, audit editorial author/path differences separately; revise local 59-book fallback only in a controlled subsequent round. Do not make code changes to public/admin schemas as part of the one-time restore.
