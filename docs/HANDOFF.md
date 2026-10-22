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

## Checkpoint: mobile Üveggyöngyök — Patch 04

Prepared from `kincstarto-main(2).zip`, preserving the Patch 03 handoff and avoiding overlap with its runtime files:

- Mobile (<=600px): ring in the upper zone; horizontal thematic chips focus and zoom toward each category while other beads dim. Mobile geometry increases separation and offers larger transparent tap targets.
- Mobile lower zone: original resting copy, large first-custom-meditation entry button and underlined configuration entry. The entry shows an explicit coming-next-step notice; it is **not** a timer/configurator yet.
- Tapping any bead shows its guided-meditation preview **in the lower zone**, keeping the ring visible and usable. A subsequent bead tap replaces the preview. The existing reader and desktop presentation remain in place.
- No new persistence, audio features or packages. Full mobile visual check and user-side TypeScript/build verification still required.

Follow-up for Patch 05: design/implement the saved custom meditation configuration UI with stage-based durations, selectable system sounds and repetition counts; agree storage/entry details before wiring the custom-start action. Patch 06: timer engine/player and dedicated opening sound.

## Checkpoint: custom meditation configuration — Patch 05

Prepared against uploaded `kincstarto-main(3).zip` (includes Patch 04 and the TypeScript configuration fix). This patch adds a custom-practice manager without starting timed audio playback:

- Custom presets have a name, an ordered list of stages, a duration in seconds per stage, optional end cue, and 1–8 repetitions. Stage ordering, duplication of a whole preset, deletion, and a selected default preset are supported.
- The two catalog choices (`accent_chime_soft_02`, `accent_resonance_airy_01`) come from `data/audio/audio_library_metadata_v1.json`. Their audio assets are deliberately **not** added or replaced in this code-only ZIP. Sound playback is not implemented in Patch 05; later choices can be added to `custom-meditation-types.ts` when supplied.
- Presets are stored **only in browser localStorage** under `kincstarto.customMeditations.v1`, in a schema-validated, versioned shape. No database writes, account sync, login or server API is involved. Invalid/unknown schema is never silently overwritten.
- The existing mobile own-practice entry now opens a real configuration dialog, and a compact entry has been added to the desktop resting view. A saved default is summarized on the home entry. Start buttons explicitly report that timed playback will arrive in Patch 06.
- The dedicated start sound will be managed separately in Patch 06 (not a user-selected stage cue). No screen-lock playback guarantee or background timer is implied.

Patch 05 should be reviewed with the existing Next.js app (especially narrow mobile heights and accessibility); this source ZIP omitted node_modules, so no project-wide build is claimed here. Patch 06 should implement the timer and sound player against this schema, without redesigning the preset manager.

## Checkpoint: custom meditation playback — Patch 06

Prepared against `kincstarto-main(4).zip`, which already contains Patch 05 and passed the user's `tsc --noEmit` and `npm run build` checks.

- The primary custom-practice button starts the saved default; the manager also offers **Indítás** for any saved preset without changing the default.
- `CustomMeditationPlayer` overlays the established meditation background with only Exit, central Pause/Resume, and Restart controls. Neither timer digits nor stage labels are exposed visually; accessible control labels and a screen-reader status are present.
- The standalone, elapsed-time-based timer advances through saved stages. Each stage's optional ending cue plays 1–8 times sequentially using the existing `/audio/accent/<id>.mp3` assets; a silent stage end is supported. The final cue may ring out before the player closes.
- The one-off opening sound is presently an *explicit temporary Web Audio signature* distinct from the selectable stage cues; replace it when the dedicated user-selected sound file is provided. Audio starts directly from the user's click to respect mobile browser gesture requirements. No audio files or other user assets were overwritten.
- Pause/resume preserves progress, restart reconfirms and plays the opening sound once, and exit reconfirms; hidden-tab transitions auto-pause. Missing external cue assets do not crash the timer; a visible warning is presented while it continues.
- Background/locked-screen playback is **not guaranteed** or targeted in this release. The ZIP lacks media files by design, so published audio availability must be verified on the target deployment. A full Next.js build/mobile session still requires user-side verification.

## Checkpoint: dedicated meditation timer audio — Patch 06a

- Source: user-supplied `kincstarto-full.zip` containing all seven MP3 files in `public/audio/timer/`. The files remain **untouched** and are not part of the code-only patch.
- The exclusive opening file is `/audio/timer/opening-signature.mp3`; the old synthesized three-tone signature was removed.
- Six selectable stage cues: `bells`, `cymbal`, `windchime`, `singing-bowl-hit`, `bell-hit-crown-chakra`, `bell-hit-root-chakra`. No custom timer sound is loaded via `resolveAudioPath` or `public/audio/accent`. The guided-reader audio engine remains unchanged.
- Stored v1 presets with the two former `accent_*` cue IDs are **read** and translated to `bells` and `singing-bowl-hit`, respectively. Legacy storage is not eagerly overwritten; the next successful save serializes the current IDs. Unknown/corrupt data still fails closed.
- The opening is fetched and decoded into Web Audio after AudioContext resume on user gesture; failure to load also displays the player's nonblocking sound warning. Pause/restart/exit cancel or suspend it together with stage cues.
- Recordings are ~12–19 seconds, including long tails. Repetitions use the full recording with a short gap rather than layering strikes; a repeated final cue can therefore take some time to finish.
- Confirm rights/licenses for the user-provided recordings before public distribution; ZIP filenames alone are not sufficient proof of licensing.
- User-side `npx.cmd tsc --noEmit`, `npm.cmd run build`, and real-device audio checks are required after applying Patch 06a.


## Checkpoint: custom timer playback polish and 7-second audio cues — Patch 06b

- The functioning session timer from Patch 06/06a remains segment-based with a dedicated start-only signature and no visible countdown; this patch does **not** replace the guided meditation reader.
- The seven selected meditation sounds in `public/audio/timer/` were edited from the previous user-provided Full ZIP to ~7 seconds each, with a short fade-out. Keep archival copies of original source audio separately if longer tails may be needed later. The audio files are bundled in this patch because the latest Base ZIP intentionally excludes them.
- The custom stage editor now supports a one-shot sound preview; it stops previews on selection changes, exit and unmount.
- Exit/restart in the custom player use a compact in-app confirmation overlay instead of OS-native confirm dialogs. Timer/audio pauses during confirmation and resumes only when cancelled from a running session.
- Browser screen-lock background audio is still out of scope. Verify on iPhone with the screen awake; local `tsc`/`next build` checks remain user-side where dependencies are installed.

## Checkpoint: Patch 07 - mobile meditation refinement (2026-10-21)

- Mobile meditation ring uses a collapsed filter button at upper right; expanded pills sit in a single horizontally scrollable row and do not collide with the back-to-home control (`/`).
- Mobile lower zone is transparent and shares the same cool blue image overlay as the ring and the full-screen custom meditation player. Ring/copy/custom-action vertical spacing has been adjusted without changing the desktop ring.
- Custom start button includes the saved default preset title (`<name> indítása`); the line above displays duration only. Existing browser-local presets remain untouched.
- Custom-player Exit and Restart happen immediately without confirmation modals. The opening signature starts through an HTML audio element's `play()` invoked synchronously on the user's tap; Web Audio remains unlocked for stage endings. Playback failure reports an asset warning.
- A Screen Wake Lock is requested only while the custom timer is running or finishing and released when paused/exited. Browser/OS support, especially older iOS installed web apps, can prevent acquisition; background playback is still intentionally unsupported and requires real-device QA.
- The ZIP is code-only and does not include `/public/audio/timer/` media; validate deployed MP3 URLs independently.


## Checkpoint: custom meditation stage audio — Patch 07a

- Symptom reported on iPhone after Patch 07: `opening-signature.mp3` audibly plays, but configured stage-end cues are inaudible despite successful TypeScript/build checks.
- Source-level risk: opening used user-initiated HTMLAudioElement playback, while stage cues used an independent Web Audio AudioContext (which can be inaudible/paused on iOS Safari, e.g. silent-mode and interrupted session issues).
- Replace custom-timer stage Web Audio with the **same, reusable HTMLAudioElement** initialized and played by the Start click. Change `src` on the existing element at stage boundaries; keep repetition, pause/resume, restart, cleanup, and on-failure final-stage completion. No changes to the guided meditation audio engine, stored cue IDs, presets or MP3 assets.
- Stage and opening playback are now a single media path; do not add new audio elements at delayed stage boundaries (risk of iOS playback authorization failure). This is a compatibility fix, not proof of behavior on a physical iPhone. Verify in a visible Home Screen webapp with a 15-second practice, including iPhone silent mode.

## Checkpoint: iOS stage cue audio sprite — Patch 07b (2026-10-22)

- User confirmed Patch 07a **still did not produce stage-end sounds on iPhone**, although the opening MP3 works. Successful typecheck/build does not verify iOS media behavior.
- For the custom timer only, the seven existing 7-second recordings are encoded into `public/audio/timer/meditation-sprite.mp3`: opening 0–7s; six cues occupying 9-second slots (7s sound, 2s buffer); a nearly inaudible 90s bed starts at 63s. The original individual MP3s remain untouched and selectable in the editor.
- `CustomMeditationCues` calls `play()` in response to the user's Start tap **once**, then keeps the same source playing continuously and seeks within that source for each stage-ending cue and its repetitions. It never changes `audio.src` or starts a new play() call at a timer boundary. Pause/resume and restart occur from explicit user taps. No guaranteed iPhone result is claimed until physical-device QA.
- Timing semantics: a stage's saved duration starts when the meditation is launched; the first 7-second opening sound occurs **inside the first stage** rather than before the timer. Stage cues are triggered when cumulative stage durations elapse; the final cue (and any repeats) finishes before automatic exit. A later boundary can interrupt a long series of repeats.
- On a physical iPhone, test a single 15-second stage with one `bells` cue (then a second test with 2 repetitions). For additional console diagnostics, open the app URL with `?meditationAudioDebug=1`; the minimal player UI remains unchanged. Keep the display visible and check MP3 asset deployment.
