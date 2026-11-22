# Yasuragi P05a - scoped data-safety patch

Source: the fresh user-supplied `kincstarto-main.zip` for the 2026-11-22 P05 audit.
See also the separately delivered `YASURAGI_P05_INTEGRATION_AUDIT.md`.

## Changed behavior

1. **Review invalidation**: `getProjectReview` computes SHA-256 from each complete canonical pose record. `evaluatePublicationGate` includes this digest in its reviewed-library fingerprint. An existing signoff becomes stale after a meaningful pose text, safety note, image field, or workflow-status change, even when old status flags are unchanged. There is no automatic signoff or publication.
2. **Fail-closed pose catalogue reads**: `YogiKnowledgeStore.listPoses()` still prefers a persisted immutable Blob revision. Without such a revision, it now reads the canonical collection with `createIfMissing:false` and `seedIfMissing:false`. Missing files, malformed JSON, and non-array catalogues cause read errors rather than silent empty-array replacement or read-time seeding. Other JSON collections (meditations, Shiori etc.) are not changed.
3. **Durable production pose writes**: `YogiKnowledgeStore.savePoses()` rejects a production mutation when Blob persistence is disabled. Development/local writes still follow the original local behavior. No tokens or configuration values are added.

## Scope

Modified:
- `src/features/yasuragi/lib/practice-review.ts`
- `src/features/yasuragi/lib/practice-publication.ts`
- `src/lib/yogiKnowledgeStore.ts`

New:
- `scripts/test-yasuragi-p05a.mjs`
- `docs/YASURAGI_P05A_DATA_SAFETY.md`

No data/media files, schema migrations, UI rewrites, or unrelated modules are included. `YogiKnowledgeStore` is a shared component, so use `tsc` and production build before acceptance. This intentionally does **not** solve two-admin concurrent full-snapshot writes; that is P05b, and should precede public release.

## Offline verification performed

Command from repository root:

`node --experimental-strip-types --test scripts/test-yasuragi-p05a.mjs scripts/test-yasuragi-player.mjs scripts/test-yasuragi-p03.mjs scripts/test-yasuragi-preview-bridge.mjs`

Result: **21 passed, 0 failed**. Of the five new P05a tests, three exercise behavior through the real pure review/gate functions; two statically assert the safety conditions in the shared storage module. They do **not** replace integration tests with `@vercel/blob` and a real installed Next.js environment.

## User-side verification before accepting patch

1. Run new P05a tests plus the existing P01-P04 and P04.1/P04.2 tests.
2. Run `npx.cmd tsc --noEmit` and `npm.cmd run build` in the installed checkout.
3. Open the saved `Ebredes es indulas` draft and check P01 playback loads and both starting choices still work.
4. In the admin, confirm the currently unapproved practice is **still blocked from editorial signoff**. Do not approve or edit real pose records solely to test a green approval gate.
5. No production data mutations are needed for testing. A separate disposable-store integration test should be added in P05b.

## Remaining P05 follow-up

- P05b: revision-aware/CAS pose writes with conflict response and concurrent-writer tests.
- P05c: default-branch readiness, paginated histories, full storage/auth/preview smoke tests.
- P06: explicit public release and rollback, with actor attribution when supported.

Do not commit or publish without the user's local verification. Preserve unrelated Shiori and Kincstarto worktree changes.
