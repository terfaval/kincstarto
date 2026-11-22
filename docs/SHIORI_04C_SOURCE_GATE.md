# Shiori 04C-1 — Read-only source gate

This is a source-audit checkpoint, **not a migration, backup, or release approval**.
The current repository fallback contains 59 books and 4 paths. The previously
supplied editorial reference contains 86 books and 8 paths; the seven-shelf
map references 86 IDs. The actual Blob contents cannot be inferred from these
source files. No book JSON or personal state should be copied into a patch.

## What the patch changes

- `loadSpiritLibrary` disables the generic JSON-store `seedIfMissing` behavior.
  A public read must not silently upload an older 59-book fallback to Blob.
- `scripts/qa/shiori-source-audit.mjs` compares the local fallback, an optional
  reference JSON file, and optionally **reads** `spirit/library.json` from the
  configured Blob. It does not call `put`, save files, or perform migration.
- The report contains only catalog counts, raw-source SHA-256 fingerprints,
  book/path IDs, field-name change counts, reference errors and aggregate counts
  of legacy personal fields. It never prints status values or note contents.
- Missing editorial tag labels in the historical local file are warnings, not
  proof of corrupted relationships. Missing theme/book/path references and
  duplicate IDs are errors.

## Run locally (PowerShell, from C:\kincstarto)

```powershell
node --test scripts/qa/shiori-source-audit.test.mjs
node scripts/qa/shiori-source-audit.mjs
# Optional: compare the separately kept, approved 86-book reference file:
node scripts/qa/shiori-source-audit.mjs --reference 'C:\path\to\library (1).json'
# Optional: read live Blob only if the environment points to the intended store:
node --env-file='.env.local' scripts/qa/shiori-source-audit.mjs --live
```

If the report includes a live Blob fingerprint and the user can independently
verify that the configured environment points to the intended deployment,
record the fingerprint and counts. Do not paste credentials, notes, personal
state or raw production JSON into chat or source control.

## Explicit blockers before SHIORI-04C-2

1. Verify the actual live Blob source and its fingerprint; distinguish a missing
   blob from a 59-book fallback. A successful build is not evidence of this.
2. Create a **separate**, access-controlled raw backup of the live Blob, with a
   tested restore procedure. This audit script never creates that backup.
3. Decide which source changes take precedence (editorial reference vs live
   admin changes), before any catalog overwrite or merge.
4. Audit ownership of historical `status`, `notes`, `paths[].progress` and
   `paths[].items[].comment`. Never attach them to a user without evidence.
5. Only then design the new `primary_category_id`, `author_sort_key`, cover
   families and separate private-user state persistence with rollback and QA.

There is deliberately **no automatic save** of the 86-book reference in this
patch. Admin saves still need source-of-truth checks before production use.
