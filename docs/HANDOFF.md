# Kincstarto - development handoff

Last reviewed against the uploaded `kincstarto-main.zip`: 2026-10-20. This is a coordination checkpoint, not a runtime acceptance report. Refresh it as changes are actually verified and integrated.

## Current implementation (verified file boundaries)

- Next.js 16 App Router / React 19 / TypeScript, with `src/app/` routes and `src/app/api/` server handlers.
- Spirit Library / Konyvtar routes and components: `/library`, `src/components/spirit/`, `data/spirit/library.json`.
- Meditation routes and reader: `/meditations`, `/admin/meditations`, `src/features/meditations/`; existing audio engine in `src/features/audio/`, audio metadata in `data/audio/` and audio assets under `public/audio/`.
- Yoga/Yogi routes, components and structured data under `src/components/yoga/`, `src/components/yogi/`, `data/body/` and `data/yogi/`.
- JSON storage adapter in `src/lib/jsonStore.ts` supports local file operations and Vercel Blob when configured; do not assume live data source or server configuration from a source ZIP alone.
- Admin/login code and server-side AI routes exist. Follow existing auth boundaries; do not infer deployment configuration from source alone.
- `SPEC.md` and many documents in `TICKETS/` reflect earlier work and must be checked against current code before implementation.

## Checkpoint: workflow foundation - Patch 1

Patch introduces:

- `AGENTS.md` - assistant entry point, read order, implementation/privacy boundaries;
- `docs/DEVELOPMENT_WORKFLOW.md` - patch and verification convention;
- `docs/command-to-zip.md` - copyable Windows ZIP commands;
- `scripts/create-main-zip.ps1` - Base/Full/Custom source snapshots with safety exclusions;
- `.gitignore` additions for generated ZIPs.

The ZIP-building script must be verified in the user's Windows PowerShell after application. This handoff does **not** claim it was executed on Windows in the assistant environment.

## Checkpoint: iPhone Home Screen icon - Patch 2

Prepared against fresh source ZIP `kincstarto-main(1).zip` (which includes the Patch 1 workflow files), not yet confirmed integrated or deployed:

- `src/app/apple-icon.png`: opaque 180x180 PNG generated from the existing `public/favicon.svg` Kincstarto emblem, with warm paper background and dark ink foreground. Next.js App Router recognizes the filename and emits the Apple touch-icon metadata automatically.
- `public/icons/kincstarto-192.png` and `public/icons/kincstarto-512.png`: matching raster app icons for the manifest.
- `src/app/manifest.ts`: static web-app manifest (`/` start/scope, standalone display, consistent colors and icons). This does **not** add offline support.
- `src/app/layout.tsx`: Apple home-screen web app metadata (`appleWebApp`), retaining the existing SVG browser-tab favicon and time-dependent theme behavior.

No new dependencies, runtime audio logic, or UI changes. Verify the Home Screen result on a real iPhone after deployment; if an earlier Home Screen shortcut is cached, remove it and add the site again from Safari.

## Agreed upcoming product work (not implemented by Patch 2)

- Custom meditation timer, with configurable timed segments, selected chime/gong cues and locally saved combinations. Scope, UI details, sounds, and iOS screen-lock playback constraints need review at feature time.

## Working agreement

Fresh source ZIP -> smallest scoped implementation -> changed-files-only patch -> user applies files to repository -> focused local verification -> next fresh ZIP when necessary. The newest supplied ZIP supersedes older unpacked copies.

`Base` omits large media by design, so when the requested work involves precise sound/image assets, ask for a targeted `Custom` archive or use `Full`; never infer media deletion from its absence.


## Update — App icon follow-up
- The repository now contains the user-selected `src/app/apple-icon.png`; do not overwrite it in future icon patches unless explicitly asked.
- iPhone/Safari web-app colors were tuned so the browser chrome and standalone launch colors better match the site's night palette.
