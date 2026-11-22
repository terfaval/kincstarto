# SHIORI-04C/4b: public Blob metadata/ETag diagnosis (read only)

Problem: the 04C/4a preflight stops because `get()` (CDN) and `head()` (metadata API) report different ETags, even after an uncached-URL attempt. The sizes happen to be equal (76,068 B), which **does not by itself prove** the versions are identical.

## This patch

Installs a separate *read-only* diagnostic without changing the existing, guarded restore code. It checks the known `spirit/library.json` only. It obtains two public GET bodies (normal and unique URL), two HEAD metadata snapshots, one LIST metadata snapshot, and a conditional GET response against the HEAD ETag. Output includes canonical SHA-256 fingerprints, size, upload timestamp, ETag shapes and short ETag digests. It does **not** print raw ETags, URLs, tokens, notes or JSON book fields. It does not write local or remote files.

Pinned baseline: 59 books / 4 paths; fingerprint `fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00`; size 76068 B; uploaded at `2026-11-21T02:41:46.000Z` per the previous store list.

Important: a matching SHA from a CDN copy and a matching timestamp from the metadata API are useful evidence, but not proof that a concurrent origin version cannot differ. The existing `--apply` guard should **not** be bypassed or modified based solely on this diagnostic. If CDN/HEAD ETags still disagree, the next safe change must establish a reliable object-version read or use a separate staged object + controlled promotion strategy.

## Run

1. Manually overlay the four patch files in `C:\kincstarto`.
2. Run `node --test scripts/qa/shiori-blob-version-diagnostic.test.mjs`.
3. Pull production env vars to an *ephemeral* file with Vercel CLI; run `node --env-file="<tempEnv>" scripts/qa/shiori-blob-version-diagnostic.mjs`.
4. The diagnostic prints no book data and no credential. Keep any local restoration backups private.

No commit, push, upload, delete, copy, merge or migration is performed.
