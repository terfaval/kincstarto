# Kincstarto - ZIP-based development workflow

## Principle

A fresh source snapshot is the input; the output is the **smallest coherent patch** plus the **smallest trustworthy verification** for its risk. Avoid unnecessary full-repo rebuilds and refactors.

## Round trip

```text
local Kincstarto repo (source of truth)
  -> scripts/create-main-zip.ps1 (Base / Full / Custom)
  -> assistant reads AGENTS.md, docs/HANDOFF.md, this workflow
  -> assistant reads current ticket and only relevant code/dependencies
  -> assistant returns changed-files-only patch ZIP
  -> user extracts it into existing repo, preserving relative paths
  -> user runs the provided focused PowerShell checks
  -> user commits checked changes in normal Git workflow (if desired)
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

## Source of truth and documentation upkeep

- `AGENTS.md`: stable assistant rules and read order.
- `docs/HANDOFF.md`: current verified checkpoint and upcoming ticket context, updated when materially changed.
- `docs/DEVELOPMENT_WORKFLOW.md`: stable rules for the process.
- `docs/command-to-zip.md`: packaging commands and safety checklist.
- `DECISIONS.md`: binding enduring decisions such as D29, D61, D62.
- `SPEC.md`: historical v0 MVP, **not** a current inventory or blanket scope prohibition.
- `TICKETS/` and `docs/superpowers/`: project history; apply only when relevant and still accurate.

Completion message: brief change summary, changed relative paths, what was actually validated, one copyable local verification command block if needed, any specific remaining limitation. No blanket claim of tests that were not executed.
