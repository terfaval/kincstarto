# Landing Background Revert Design Spec

Date: 2026-04-12
Topic: Revert landing background to cover with lower position

## Summary
Revert the landing background back to the original cover behavior and remove the blurred fill layer. Set the background position lower to `center 65%`.

## Goals
- Restore the original `cover` background behavior.
- Remove the blur overlay.
- Shift the background down slightly using `center 65%`.

## Non-Goals
- No layout changes beyond background.
- No content changes.

## Styling Changes
- `.landing-shell` background-size: `cover`.
- `.landing-shell` background-position: `center 65%`.
- Remove `.landing-shell::before` overlay.

## Testing
- Manual check:
  - Background matches earlier look (cover) and sits slightly lower.
