# Night Theme Landing + Toolbar Icon Styling Design Spec

Date: 2026-04-12
Topic: Night theme styling for landing and library toolbar icons

## Summary
On night theme, make the landing logo and card icons white and add a dark blue overlay on the landing background using a diagonal/radial gradient at ~45% opacity. For the library toolbar, make the two SVG icons (meditations/yoga) appear white in night theme only. Day theme remains unchanged.

## Goals
- Night-only: landing logo + 3 card icons appear white.
- Night-only: landing background gains a dark blue overlay (diagonal/radial gradient, ~45% opacity).
- Night-only: library toolbar SVG icons appear white/near-white.
- Day theme remains unchanged.

## Non-Goals
- No new icon assets.
- No layout or routing changes.

## Implementation Notes
- Landing styles live in `src/app/globals.css`.
- Use `:root[data-time-theme="night"]` to scope night-only styles.
- Overlay implemented via a pseudo-element on `.landing-shell`.
- Toolbar icon adjustments scoped to library toolbar SVG images only (the two swapped icons).

## Testing
- Manual check:
  - Toggle night theme and verify icons/logos turn white only at night.
  - Landing background has visible dark blue overlay at night.
  - Day theme looks unchanged.
