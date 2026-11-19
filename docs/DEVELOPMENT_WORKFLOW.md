# Kincstarto - ZIP-based development workflow

## Principle

A fresh source ZIP starts a ZIP-based development round. The assistant prepares the **smallest coherent patch**, the checks appropriate to its risk, and a guarded Git block after verification succeeds. The user runs both PowerShell blocks in the local repository.

## Local Codex round

Use this path when Codex can edit the local checkout and run the relevant checks. Codex applies the smallest change, runs the checks below for its risk, diagnoses failures and reruns the checks after fixes. If a required check is blocked, report which check is still pending before handing over Git commands.

After successful verification, report the checks run and give plain Git commands for the user to run. Verify the branch, push remote, staged state and ticket diff first. Scope the commit to the exact paths and use the intended commit message. Give the normal push command for the established target, to run after the commit succeeds. The verification and guarded PowerShell blocks below apply to ZIP-based rounds, including rounds where Codex receives only an archive.

## ZIP round trip

```text
local Kincstarto repo (source of truth)
  -> scripts/create-main-zip.ps1 (Base / Full / Custom)
  -> assistant reads AGENTS.md, docs/HANDOFF.md, this workflow
  -> assistant reads current ticket and only relevant code/dependencies
  -> assistant returns changed-files-only patch ZIP and verification block
  -> user extracts it into existing repo, preserving relative paths
  -> user runs the checks and returns the relevant output
  -> on failure: assistant returns a corrected patch and checks
  -> on success: assistant provides the guarded commit and push block
  -> user reviews the staged summary, confirms commit and push, and returns the Git result
  -> user creates a fresh snapshot for the next substantial round
```

A newer supplied ZIP supersedes older extracted code; do not develop on a stale assistant copy. If the source snapshot and an earlier plan conflict, inspect current source first.

## Source snapshot contract

- The ZIP is **not** a complete installed project. It omits `.git`, `node_modules`, `.next`, `.env*`, credentials, generated builds and local/secret state.
- `data/body/activity-logs.json` is treated as personal local data and never included.
- `Base` includes code, relevant JSON data, documentation, scripts, configs and lightweight assets; it omits `public/audio/`, `public/backgrounds/`, `public/yogi/` and historical `TICKETS/`.
- `Full` includes those asset/ticket folders **but still excludes secrets and local activity logs**.
- `Custom` includes user-selected files/folders plus `AGENTS.md`, `docs/HANDOFF.md` and this document. All modes use the same safety exclusions.
- Omitted media is not evidence of its absence in the repository. Never remove/replace unseen assets in a returned patch.
- Review the contents of a ZIP for personal information before uploading; the script cannot recognize every sensitive filename or data field.

ZIP commands and examples: `docs/command-to-zip.md`.

## Patch contract

- Return **new or actually modified files only**. Keep paths relative to the repository root (e.g. `src/features/...`).
- Do not return the entire repo, dependency directories, installed packages, generated assets or private data.
- Do not include old copies of files just to keep folder structure; an extracted patch must safely overlay the user's existing repo.
- If moving/deleting a file is essential, give explicit instructions; a changed-files ZIP alone cannot perform deletions.
- Avoid unauthorized schema/persistence/auth changes, unrelated code cleanups and speculative dependencies.
- Preserve established Next.js `proxy.ts` boundary; do not introduce `middleware.ts` (D62).

## Verification by risk

- **Docs/script-only**: syntax/structural inspection; create and inspect a fresh ZIP locally (no npm necessary).
- **Small UI/visual**: focused dev-server/manual check and a mobile viewport at or below 420px (D29).
- **Deterministic logic/data**: focused tests or data validation where tests exist or are justified.
- **Shared TypeScript/wiring**: `npx.cmd tsc --noEmit` or equivalent local check if dependencies are installed.
- **Routing/config/server/persistence**: escalate to a local `npm.cmd run build` when production wiring warrants it.

The current `package.json` offers `dev`, `build`, `start`, `lint`; it does **not** define a test or typecheck npm script. Do not invent an `npm test` command or require Vitest. If the assistant ZIP omits dependencies, don't run `npm install`/`npm ci` just to do a check; mark it **local user-side verification** instead. A full test suite is not the default.

## Verification block and feedback

- Supply one copyable Windows PowerShell block with the actual commands for this patch. Start with `$ErrorActionPreference = 'Stop'` and `Set-Location -LiteralPath 'C:\kincstarto'` for the current checkout. Check `$LASTEXITCODE` immediately after each native command and stop with an error naming the failed step.
- Include `git diff --check` and `git status --short` scoped to the patch paths. Add the focused checks justified above, including a manual acceptance check when the result depends on a browser, device or media asset.
- Ask for all output relevant to those checks, including errors and manual results. Ask the user to redact sensitive values and keep private inputs, reports and personal logs local.
- On failure, send the smallest correction and the checks to rerun. Use a fresh source ZIP if the local files have diverged from the last snapshot and patch.

## Guarded commit and push block

Prepare this second copyable Windows PowerShell block after the patch passes verification. Include the exact ticket paths and commit message. Use the branch and remote established for this checkout or by the user.

1. Enter the checkout, check the expected branch and push remote, and require an empty staging area. Stop on a failed command or unexpected state and preserve unrelated changes.
2. Verify every listed file exists. Handle intentional deletions or renames explicitly when the ticket requires them. Stage only the listed paths with `git --literal-pathspecs add -- $files`.
3. Read the staged paths with `git -c core.quotePath=false diff --cached --no-renames --name-only` and require an exact match with the list. Run `git diff --cached --check` and display `git diff --cached --stat`. Check the exit code after each native command.
4. Use `Read-Host` to ask for confirmation, naming the ticket and push target. Proceed only on `yes`. On cancellation, stop before committing and report that the selected files remain staged. After confirmation, repeat the branch, staged-path and staged-diff checks before committing.
5. Commit with the prepared message, then push the expected branch to the specified remote with a normal push. If push fails, preserve the local commit and use the error to diagnose the failure. Never force push or retry by creating another commit.
6. Show the new commit hash and subject and `git status --short`. Ask the user to return the relevant Git output, with sensitive values redacted, so the assistant can confirm the result.

Run any required production build before staging. Reuse a successful build against the same patch when it still applies.

## Source of truth and documentation upkeep

- `AGENTS.md`: stable assistant rules and read order.
- `docs/HANDOFF.md`: current verified checkpoint and upcoming ticket context, updated when materially changed.
- `docs/DEVELOPMENT_WORKFLOW.md`: stable rules for the process.
- `docs/command-to-zip.md`: packaging commands and safety checklist.
- `DECISIONS.md`: binding enduring decisions such as D29, D61, D62.
- `SPEC.md`: historical v0 MVP, **not** a current inventory or blanket scope prohibition.
- `TICKETS/` and `docs/superpowers/`: project history; apply only when relevant and still accurate.

With the patch, summarize the change, list the changed paths, say what was verified, and give the verification block and any manual checks. After the verification result, provide the Git block or the next correction. Close the round with the confirmed outcome and any remaining limitation.
