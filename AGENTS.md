# Kincstarto - assistant operating rules

This is the first entry point when working on a fresh Kincstarto ZIP. The currently supplied source ZIP and its code take precedence over older chats and historical tickets.

## Read order

1. `AGENTS.md` (this file).
2. `docs/HANDOFF.md` (verified current checkpoint and next work).
3. `docs/DEVELOPMENT_WORKFLOW.md` (ZIP/patch/verification contract).
4. `DECISIONS.md` for enduring decisions; `SPEC.md` for historical MVP context, **not** assumed current feature inventory.
5. Only the relevant ticket, module and direct dependencies for the requested change.

## Repository facts and product boundaries

- Next.js 16 App Router, React 19, TypeScript; npm scripts in `package.json` are authoritative.
- Main UI is under `src/app/` and `src/components/`; feature modules are under `src/features/`.
- Meditation reader/audio: `src/features/meditations/`, `src/features/audio/`, `data/meditations/`, `data/audio/`.
- Spirit Library: `src/components/spirit/`, `src/lib/spirit*`, `data/spirit/library.json`.
- Yoga/Yogi: `src/components/yoga/`, `src/components/yogi/`, `src/lib/yogi*`, `data/body/`, `data/yogi/`.
- API routes can handle authenticated/admin operations, server-side AI and persistence. Never move privileged operations or credentials into client code.
- Follow `DECISIONS.md`, especially D29 (mobile width <= 420px), D61 (UTF-8/Hungarian accents), D62 (proxy route handling, no middleware), and relevant auth/persistence decisions.
- Do not add dependencies, database services, new persistence or broad architecture changes unless the ticket needs them.
- Respect the project's existing design, time-dependent theme and established UI behavior.

## Source ZIP and privacy

Assistant ZIPs are intentionally dependency-free. They normally exclude `.git`, `node_modules`, `.next`, `.env*`, secrets, local build state, and personal `data/body/activity-logs.json`. Default `Base` snapshots also omit heavy media; `Full` or `Custom` can include media when needed.

Do not assume media absent from a Base ZIP is absent from the real app. Do not overwrite, delete, or replace unseen media based on this omission.

Do not run `npm install` or `npm ci` simply because dependencies were intentionally left out of the ZIP. Report checks requiring local installed dependencies as user-side verification with precise commands.

Never include actual credentials, private logs, tokens or user data in returned patches. A ZIP script's exclusion rules are a guardrail, not a substitute for reviewing a bundle before sharing.

## Development round

1. Use the newest fresh Kincstarto ZIP as the implementation source of truth.
2. Work in the smallest relevant code boundary; no incidental refactors.
3. Return a ZIP containing **only changed/new files**, at repository-relative paths.
4. Preserve all untouched repository files and media when the patch is applied.
5. Choose the lightest trustworthy verification: script/document checks for workflow changes; focused behavior tests where meaningful; manual mobile checks for UI; typecheck/build only when justified.
6. Give the user one exact, copyable Windows PowerShell verification block when local verification is needed.
7. Update `docs/HANDOFF.md` only for meaningful workflow/product checkpoints, not cosmetic edits.
8. Close with modified paths, verified checks, limitations, and any remaining follow-up. Stop when the requested ticket is done.

For full operating details see `docs/DEVELOPMENT_WORKFLOW.md` and `docs/command-to-zip.md`.
