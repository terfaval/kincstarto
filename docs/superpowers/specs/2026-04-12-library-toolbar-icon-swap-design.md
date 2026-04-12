# Library Toolbar Icon Swap Design Spec

Date: 2026-04-12
Topic: Replace library toolbar icons with landing SVGs

## Summary
Replace the two library toolbar icons (Meditációs tér and Yogi's choice) with the SVG assets used on the landing page. Leave all other toolbar buttons untouched.

## Goals
- Swap the two specific toolbar icons only.
- Use `public/icons/meditations.svg` and `public/icons/yoga.svg`.
- Preserve current layout/spacing and button behavior.

## Non-Goals
- No other toolbar changes.
- No icon color/size redesign unless needed for fit.

## Implementation Notes
- Update `src/components/spirit/SpiritLibraryApp.tsx`.
- Replace the `Sparkles` icon on the Meditációs tér button with the SVG.
- Replace the `Brain` icon on the Yogi's choice button with the SVG.
- Keep the existing `fabIcon` styling hook for sizing/alignment if appropriate.

## Testing
- Manual check:
  - Toolbar buttons still work and navigate.
  - Icons render correctly and align as before.
