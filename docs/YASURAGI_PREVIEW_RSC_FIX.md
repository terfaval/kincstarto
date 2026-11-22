# Yasuragi P01 saved-draft preview: Next.js RSC boundary fix

## Symptom

`/admin/yasuragi?draft=<saved-id>` fails during Server -> Client rendering:
`Only plain objects, and a few built-ins, can be passed to Client Components ... null prototypes are not supported.`

## Root cause

`loadYasuragiPosePreviews` built `previews` with `Object.create(null)` and passed that object to the `YasuragiPrototype` Client Component. The private saved draft is not the cause.

## Fix

Retain the null-prototype record internally, then convert it with `Object.fromEntries(Object.entries(previews))` via `toClientPosePreviews` before returning from the library loader. The bridge produces an ordinary object while preserving exact pose keys and values.

No changes to draft JSON, store, playback timing, admin gates, image asset URLs, publication or Shiori.

## Tests

- `node --experimental-strip-types --test scripts/test-yasuragi-preview-bridge.mjs`
- `node --experimental-strip-types --test scripts/test-yasuragi-player.mjs`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`
- Browser: open the saved draft URL and verify that the player renders, the two starter options are visible, and the timer starts. Try both choices without changing the saved draft.

Only the local Windows installation can verify the full Next.js runtime and live pose store. On a Next.js stale dev overlay, restart `npm run dev` once after patching.
