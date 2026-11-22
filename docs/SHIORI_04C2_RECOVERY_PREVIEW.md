# SHIORI-04C/2 — Local recovery preview only

**No Vercel Blob writes. No automatic migrations. No production upload approval.**

## Verified background (2026-11-21)

- The production configured store listed a single Shiori JSON object `spirit/library.json` (76,068 bytes), uploaded 2026-11-21 02:41:46 UTC.
- The live audit had 59 books / 4 paths, with the same fingerprint as the current repository: `fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00`.
- A separately supplied 86-book / 8-path editorial export is available from the user (NOT bundled with this patch because it contains private reading state).

## Purpose

The script reads **the actual live Blob** with the same `get()` API as the previously successful source audit, first writes a raw local backup, then merges the 86-book reference into a separate **local candidate** file. Nothing is uploaded. All JSON files are written **outside the repo** into a previously nonexistent directory.

Conservative merge behavior:

- Existing book records stay in live order and keep all original fields, including status and notes.
- Existing books' `related` arrays are extended (never pruned) with additional verified IDs from the 86-book reference.
- All books missing from live are appended from the reference.
- Existing reading paths remain **byte-for-byte equivalent as JSON objects**, including current progress and comments; the 4 missing paths are appended.
- Existing thematic-pill metadata and existing tag labels win conflicts; missing pills and labels are added from the reference.
- Differences in shared authors, descriptions, other editorial fields, and existing paths are **reported but not overwritten**. Review separately.
- Invalid references or duplicate IDs fail the preview.
- The caller must supply the SHA-256 fingerprint from the last live audit. If the live source changed, only its backup is written; the merge candidate is blocked.

## Run on Windows PowerShell

1. Apply only the four repository-relative files in the ZIP.
2. Save the original approved `library (1).json` file somewhere *outside* the repository, for example `Downloads`.
3. Check the source fingerprint still matches the prior live audit. Do not share tokens or private JSON contents.
4. Create a **new** output directory path outside `C:\\kincstarto`.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\kincstarto'
$reference = Join-Path $env:USERPROFILE 'Downloads\library (1).json'
if (!(Test-Path -LiteralPath $reference -PathType Leaf)) { throw 'Missing 86-book reference JSON' }
$session = [guid]::NewGuid().ToString('N')
$tempEnv = Join-Path $env:TEMP "shiori-$session.env"
$backupDir = Join-Path $env:USERPROFILE "Documents\ShioriBackups\recovery-$session"
try {
  npx.cmd vercel env pull "$tempEnv" --environment=production
  if ($LASTEXITCODE -ne 0) { throw 'Vercel env pull failed' }
  node --env-file="$tempEnv" scripts/qa/shiori-recovery-preview.mjs --reference "$reference" --output-dir "$backupDir" --expect-live-sha fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00
  if ($LASTEXITCODE -ne 0) { throw 'Recovery preview failed or source changed' }
} finally {
  Remove-Item -LiteralPath $tempEnv -Force -ErrorAction SilentlyContinue
}
```

Once successfully run, send only the **terminal summary** and optionally `SHIORI_MERGE_REPORT.json` (contains no personal reading values). **Do not send backup or merge candidate files**: they contain personal status/notes and are needed only locally. Do not upload the candidate to Vercel until we review the planned operations, verify an independent backup, and provide a separately authorized restore process.

## Local source-only tests

`node --test scripts/qa/shiori-recovery.test.mjs`

The backup must be stored safely, not committed to Git, and not shared publicly. A backup that has not been restore-tested is not yet a verified rollback strategy.
