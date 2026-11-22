# Yasuragi P05b - reviziobiztos aszanatar-iras (2026-11-22)

## Scope and purpose

Source of truth: the fresh uploaded `kincstarto-main.zip` after the user's P05a local verification. This patch changes pose-catalogue writes in the **shared** Yogi Knowledge store, not only the Yasuragi authoring screen. No pose data, media, unrelated Shiori files, authorization settings or dependencies are bundled. P05b does **not** publish practices or approve poses.

## New storage contract

`getYogiKnowledgeStore().readPoseSnapshot()` returns `{ poses, revision }`; all pose writes use `savePoses(nextItems, expectedRevision)`. A stale or missing token rejects the save with `PoseRevisionConflict` (HTTP 409 at the admin routes). The generic Yogi pose editor submits the revision obtained when loading poses. The create-only Yasuragi pose action, global pose relink, and illustration upload read the latest snapshot and use server-side CAS for the short mutation, rather than accepting a stale full-catalogue overwrite.

### Local development (no Blob token)

- Re-read the canonical JSON after obtaining an exclusive `poses.json.write-lock` directory (safe across Node processes sharing the same local filesystem).
- Require the caller's exact content revision. Write a new temporary UTF-8 file, flush, then atomically rename to the canonical path.
- Rejected/stale requests never truncate or replace `poses.json`.
- The lock is never automatically stolen, even if it seems old. An abandoned lock requires operator investigation and manual removal **only after confirming no writer remains**.

### Vercel Blob (configured durable storage)

- Preserve the existing historical, immutable `yogi/pose-revisions/v1/` snapshots, including pre-P05b revisions.
- Introduce `yogi/pose-revisions/head-v1.json` as the single authoritative pointer to a verified immutable pose revision. Read its ETag and point to the exact referenced revision, checking the saved SHA-256.
- On the first write, atomically create-only initialize the head from the latest available legacy revision (or the canonical collection). After initialization, no `latest-by-timestamp` scan decides the live catalogue.
- Write a new immutable revision **before** committing its pointer. Switch the pointer only using Vercel Blob `put(allowOverwrite:true, ifMatch:oldEtag)`. Another admin's successful commit changes the ETag, so the losing writer receives a conflict instead of overwriting a newer snapshot. Losing writes may leave unreferenced immutable revisions; never use them as authoritative, and never auto-delete old revisions.
- The old `yogi/poses.json` is intentionally **not rewritten** on every new write: an uncontrolled legacy overwrite can race and give external consumers a misleading value. The new authoritative read path is the ETag-protected head + immutable revision. External programs that directly read `yogi/poses.json` must be migrated before relying on it for new changes.
- Vercel public Blob caches may temporarily serve a stale mutable head. A stale `get()` ETag is checked against `head()` and **fails closed**, never combining outdated data with a current token. Thus an immediate read after a write in some public-Blob configurations may transiently fail; this is a known availability limit. The installed SDK is `@vercel/blob@2.3.1`; a separate tested SDK upgrade/cache-bypass plan is needed before production rollout if this occurs. No package upgrade is included in P05b.

## Protected writers

- `/api/admin/yogi-knowledge/save`: explicit client `expectedRevision`; missing/stale => 409.
- `/api/admin/yogi-knowledge/illustration`: re-read target/current reference; CAS update; stale => 409. Image may already be uploaded on a conflict; its URL remains unreferenced, not silently activated.
- `/api/admin/yogi-knowledge/poses-relink`: recompute against one snapshot, CAS, 409 on conflict.
- `/api/admin/yasuragi/practices/pose`: retain create-only + slug/ID collision checks and use CAS, 409 on conflict. Avoid immediate public-CDN re-read after successful atomic commit.

All other collections (`anatomy`, `knowledge_cards`, Spirit, Shiori, meditation data) retain their existing persistence behavior. This patch does not assert they have transactionally safe writes.

## Verification

Offline tests (`scripts/test-yasuragi-p05b.mjs`) cover: local stale revision rejection; three simultaneous local writers; corrupt/locked catalogue behavior; four route contracts; an injected fake ETag race; and pointer conditional-write wiring. The fake ETag test is **not** a real authenticated Vercel Blob integration test. Existing P01–P04/P05a test harnesses should continue to pass.

Run all focused tests and `npx.cmd tsc --noEmit`, `npm.cmd run build` in the local installed Kincstarto repo. Do not run `npm install` just for this ZIP. Before any real production writes, use a *disposable Blob store* to test first-write migration, subsequent write, two concurrent revisions, read after write, recovery and 409 responses. Do not test concurrent writes against live approved pose data.

## Remaining limitations

- Public-Blob head caching and failed-read availability; test on the actual deployed runtime before production approval.
- Manual recovery needed after a local crash leaves `.write-lock`, or if a referenced immutable blob is unexpectedly missing/corrupt.
- Yogi anatomy/knowledge-card writes are still on old snapshot APIs. Production release and multi-user tests remain separate work.
- Rebuild/refresh of administrative browser state after 409 is user initiated, not an automatic conflict merge. Never replay a stale write automatically.
